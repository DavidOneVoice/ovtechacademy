import { CANONICAL_PROGRAMMES } from '../src/data/programmes.js';
const marker = '// OVTECH_ATTENDANCE_PIN_V1';
// Historical course spellings remain valid for old counters, but only lectureDays
// can be changed by existing browser admin screens. Marked attendance is server-only.
const tracks = [...CANONICAL_PROGRAMMES, 'Cyber Security', 'Virtual Assistance', 'Software Development (Frontend)', 'Software Development (Front-end)', 'Frontend Development', 'Front-end Development', 'Frontend Software Development', 'Front-end Software Development'];
export function attendanceRules(source) {
  if (source.includes(marker)) return source;
  const recordBlock = /match \/attendanceSessions\/\{sessionId\} \{\s*allow read, write: if true;\s*match \/records\/\{recordId\} \{\s*allow read, write: if true;\s*\}\s*\}/;
  const groupBlock = /match \/\{path=\*\*\}\/records\/\{recordId\} \{\s*allow read, write: if true;\s*\}/;
  const updateStart = 'allow update: if !request.resource.data.diff(resource.data).affectedKeys().hasAny(protectedPaymentFields())';
  if (!recordBlock.test(source) || !groupBlock.test(source) || !source.includes(updateStart) || /match\s+\/\{\w+=\*\*\}\s*\{\s*allow/.test(source)) throw new Error('Live Firestore rules differ from the reviewed rules. No rules were changed.');
  const helpers = `${marker}
    // No browser can read PIN hashes, email challenges, rate limits, or migration backups.
    match /attendanceCredentials/{id} { allow read, write: if false; }
    match /attendanceChallenges/{id} { allow read, write: if false; }
    match /attendanceRateLimits/{id} { allow read, write: if false; }
    match /academyMigrations/{path=**} { allow read, write: if false; }
    function attendanceTrackSafe(track) {
      let before = resource.data.get('attendance', {}).get(track, {});
      let after = request.resource.data.get('attendance', {}).get(track, {});
      return after.diff(before).affectedKeys().hasOnly(['lectureDays']);
    }
    function attendanceCountersSafe() {
      let before = resource.data.get('attendance', {});
      let after = request.resource.data.get('attendance', {});
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['attendance']) ||
        (after.diff(before).affectedKeys().hasOnly(${JSON.stringify(tracks)}) &&
         ${tracks.map((track) => `attendanceTrackSafe(${JSON.stringify(track)})`).join(' &&\n         ')});
    }
    `;
  return source.replace('function protectedPaymentFields()', `${helpers}function protectedPaymentFields()`)
    .replace(updateStart, `${updateStart}\n        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['attendanceMarkedSessions', 'lastAttendanceMarkedAt'])\n        && attendanceCountersSafe()`)
    .replace(recordBlock, `match /attendanceSessions/{sessionId} {
      allow read, create: if true;
      allow update, delete: if false;
      match /records/{recordId} { allow read: if true; allow write: if false; }
    }`)
    .replace(groupBlock, 'match /{path=**}/records/{recordId} { allow read: if true; allow write: if false; }');
}
