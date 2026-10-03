import test from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_PROGRAMMES } from "../src/data/programmes.js";
import {
  buildAttendanceSummary,
  deduplicateAttendanceRecords,
  getCurriculumCourseOptions,
  getProgrammeAudienceOptions,
  getStudentProgrammeNames,
  groupCurriculumItems,
  liveSessionMatchesProgramme,
  normalizeLiveSessionProgramme,
} from "../src/lms/programmeViews.js";

const student = {
  id: "example-student", track: "Cybersecurity", cohortId: "july-2026",
  attendance: {
    Cybersecurity: { attendedDays: 0, lectureDays: 0 },
    "Cyber Security": { attendedDays: 9, lectureDays: 12 },
  },
};

test("recording audiences contain each offered programme once despite legacy names", () => {
  const options = getProgrammeAudienceOptions([
    "Cyber Security", "Cybersecurity", "Data Analysis", "Data Analytics",
    "AI & Automation", "AI Automation", "Virtual Assistance", "Microsoft Excel",
  ]);
  assert.deepEqual(options, [...CANONICAL_PROGRAMMES].sort());
  assert.equal(options.filter((name) => name === "Cybersecurity").length, 1);
});

test("legacy recording targets match their programme and remain isolated from other courses", () => {
  for (const [legacy, canonical] of [
    ["Cyber Security", "Cybersecurity"], ["Data Analysis", "Data Analytics"],
    ["AI & Automation", "AI Automation"], ["Virtual Assistance", "Virtual Assistant"],
  ]) {
    assert.equal(liveSessionMatchesProgramme({ track: legacy }, { track: canonical }), true);
    assert.equal(liveSessionMatchesProgramme({ track: canonical }, { track: legacy }), true);
    assert.equal(liveSessionMatchesProgramme({ track: legacy }, { track: "Web Development" }), false);
    assert.equal(normalizeLiveSessionProgramme({ id: "saved-video", track: legacy }).track, canonical);
  }
  assert.equal(liveSessionMatchesProgramme({ track: "Software Development" }, { track: "Web Development" }), false);
  assert.deepEqual(normalizeLiveSessionProgramme({ track: "all", audienceType: "all" }), {
    track: "all", audienceType: "all",
  });
  assert.deepEqual(getStudentProgrammeNames({ track: "Cybersecurity", tracks: ["Cyber Security"] }), ["Cybersecurity"]);
});

test("curriculum subjects remain separate while programme aliases share options and headings", () => {
  const courses = getCurriculumCourseOptions(["Cyber Security", "Cybersecurity", "Microsoft Excel", "SQL", "Python"]);
  for (const subject of ["Microsoft Excel", "SQL", "Python"]) assert.ok(courses.includes(subject));
  assert.equal(courses.filter((name) => name === "Cybersecurity").length, 1);
  assert.ok(!courses.includes("Cyber Security"));
  const first = { id: "original-lesson", course: "Cyber Security", section: "Introduction" };
  const second = { id: "other-lesson", course: "Cybersecurity", section: "Introduction" };
  const sql = { id: "sql-lesson", course: "SQL", section: "Queries" };
  const grouped = groupCurriculumItems([first, second, sql]);
  assert.deepEqual(Object.keys(grouped), ["Cybersecurity", "SQL"]);
  assert.deepEqual(grouped.Cybersecurity.Introduction, [first, second]);
  assert.deepEqual(grouped.SQL.Queries, [sql]);
  assert.equal(first.course, "Cyber Security", "display grouping must preserve source documents");
});

test("legacy attendance aliases produce one Cybersecurity card with the saved 9 of 12 total", () => {
  const summary = buildAttendanceSummary({
    ...student, tracks: ["Cyber Security"],
    attendanceMarkedSessions: ["cyber-security-2026-10-01"],
  });
  assert.deepEqual(summary, [{ track: "Cybersecurity", attendedDays: 9, lectureDays: 12, percentage: 75 }]);
});

test("incomplete record history does not reduce attendance totals once course-matched proof exists", () => {
  const proof = { id: student.id, studentId: student.id, track: "Cyber Security", sessionId: "cybersecurity-2026-10-01" };
  assert.deepEqual(buildAttendanceSummary(student, [proof]), [
    { track: "Cybersecurity", attendedDays: 9, lectureDays: 12, percentage: 75 },
  ]);
  assert.deepEqual(buildAttendanceSummary(student, []), [
    { track: "Cybersecurity", attendedDays: 0, lectureDays: 0, percentage: 0 },
  ], "unproven counters must remain hidden");
});

test("same-session alias evidence counts once and repeated student record IDs across sessions count separately", () => {
  const zero = { ...student, attendance: { Cybersecurity: { attendedDays: 0, lectureDays: 3 } } };
  const common = { id: student.id, studentId: student.id, cohortId: "july-2026" };
  const records = [
    { ...common, track: "Cyber Security", parentSessionId: "actual-session-one", sessionId: "copied-wrong-id" },
    { ...common, track: "Cybersecurity", parentSessionId: "actual-session-one", sessionId: "another-wrong-id" },
    { ...common, track: "Cybersecurity", parentSessionId: "actual-session-two", sessionId: "copied-wrong-id" },
  ];
  assert.equal(deduplicateAttendanceRecords(zero, records).length, 2);
  assert.deepEqual(buildAttendanceSummary(zero, records), [
    { track: "Cybersecurity", attendedDays: 2, lectureDays: 3, percentage: 67 },
  ]);
});

test("October attendance recognizes cohort-prefixed canonical and raw legacy slugs", () => {
  for (const sessionId of ["october-2026-cybersecurity-2026-10-05", "october-2026-cyber-security-2026-10-05"]) {
    assert.equal(buildAttendanceSummary({ ...student, cohortId: "october-2026", attendanceMarkedSessions: [sessionId] })[0].attendedDays, 9);
  }
  for (const sessionId of ["cyber-security-2026-10-05", "july-2026-cybersecurity-2026-10-05", "october-2026-virtual-assistant-2026-10-05"]) {
    assert.equal(buildAttendanceSummary({ ...student, cohortId: "october-2026", attendanceMarkedSessions: [sessionId] })[0].attendedDays, 0);
  }
});

test("evidence belonging to another student, course or cohort cannot prove attendance", () => {
  for (const record of [
    { studentId: "other-student", track: "Cybersecurity" },
    { studentId: student.id, track: "Cybersecurity", cohortId: "october-2026" },
    { studentId: student.id, track: "Virtual Assistance" },
  ]) assert.equal(buildAttendanceSummary(student, [record])[0].attendedDays, 0);
});
