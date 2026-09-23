import test from "node:test";
import assert from "node:assert/strict";
import {
  findEligibleStudents, isPaidOrEnrolled, lookupStudents, restoreStudentEnrollment,
} from "../src/lms/enrollment.js";
import { resolveStudentCurriculumGroup } from "../src/lms/tracks.js";

// Synthetic contacts reproduce the reported shape without publishing student data.
const approved = {
  id: "a-earlier-application", fullName: "Example Student", status: "Approved",
  email: "earlier@example.test", whatsapp: "08000000000", track: "Virtual Assistance",
  learningMethod: "", cohortId: "july-2026",
};
const enrolled = {
  id: "z-enrolled-application", fullName: "Example Student", status: "Enrolled", paymentStatus: "Paid",
  email: "enrolled@example.test", whatsapp: approved.whatsapp, track: "Software Development",
  learningMethod: "Self-Paced Pre-recorded Videos", cohortId: "july-2026",
};

test("a shared phone resolves the enrolled programming record after an earlier approved VA application", async () => {
  const records = [approved, enrolled];
  const matches = await lookupStudents({ whatsapp: approved.whatsapp }, async (field, value) =>
    records.filter((item) => item[field] === value));
  assert.deepEqual(matches, [enrolled]);
  assert.equal(resolveStudentCurriculumGroup(matches[0]), "computer-programming");
  assert.equal(matches[0].learningMethod, "Self-Paced Pre-recorded Videos");
  assert.deepEqual(findEligibleStudents([...records].reverse(), { whatsapp: approved.whatsapp }), [enrolled]);
});

test("the enrolled email works; an approved application alone cannot open a different course", () => {
  assert.deepEqual(findEligibleStudents([approved, enrolled], { email: " ENROLLED@EXAMPLE.TEST " }), [enrolled]);
  assert.deepEqual(findEligibleStudents([approved, enrolled], { email: approved.email }), []);
  assert.deepEqual(findEligibleStudents([approved, enrolled], { email: "unrelated@example.test" }), []);
});

test("a saved approved VA session refreshes to the same-cohort enrolled programming record", async () => {
  const before = structuredClone([approved, enrolled]);
  const restored = await restoreStudentEnrollment(approved, async (login) =>
    findEligibleStudents([approved, enrolled], login));
  assert.deepEqual(restored, [enrolled]);
  assert.deepEqual([approved, enrolled], before, "lookup must not rewrite enrollment or progress records");
});

test("valid saved enrollments are preserved; invalid sessions cannot silently move to another cohort", async () => {
  assert.deepEqual(await restoreStudentEnrollment(enrolled, async () => {
    assert.fail("a valid selected enrollment must not be replaced");
  }), [enrolled]);
  assert.deepEqual(await restoreStudentEnrollment(approved, async () =>
    [{ ...enrolled, cohortId: "october-2026" }]), []);
});

test("multiple real enrollments remain explicit choices, deduplicated across contact queries", async () => {
  const other = { ...enrolled, id: "other-course", track: "Data Analytics" };
  const matches = await lookupStudents({ email: enrolled.email, whatsapp: enrolled.whatsapp }, async (field, value) =>
    [approved, enrolled, other].filter((item) => item[field] === value));
  assert.equal(matches.length, 2);
  assert.deepEqual(new Set(matches.map((item) => item.id)), new Set([enrolled.id, other.id]));
  assert.equal((await restoreStudentEnrollment(approved, async () => matches)).length, 2);
});

test("legacy aliases, paid enrollment, and exact status checks work without substring false positives", () => {
  const legacy = { id: "legacy", studentEmail: "legacy@example.test", phoneNumber: "+234 800 000 0000", paymentStatus: "Paid" };
  assert.deepEqual(findEligibleStudents([legacy], { whatsapp: "2348000000000" }), [legacy]);
  assert.deepEqual(findEligibleStudents([legacy], { email: "legacy@example.test" }), [legacy]);
  for (const status of ["Approved", "Pending", "Unpaid", "Not Enrolled", "Unsuccessful", "Rejected"]) {
    assert.equal(isPaidOrEnrolled({ status }), false, status);
  }
  assert.equal(isPaidOrEnrolled({ paymentStatus: "Unpaid" }), false);
});

test("October tuition still requires enrollment, verified payment, and completed registration", () => {
  const tuition = { ...enrolled, cohortId: "october-2026", applicationType: "tuition" };
  assert.equal(isPaidOrEnrolled(tuition), false);
  assert.equal(isPaidOrEnrolled({ ...tuition, paymentVerified: true }), false);
  assert.equal(isPaidOrEnrolled({ ...tuition, paymentVerified: true, registrationStatus: "submitted" }), true);
  assert.equal(isPaidOrEnrolled({ ...tuition, status: "Approved", paymentVerified: true, registrationStatus: "submitted" }), false);
  assert.equal(isPaidOrEnrolled({ ...tuition, applicationType: "scholarship" }), true);
});
