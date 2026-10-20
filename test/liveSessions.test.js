import test from "node:test";
import assert from "node:assert/strict";
import {
  filterLiveSessionsForStudent,
  getLiveSessionCohortId,
  getStudentLiveSessionQuery,
  liveSessionMatchesStudent,
} from "../src/lms/liveSessions.js";

const learner = (cohortId = "october-2026", track = "Virtual Assistant", learningMethod = "Live Online Classes") => ({
  id: "chosen-enrollment", status: "Enrolled", cohortId, track, learningMethod,
});
const recording = (cohortId = "october-2026", extra = {}) => ({
  id: "recording", cohortId, isPublished: true, audienceType: "all", track: "all", ...extra,
});

test("all-student recordings apply only to their cohort before any general audience shortcut", () => {
  const julyGeneral = recording("july-2026");
  const octoberGeneral = recording("october-2026");
  for (const course of ["Virtual Assistant", "Software Development", "Data Analytics", "Cybersecurity", "Web Development", "AI Automation"]) {
    for (const method of ["Live Online Classes", "Self-Paced Pre-recorded Videos"]) {
      assert.equal(liveSessionMatchesStudent(julyGeneral, learner("october-2026", course, method)), false);
      assert.equal(liveSessionMatchesStudent(julyGeneral, learner("july-2026", course, method)), true);
      assert.equal(liveSessionMatchesStudent(octoberGeneral, learner("october-2026", course, method)), true);
      assert.equal(liveSessionMatchesStudent(octoberGeneral, learner("july-2026", course, method)), false);
    }
  }
});

test("course recordings require both cohort and course while preserving historical aliases", () => {
  for (const [alias, course] of [["Virtual Assistance", "Virtual Assistant"], ["Data Analysis", "Data Analytics"], ["Cyber Security", "Cybersecurity"], ["Software Development (Frontend)", "Software Development"]]) {
    const session = recording("july-2026", { audienceType: "track", track: alias, learningMode: "live" });
    assert.equal(liveSessionMatchesStudent(session, learner("july-2026", course)), true);
    assert.equal(liveSessionMatchesStudent(session, learner("october-2026", course)), false);
    assert.equal(liveSessionMatchesStudent(session, learner("july-2026", "AI Automation")), false);
  }
  assert.equal(liveSessionMatchesStudent(recording("october-2026", { audienceType: "track", track: "Software Development" }), learner("october-2026", "Web Development")), false);
  assert.equal(liveSessionMatchesStudent(recording("october-2026", { audienceType: "track", track: "Virtual Assistance" }), {
    ...learner("october-2026", "Data Analytics"), enrolledCourses: ["Virtual Assistant"],
  }), true);
});

test("live and self-paced audiences keep their existing enrollment-method behavior inside one cohort", () => {
  const live = recording("october-2026", { audienceType: "mode", learningMode: "live" });
  const selfPaced = recording("october-2026", { audienceType: "mode", learningMode: "self-paced" });
  assert.equal(liveSessionMatchesStudent(live, learner()), true);
  assert.equal(liveSessionMatchesStudent(live, learner("october-2026", "Virtual Assistant", "Self-Paced Pre-recorded Videos")), false);
  assert.equal(liveSessionMatchesStudent(selfPaced, learner()), false);
  assert.equal(liveSessionMatchesStudent(selfPaced, learner("october-2026", "Virtual Assistant", "Self-Paced Pre-recorded Videos")), true);
  const missingMethod = learner("october-2026", "Software Development", "");
  assert.equal(liveSessionMatchesStudent(live, missingMethod), true);
  assert.equal(liveSessionMatchesStudent(selfPaced, missingMethod), false);
  assert.equal(liveSessionMatchesStudent(live, { ...missingMethod, packageName: "Pre-recorded videos" }), false);
  assert.equal(liveSessionMatchesStudent(selfPaced, { ...missingMethod, packageName: "Pre-recorded videos" }), true);
  assert.equal(liveSessionMatchesStudent(selfPaced, learner("july-2026", "Virtual Assistant", "Self-Paced Pre-recorded Videos")), false);
});

test("unassigned or malformed recording cohorts never inherit July, October or a future audience", () => {
  for (const cohortId of [undefined, null, "", " ", "all", "*", ["july-2026"], 2026, {}, "october-2026 "]) {
    assert.equal(getLiveSessionCohortId({ cohortId }), "");
    for (const cohort of ["july-2026", "october-2026", "january-2027"]) {
      assert.equal(liveSessionMatchesStudent(recording(cohortId, { cohortId }), learner(cohort)), false);
    }
  }
  assert.equal(liveSessionMatchesStudent({ ...recording(), cohortId: undefined }, { ...learner(), cohortId: undefined }), false);
});

test("a legacy student may access explicitly tagged July recordings and future cohorts match exact enrollment IDs", () => {
  assert.equal(liveSessionMatchesStudent(recording("july-2026"), { ...learner(), cohortId: undefined }), true);
  assert.equal(liveSessionMatchesStudent(recording("january-2027"), learner("january-2027")), true);
  assert.equal(liveSessionMatchesStudent(recording("january-2027"), learner()), false);
  assert.equal(liveSessionMatchesStudent(recording(), learner("january-2027")), false);
});

test("drafts, unverified publication states and ineligible enrollment never appear", () => {
  for (const isPublished of [false, undefined, null, "true", 1]) {
    assert.equal(liveSessionMatchesStudent(recording("october-2026", { isPublished }), learner()), false);
  }
  for (const student of [null, {}, { ...learner(), status: "Approved" }, { ...learner(), cohortId: "all" },
    ...[0, false, 2026, [], {}].map((cohortId) => ({ ...learner(), cohortId })), {
    ...learner(), applicationType: "tuition", paymentVerified: false, registrationStatus: "submitted",
  }]) {
    assert.equal(liveSessionMatchesStudent(recording(), student), false);
    assert.equal(getStudentLiveSessionQuery(student), null);
  }
});

test("recording queries include both publication and the active enrollment's cohort", () => {
  const source = [recording("july-2026"), recording(), recording("october-2026", { isPublished: false }), recording("january-2027")];
  for (const cohort of ["july-2026", "october-2026", "january-2027"]) {
    const clauses = getStudentLiveSessionQuery(learner(cohort));
    const fetched = source.filter((item) => clauses.every(({ field, value }) => item[field] === value));
    assert.deepEqual(fetched, source.filter((item) => item.cohortId === cohort && item.isPublished === true));
    assert.ok(!fetched.some((item) => item.cohortId !== cohort));
  }
});

test("displaying a newly selected or refreshed enrollment immediately hides stale course and cohort results", () => {
  const cached = [
    recording("july-2026", { id: "general-july" }),
    recording("july-2026", { id: "software-july", audienceType: "track", track: "Software Development" }),
  ];
  assert.equal(filterLiveSessionsForStudent(cached, learner("july-2026", "Software Development")).length, 2);
  assert.deepEqual(filterLiveSessionsForStudent(cached, learner("october-2026", "Software Development")), []);
  assert.deepEqual(filterLiveSessionsForStudent(cached, learner("july-2026", "Virtual Assistant")).map(({ id }) => id), ["general-july"]);
  assert.deepEqual(filterLiveSessionsForStudent(cached, null), []);
});

test("filtering preserves recording IDs, URLs, attachments and source order while sorting the visible copy", () => {
  const earlier = recording("october-2026", { id: "earlier", sessionDate: "2026-10-05", youtubeUrl: "https://youtu.be/earlier", attachmentUrl: "keep-file" });
  const later = recording("october-2026", { id: "later", sessionDate: "2026-10-19", youtubeUrl: "https://youtu.be/later" });
  const source = [earlier, later];
  const original = structuredClone(source);
  assert.deepEqual(filterLiveSessionsForStudent(source, learner()), [later, earlier]);
  assert.deepEqual(source, original);
});
