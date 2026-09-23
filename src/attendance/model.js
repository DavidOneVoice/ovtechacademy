import courses from '../data/courses.js';
import { normalizeProgrammeName } from '../data/programmes.js';
import { LEGACY_COHORT, recordCohortId } from '../data/cohort.js';

export const attendanceDate = (date = new Date()) => date.toISOString().slice(0, 10);
export const studentTracks = (student) => [...new Set([student.track, ...(student.tracks || []), ...(student.courses || []), ...(student.enrolledCourses || [])].filter((value) => typeof value === 'string').map(normalizeProgrammeName))];
export function isLiveAttendanceStudent(student, track) {
  if (student?.status !== 'Enrolled') return false;
  const name = normalizeProgrammeName(track || student.track);
  const course = courses.find((item) => item.title === name);
  if (!course || !studentTracks(student).includes(name)) return false;
  const method = String(student.learningMethod || student.enrollmentPackage || '').toLowerCase();
  // An explicit recorded-learning selection always takes precedence.
  if (/self|recorded|recording/.test(method)) return false;
  return /live/.test(method) || !course.scholarshipRecordedOnly;
}
export function eligibleForSession(student, session) {
  return recordCohortId(student) === recordCohortId(session) && isLiveAttendanceStudent(student, session.track);
}
export const trackSlug = (track) => normalizeProgrammeName(track).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const attendanceSessionId = (track, date, cohortId) => `${cohortId === LEGACY_COHORT.id ? '' : `${cohortId}-`}${trackSlug(track)}-${date}`;
export function attendanceStats(student, track) {
  const entries = Object.entries(student.attendance || {}).filter(([key]) => normalizeProgrammeName(key) === normalizeProgrammeName(track));
  return entries.reduce((total, [, value]) => ({ attendedDays: total.attendedDays + Number(value.attendedDays || 0), lectureDays: total.lectureDays + Number(value.lectureDays || 0) }), { attendedDays: 0, lectureDays: 0 });
}
