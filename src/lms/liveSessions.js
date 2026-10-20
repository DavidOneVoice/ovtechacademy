import { recordCohortId } from "../data/cohort.js";
import { isPaidOrEnrolled } from "./enrollment.js";
import { liveSessionMatchesProgramme } from "./programmeViews.js";

const ENROLLMENT_PACKAGE_FIELDS = [
  "learningMethod", "package", "packageName", "mode", "enrollmentMode",
  "selectedPackage", "selectedMode", "plan",
];

export const getEnrollmentPackage = (student) =>
  ENROLLMENT_PACKAGE_FIELDS.map((field) => student?.[field]).filter(Boolean).join(" ");

export const isSelfPacedStudent = (student) => Boolean(student && isPaidOrEnrolled(student) &&
  getEnrollmentPackage(student).trim().toLowerCase().includes("pre-recorded videos"));

export const isLiveClassStudent = (student) => Boolean(student && isPaidOrEnrolled(student) &&
  getEnrollmentPackage(student).trim().toLowerCase().includes("live"));

export const hasUnselectedLearningMethod = (student) => Boolean(student && isPaidOrEnrolled(student) &&
  !getEnrollmentPackage(student).trim());

export const isInstructorLedStudent = (student) =>
  isLiveClassStudent(student) || hasUnselectedLearningMethod(student);

// Recordings always need an explicit assignment. Only the separately reviewed
// historical migration can assign old recordings to July; future unassigned
// uploads must never inherit an audience from a date or the current intake.
export const getLiveSessionCohortId = (record) => {
  const id = record?.cohortId;
  return typeof id === "string" && id !== "all" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : "";
};

export const getStudentLiveSessionQuery = (student) => {
  if (!student || !isPaidOrEnrolled(student)) return null;
  if (student.cohortId != null && typeof student.cohortId !== "string") return null;
  const cohortId = getLiveSessionCohortId({ cohortId: recordCohortId(student) });
  return cohortId ? [
    { field: "cohortId", value: cohortId },
    { field: "isPublished", value: true },
  ] : null;
};

export const liveSessionMatchesStudent = (session, student) => {
  const constraints = getStudentLiveSessionQuery(student);
  if (!session || !constraints || session.isPublished !== true) return false;
  if (getLiveSessionCohortId(session) !== constraints[0].value) return false;
  // "All students" is still restricted to the active enrollment's cohort.
  if (session.audienceType === "all") return true;
  const modeMatches = session.learningMode === "live"
    ? isInstructorLedStudent(student)
    : session.learningMode === "self-paced" ? isSelfPacedStudent(student) : true;
  return modeMatches && liveSessionMatchesProgramme(session, student);
};

export const filterLiveSessionsForStudent = (sessions, student) => sessions
  .filter((session) => liveSessionMatchesStudent(session, student))
  .sort((a, b) => String(b.sessionDate || "").localeCompare(String(a.sessionDate || "")));
