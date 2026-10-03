import { attendanceStats } from "../attendance/model.js";
import {
  CANONICAL_PROGRAMMES,
  getCanonicalProgrammeOptions,
  normalizeProgrammeName,
} from "../data/programmes.js";
import { LEGACY_COHORT, recordCohortId } from "../data/cohort.js";

const rawStudentProgrammes = (student) => [
  student?.track || student?.course || student?.courseName || student?.program,
  ...(Array.isArray(student?.tracks) ? student.tracks : []),
  ...(Array.isArray(student?.courses) ? student.courses : []),
  ...(Array.isArray(student?.enrolledCourses) ? student.enrolledCourses : []),
].filter((value) => typeof value === "string" && value.trim());

export const getStudentProgrammeNames = (student) =>
  [...new Set(rawStudentProgrammes(student).map(normalizeProgrammeName))];

// Academy audiences are the six offered programmes, never legacy spellings.
export const getProgrammeAudienceOptions = (values = []) =>
  getCanonicalProgrammeOptions(values).sort();

// Curriculum courses also include genuine subjects such as Excel and SQL.
export const getCurriculumCourseOptions = (values = []) =>
  [...new Set([...CANONICAL_PROGRAMMES, ...values]
    .filter((value) => typeof value === "string" && value.trim())
    .map(normalizeProgrammeName))].sort();

export const normalizeLiveSessionProgramme = (session) => ({
  ...session,
  track: !session.track || session.track === "all"
    ? session.track || "all"
    : normalizeProgrammeName(session.track),
});

export const liveSessionMatchesProgramme = (session, student) =>
  !session.track || session.track === "all" ||
  getStudentProgrammeNames(student).includes(normalizeProgrammeName(session.track));

const rawSlug = (value) => String(value || "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const markedSessionMatches = (sessionId, student, programme, rawNames) => {
  const cohortId = recordCohortId(student);
  const prefix = cohortId === LEGACY_COHORT.id ? "" : `${cohortId}-`;
  const session = String(sessionId || "");
  if (prefix && !session.startsWith(prefix)) return false;
  const slugWithDate = session.slice(prefix.length);
  const match = slugWithDate.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return false;
  const slugs = new Set([programme, ...rawNames
    .filter((name) => normalizeProgrammeName(name) === programme)].map(rawSlug));
  return slugs.has(match[1]) ||
    normalizeProgrammeName(match[1]) === programme;
};

// A record document is commonly named after the student in every session.
// Keep its parent session identity when deduplicating history and evidence.
export const deduplicateAttendanceRecords = (student, records = []) => {
  const cohortId = recordCohortId(student);
  const seen = new Set();
  return records.filter((record, index) => {
    if (record.studentId && student?.id && record.studentId !== student.id) return false;
    if (recordCohortId(record) !== cohortId) return false;
    const track = normalizeProgrammeName(record.track);
    if (!track) return false;
    const sessionIdentity = record.parentSessionId || record.sessionId ||
      (record.dateKey ? `date:${record.dateKey}` : `unknown:${index}`);
    const key = `${cohortId}|${track}|${sessionIdentity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((record) => ({ ...record, track: normalizeProgrammeName(record.track) }));
};

export const buildAttendanceSummary = (student, attendanceRecords = []) => {
  const attendance = student?.attendance || {};
  const rawNames = [...rawStudentProgrammes(student), ...Object.keys(attendance)];
  const tracks = [...new Set(rawNames.map(normalizeProgrammeName).filter(Boolean))];
  const counts = deduplicateAttendanceRecords(student, attendanceRecords)
    .reduce((totals, record) => {
      totals[record.track] = (totals[record.track] || 0) + 1;
      return totals;
    }, {});
  const markedSessions = Array.isArray(student?.attendanceMarkedSessions)
    ? student.attendanceMarkedSessions : [];
  return tracks.map((track) => {
    const stats = attendanceStats(student || {}, track);
    const recordDays = counts[track] || 0;
    const hasProof = recordDays > 0 || markedSessions.some((id) =>
      markedSessionMatches(id, student, track, rawNames));
    // Existing verified totals may predate complete record history. A missing
    // history document must not reduce a saved total once attendance is proven.
    const attendedDays = hasProof ? Number(stats.attendedDays || recordDays) : 0;
    const lectureDays = hasProof ? Math.max(Number(stats.lectureDays || 0), attendedDays) : 0;
    return {
      track,
      attendedDays,
      lectureDays,
      percentage: lectureDays ? Math.round(attendedDays / lectureDays * 100) : 0,
    };
  });
};

export const groupCurriculumItems = (items) => items.reduce((courses, item) => {
  const courseName = normalizeProgrammeName(item.course) || "General Course";
  const sectionName = item.section || item.module || `Day ${item.unlockDay || 1}`;
  if (!courses[courseName]) courses[courseName] = {};
  if (!courses[courseName][sectionName]) courses[courseName][sectionName] = [];
  courses[courseName][sectionName].push(item);
  return courses;
}, {});
