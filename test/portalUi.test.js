import test from "node:test";
import assert from "node:assert/strict";
import { portalRequest, requirePortalStudent } from "../src/lms/portalClient.js";
import { resolvePortalLogin } from "../src/lms/portalLoginFlow.js";
import { buildPortalProfilePayload, getPortalProfileForm, portalIdentifierForStudent, portalProfileContactChanged } from "../src/lms/portalProfile.js";
import { createPortalSessionScope, recheckPortalSession } from "../src/lms/portalSession.js";

const enrollment = { id: "recorded-student", track: "Data Analytics", cohortId: "july-2026", pinRequired: false };
const student = {
  id: enrollment.id, fullName: "Example Learner", email: "learner@example.test",
  track: enrollment.track, learningMethod: "Self-Paced Pre-recorded Videos",
  whatsapp: "+256712345678", phoneCountry: "UG", phoneCallingCode: "+256", phoneNationalNumber: "712345678",
};

test("no-PIN entry still requires successful server authentication after lookup", async () => {
  const calls = [];
  const result = await resolvePortalLogin({ identifier: " learner@example.test " }, async (action, payload) => {
    calls.push({ action, payload });
    return action === "lookup" ? { enrollments: [enrollment] } : { student, pinRequired: false };
  });
  assert.equal(result.stage, "authenticated");
  assert.deepEqual(calls.map(({ action }) => action), ["lookup", "login"]);
  assert.deepEqual(calls[1].payload, { identifier: "learner@example.test", studentId: enrollment.id });
  await assert.rejects(resolvePortalLogin({ identifier: student.email }, async (action) =>
    action === "lookup" ? { enrollments: [enrollment] } : { student: null }), /confirm your portal session/);
});

test("PIN-configured recorded learners stop at the PIN prompt before authentication", async () => {
  const calls = [];
  const configured = { ...enrollment, pinRequired: true };
  const next = await resolvePortalLogin({ identifier: student.whatsapp }, async (action) => {
    calls.push(action); return { enrollments: [configured] };
  });
  assert.equal(next.stage, "pin");
  assert.equal(next.selectedId, student.id);
  assert.deepEqual(calls, ["lookup"]);
  let login;
  const accepted = await resolvePortalLogin({ identifier: student.whatsapp, enrollments: [configured], selectedId: student.id, pin: "584927" }, async (action, payload) => {
    assert.equal(action, "login"); login = payload; return { student, pinRequired: true };
  });
  assert.equal(login.pin, "584927");
  assert.equal(accepted.session.pinRequired, true);
  assert.ok(!JSON.stringify(accepted).includes("584927"), "PIN must never become session state");
});

test("multiple enrollments require an explicit valid choice and errors cannot establish a session", async () => {
  const choices = [enrollment, { ...enrollment, id: "other-course", track: "Software Development", pinRequired: true }];
  for (const selectedId of ["", "invented-enrollment"]) {
    const result = await resolvePortalLogin({ identifier: student.email, enrollments: choices, selectedId }, () => assert.fail("must not authenticate an unselected enrollment"));
    assert.equal(result.stage, "enrollment");
  }
  const error = Object.assign(new Error("Enter your student PIN."), { code: "PIN_REQUIRED" });
  await assert.rejects(resolvePortalLogin({ identifier: student.email, enrollments: [enrollment] }, async () => { throw error; }), (failure) => {
    assert.equal(failure.studentId, student.id);
    assert.deepEqual(failure.enrollments, [enrollment]);
    return true;
  });
  assert.throws(() => requirePortalStudent({ student: { fullName: "Unverified" } }), /confirm your portal session/);
});

test("portal transport uses same-origin cookies and never trusts a caller-supplied action", async () => {
  let request;
  const response = await portalRequest("restore", { action: "login" }, undefined, async (url, options) => {
    request = { url, ...options }; return { ok: true, json: async () => ({ student, pinRequired: true }) };
  });
  assert.equal(request.url, "/api/portal");
  assert.equal(request.credentials, "same-origin");
  assert.deepEqual(JSON.parse(request.body), { action: "restore" });
  assert.equal(response.student.id, student.id);
  await assert.rejects(portalRequest("login", {}, undefined, async () => ({ ok: false, status: 401, json: async () => ({ error: "Incorrect PIN.", code: "PIN_INVALID" }) })), (error) => error.status === 401 && error.code === "PIN_INVALID" && error.message === "Incorrect PIN.");
  await assert.rejects(portalRequest("restore", {}, undefined, async () => ({ ok: true, json: async () => null })), /could not be reached/);
});

test("profile phone handling preserves Uganda and requires a country for untagged legacy contacts", () => {
  const form = getPortalProfileForm(student);
  assert.equal(form.phoneCountry, "UG"); assert.equal(form.whatsapp, "712345678");
  assert.deepEqual(buildPortalProfilePayload(form), {
    fullName: student.fullName, email: student.email, phoneCountry: "UG", phoneNationalNumber: "712345678",
  });
  const legacy = getPortalProfileForm({ fullName: student.fullName, email: student.email, whatsapp: "08012345678" });
  assert.equal(legacy.phoneCountry, "", "a local number must not be guessed to be Nigerian");
  assert.throws(() => buildPortalProfilePayload(legacy), /Select the country code/);
  assert.equal(buildPortalProfilePayload({ ...legacy, phoneCountry: "NG" }).phoneNationalNumber, "8012345678");
});

test("name-only editing avoids contact re-verification; email and phone changes require it", () => {
  const form = getPortalProfileForm(student);
  assert.equal(portalProfileContactChanged(student, { ...form, fullName: "Corrected Learner" }), false);
  assert.equal(portalProfileContactChanged(student, { ...form, email: "LEARNER@example.test" }), false);
  assert.equal(portalProfileContactChanged(student, { ...form, email: "corrected@example.test" }), true);
  assert.equal(portalProfileContactChanged(student, { ...form, whatsapp: "712345679" }), true);
  const payload = buildPortalProfilePayload({ ...form, email: " corrected@example.test " }, "584927");
  assert.equal(payload.email, "corrected@example.test"); assert.equal(payload.pin, "584927");
  assert.deepEqual(Object.keys(payload).sort(), ["email", "fullName", "phoneCountry", "phoneNationalNumber", "pin"].sort());
  assert.equal(portalIdentifierForStudent({ whatsapp: "+256712345678" }), "+256712345678");
});

test("unchanged legacy phone remains untouched during a name or email-only profile correction", () => {
  const legacy = { ...student, phoneCountry: undefined, phoneCallingCode: undefined, phoneNationalNumber: undefined, whatsapp: "08012345678" };
  const form = { ...getPortalProfileForm(legacy), fullName: "Corrected Learner", email: "corrected@example.test" };
  assert.deepEqual(buildPortalProfilePayload(form, "", { includePhone: false }), {
    fullName: "Corrected Learner", email: "corrected@example.test",
  });
  assert.equal(portalProfileContactChanged(legacy, { ...form, email: legacy.email }, { includePhone: false }), false);
  assert.equal(portalProfileContactChanged(legacy, form, { includePhone: false }), true);
  assert.throws(() => buildPortalProfilePayload(form, "", { includePhone: true }), /Select the country code/);
  assert.equal(legacy.whatsapp, "08012345678");
});

test("foreground restore refreshes changed enrollment details without accepting another identity", async () => {
  const scope = createPortalSessionScope();
  const input = { student, pinRequired: true, isCurrent: scope.capture() };
  let action;
  const unchanged = await recheckPortalSession({ ...input, request: async (name) => {
    action = name; return { student: { ...student }, pinRequired: true };
  } });
  assert.equal(action, "restore");
  assert.deepEqual(unchanged, { stage: "unchanged" });
  const corrected = { ...student, fullName: "Corrected Learner" };
  assert.deepEqual(await recheckPortalSession({ ...input, request: async () => ({ student: corrected, pinRequired: true }) }), {
    stage: "updated", session: { student: corrected, pinRequired: true },
  });
  const otherIdentity = await recheckPortalSession({ ...input, request: async () => ({ student: { ...student, id: "another-enrollment" }, pinRequired: true }) });
  assert.equal(otherIdentity.stage, "expired");
  assert.ok(!otherIdentity.session, "a changed cookie identity must not silently replace the visible account");
});

test("foreground expiry signs out while temporary network failures retain the active session", async () => {
  const input = { student, pinRequired: true, isCurrent: () => true };
  const expired = await recheckPortalSession({ ...input, request: async () => { throw Object.assign(new Error("Session revoked"), { status: 401 }); } });
  assert.equal(expired.stage, "expired");
  const offline = await recheckPortalSession({ ...input, request: async () => { throw new Error("Network unavailable"); } });
  assert.deepEqual(offline, { stage: "error", message: "Network unavailable" });
  assert.equal(student.id, enrollment.id);
});

test("pending responses from a previous portal session cannot restore or clear the next session", async () => {
  for (const failure of [false, true]) {
    const scope = createPortalSessionScope();
    const isPreviousSession = scope.capture();
    let finish;
    const pending = recheckPortalSession({ student, pinRequired: true, isCurrent: isPreviousSession,
      request: () => new Promise((resolve, reject) => { finish = failure ? reject : resolve; }),
    });
    // Logout, then sign back into even the same enrollment: old loads/uploads
    // and restore failures must not affect this new authenticated session.
    scope.invalidate();
    const isNewSession = scope.capture();
    finish(failure ? Object.assign(new Error("Old session expired"), { status: 401 }) : { student, pinRequired: true });
    assert.deepEqual(await pending, { stage: "stale" });
    assert.equal(isPreviousSession(), false);
    assert.equal(isNewSession(), true);
  }
});

test("an aborted foreground restore cannot update a mounted portal", async () => {
  const controller = new AbortController();
  let finish;
  const pending = recheckPortalSession({ student, pinRequired: true, signal: controller.signal, isCurrent: () => true,
    request: () => new Promise((resolve) => { finish = resolve; }),
  });
  controller.abort();
  finish({ student: { ...student, fullName: "Late response" }, pinRequired: true });
  assert.deepEqual(await pending, { stage: "stale" });
});
