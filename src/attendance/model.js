import courses from '../data/courses.js';
import { CANONICAL_PROGRAMMES, normalizeProgrammeName } from '../data/programmes.js';
import { LEGACY_COHORT, recordCohortId } from '../data/cohort.js';

export const attendanceDate = (date = new Date()) => date.toISOString().slice(0, 10);
export const studentTracks = (student) => [...new Set([
  student?.track || student?.course || student?.courseName || student?.program,
  ...[student?.tracks, student?.courses, student?.enrolledCourses].flatMap((value) => Array.isArray(value) ? value : []),
].filter((value) => typeof value === 'string' && value.trim()).map(normalizeProgrammeName))];
export function isLiveAttendanceStudent(student, track) {
  if (student?.status !== 'Enrolled') return false;
  const name = normalizeProgrammeName(track || studentTracks(student)[0]);
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

const attendanceValueMatches = (first, second) => {
  if (Object.is(first, second)) return true;
  if (!first || !second || typeof first !== 'object' || typeof second !== 'object') return false;
  if (first instanceof Date || second instanceof Date) return first instanceof Date && second instanceof Date && first.getTime() === second.getTime();
  if (typeof first.isEqual === 'function') return first.isEqual(second);
  if (Array.isArray(first) !== Array.isArray(second) || Object.getPrototypeOf(first) !== Object.getPrototypeOf(second)) return false;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) => Object.hasOwn(second, key) && attendanceValueMatches(first[key], second[key]));
};

const attendanceCounter = (value, programme) => {
  // Some early forms saved decimal digit strings. Preserve their numeric value;
  // reject malformed, negative, fractional or unsafe counters rather than reset.
  const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid attendance counter for ${programme}; no counters were discarded.`);
  return number;
};

export function canonicalAttendanceMap(attendance) {
  const plainMap = (value) => value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  if (!plainMap(attendance)) throw new Error('Invalid attendance map; no counters were discarded.');
  const grouped = new Map();
  for (const [storedName, value] of Object.entries(attendance)) {
    const normalized = normalizeProgrammeName(storedName);
    // Unknown course keys and their metadata remain byte-for-byte unchanged.
    const programme = CANONICAL_PROGRAMMES.includes(normalized) ? normalized : storedName;
    if (!CANONICAL_PROGRAMMES.includes(normalized)) {
      grouped.set(programme, value);
      continue;
    }
    if (!plainMap(value)) throw new Error(`Invalid attendance value for ${programme}; no counters were discarded.`);
    const merged = { ...(grouped.get(programme) || {}) };
    for (const [field, fieldValue] of Object.entries(value)) {
      if (field === 'lectureDays' || field === 'attendedDays') {
        const total = (merged[field] || 0) + attendanceCounter(fieldValue, programme);
        if (!Number.isSafeInteger(total)) throw new Error(`Unsafe attendance total for ${programme}; no counters were discarded.`);
        merged[field] = total;
      } else if (Object.hasOwn(merged, field) && !attendanceValueMatches(merged[field], fieldValue)) {
        throw new Error(`Conflicting attendance metadata for ${programme}; no metadata was discarded.`);
      } else {
        // Preserve distinct metadata fields and identical shared metadata.
        merged[field] = fieldValue;
      }
    }
    grouped.set(programme, merged);
  }
  return Object.fromEntries(grouped);
}
