import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { canonicalAttendanceMap, attendanceStats, studentTracks, eligibleForSession, isLiveAttendanceStudent } from '../src/attendance/model.js';
import { migrateProgrammeIdentity, programmeIdentityPatch, PROGRAMME_IDENTITY_MIGRATION } from './programme-identity-migration.mjs';

const migrationPath = `academyMigrations/${PROGRAMME_IDENTITY_MIGRATION}`;
const backupPrefix = `${migrationPath}/originalProgrammeFields/`;
const NOW = new Date('2026-10-03T21:00:00Z');
const initial = () => ({
  'scholarshipApplications/learner': {
    track: 'Cyber Security', course: 'Cybersecurity', courseName: 'Cyber Security', program: 'Cyber Security',
    tracks: ['Cyber Security', 'Cybersecurity'], courses: ['Cybersecurity', 'Cyber Security'],
    enrolledCourses: ['Cyber Security', 'Web Development', 'Software Development (Frontend)', 'Software Development'],
    attendance: {
      Cybersecurity: { attendedDays: 0, lectureDays: 0 },
      'Cyber Security': { attendedDays: 9, lectureDays: 12, instructorNotes: { approved: true } },
      'Unknown Course': { legacyCount: 'retain' },
    },
    status: 'Enrolled', learningMethod: 'Live Online Classes', cohortId: 'july-2026',
    email: 'learner@example.test', courseId: 'cyber-security', fullName: 'Test Learner',
    attendanceMarkedSessions: ['cyber-security-2026-10-01'], lastAttendanceMarkedAt: 'original-time',
    paymentVerified: true, paymentReference: 'unchanged-reference', paymentAmount: 20000,
    paymentStatus: 'Paid', registrationStatus: 'submitted', createdAt: 'original-created',
  },
  'scholarshipApplications/another': {
    track: 'Data Analysis', attendance: { 'Data Analysis': { attendedDays: 2, lectureDays: 3 }, 'Data Analytics': { attendedDays: 1, lectureDays: 1 } },
    courseId: 'data-analytics', cohortId: 'october-2026',
  },
  'scholarshipApplications/canonical': { track: 'Web Development', tracks: ['Web Development', 'Software Development'], attendance: { 'Web Development': { attendedDays: 1, lectureDays: 2 } } },
  'liveSessions/legacy-replay': { track: 'Cyber Security', audienceType: 'track', isPublished: true, title: 'Original recording', youtubeUrl: 'https://youtu.be/example', attachmentUrl: 'keep-attachment', sessionDate: '2026-10-01' },
  'liveSessions/all-students': { track: 'all', audienceType: 'all', title: 'Shared recording' },
  'attendanceSessions/cyber-security-2026-10-01': { track: 'Cyber Security', trackSlug: 'cyber-security', dateKey: '2026-10-01', cohortId: 'july-2026', lectureCount: 1, accessVersion: 1 },
  'attendanceSessions/cyber-security-2026-10-01/records/learner': { studentId: 'learner', track: 'Cyber Security', dateKey: '2026-10-01', sessionId: 'cyber-security-2026-10-01', markedAt: 'original-mark', verification: 'legacy' },
  'curriculum/PB043': { curriculumGroup: 'data-analytics', course: 'Power BI', lessonId: 'PB043' },
  'lmsResources/excel': { curriculumGroup: 'data-analytics', course: 'Microsoft Excel', resourceId: 'excel' },
  'progress/learner': { completedLessonIds: ['PB043'], lastWatchedLessonId: 'PB043' },
  'studentProgress/learner': { completedLessonIds: ['PB043'] },
  'paymentOrders/order': { track: 'Cyber Security', amount: 20000 },
  'certificateProfile/learner': { track: 'Cyber Security', status: 'Approved' },
  'publicCertificates/issued': { courseOrTrack: 'Cyber Security', status: 'approved' },
  'attendanceCredentials/learner': { hash: 'do-not-change', version: 'existing-version' },
});

test('counter consolidation adds alias totals, preserves metadata and keeps genuinely different programmes separate', () => {
  const unknown = { badCounterShape: true };
  const original = {
    Cybersecurity: { attendedDays: 0, lectureDays: 0, note: { reviewed: true } },
    'Cyber Security': { attendedDays: '9', lectureDays: '12', note: { reviewed: true }, legacyFlag: true },
    'Software Development (Frontend)': { attendedDays: 2, lectureDays: 3 },
    'Software Development': { attendedDays: 1, lectureDays: 2 },
    'Web Development': { attendedDays: 4, lectureDays: 6 },
    ' Unrecognized Programme ': unknown,
  };
  const result = canonicalAttendanceMap(original);
  assert.deepEqual(result.Cybersecurity, { attendedDays: 9, lectureDays: 12, note: { reviewed: true }, legacyFlag: true });
  assert.deepEqual(result['Software Development'], { attendedDays: 3, lectureDays: 5 });
  assert.deepEqual(result['Web Development'], { attendedDays: 4, lectureDays: 6 });
  assert.equal(result[' Unrecognized Programme '], unknown);
  assert.equal(Object.hasOwn(result, 'Cyber Security'), false);
  assert.deepEqual(attendanceStats({ attendance: original }, 'Cybersecurity'), { attendedDays: 9, lectureDays: 12 });
  assert.deepEqual(canonicalAttendanceMap(result), result);
});

test('unknown attendance metadata and invalid counts are preserved by failing the affected transaction', async () => {
  for (const attendance of [
    { 'Cyber Security': { attendedDays: -1, lectureDays: 2 } },
    { 'Cyber Security': { attendedDays: 'unknown', lectureDays: 2 } },
    { 'Cyber Security': { attendedDays: 1.5, lectureDays: 2 } },
    { 'Cyber Security': { attendedDays: null, lectureDays: 2 } },
    { 'Cyber Security': new Date() },
    { 'Cyber Security': { attendedDays: Number.MAX_SAFE_INTEGER }, Cybersecurity: { attendedDays: 1 } },
    { 'Cyber Security': { attendedDays: 1, legacyNote: 'first' }, Cybersecurity: { attendedDays: 2, legacyNote: 'different' } },
  ]) {
    const data = { track: 'Cyber Security', attendance };
    const { db, docs } = memoryFirestore({ 'scholarshipApplications/invalid': data });
    await assert.rejects(migrateProgrammeIdentity(db, () => NOW), /no (counters|metadata) w(as|ere) discarded/);
    assert.deepEqual(docs.get('scholarshipApplications/invalid'), data);
    assert.equal([...docs.keys()].some((path) => path.startsWith(backupPrefix)), false);
    assert.equal(docs.get(migrationPath).completedAt, undefined);
  }
});

test('identity patches only known programme fields and keep unknown values, metadata and course identifiers', () => {
  const unknownCourse = { name: 'Custom programme', extra: 'keep' };
  const source = {
    track: 'Cyber Security', course: 'Power BI', courseName: 'Unknown Course', program: 42,
    courses: ['Cyber Security', 'Cybersecurity', unknownCourse, 'Custom', 'Custom', 'Software Development', 'Web Development'],
    tracks: 'legacy non-array', enrolledCourses: ['AI & Automation', 'AI Automation'],
    courseId: 'cyber-security', cohortId: 'july-2026', tuitionAmount: 100000,
  };
  assert.deepEqual(programmeIdentityPatch('scholarshipApplications', source), {
    track: 'Cybersecurity', courses: ['Cybersecurity', unknownCourse, 'Custom', 'Custom', 'Software Development', 'Web Development'], enrolledCourses: ['AI Automation'],
  });
  assert.deepEqual(programmeIdentityPatch('liveSessions', { track: 'all', course: 'Cyber Security' }), {});
  assert.deepEqual(programmeIdentityPatch('attendanceSessions', { track: 'Cyber Security', trackSlug: 'cyber-security' }), { track: 'Cybersecurity' });
});

test('production migration preserves all counts, record/session IDs, recording contents, enrollment/payment facts and unrelated data', async () => {
  const before = initial();
  const { db, docs } = memoryFirestore(before);
  const counts = await migrateProgrammeIdentity(db, () => NOW);
  assert.deepEqual(counts, {
    scholarshipApplications: { updated: 2, unchanged: 1, missing: 0 },
    liveSessions: { updated: 1, unchanged: 1, missing: 0 },
    attendanceSessions: { updated: 1, unchanged: 0, missing: 0 },
  });
  const learner = docs.get('scholarshipApplications/learner');
  assert.equal(learner.track, 'Cybersecurity');
  assert.deepEqual(learner.tracks, ['Cybersecurity']);
  assert.deepEqual(learner.enrolledCourses, ['Cybersecurity', 'Web Development', 'Software Development']);
  assert.deepEqual(learner.attendance, { Cybersecurity: { attendedDays: 9, lectureDays: 12, instructorNotes: { approved: true } }, 'Unknown Course': { legacyCount: 'retain' } });
  assert.deepEqual(docs.get('scholarshipApplications/another').attendance, { 'Data Analytics': { attendedDays: 3, lectureDays: 4 } });
  const learnerPatchFields = Object.keys(programmeIdentityPatch('scholarshipApplications', before['scholarshipApplications/learner']));
  for (const [field, value] of Object.entries(before['scholarshipApplications/learner'])) {
    if (!learnerPatchFields.includes(field)) assert.deepEqual(learner[field], value, `Preserve ${field}`);
  }
  for (const [path, data] of Object.entries(before)) {
    if (path === 'scholarshipApplications/learner' || path === 'scholarshipApplications/another') continue;
    const expected = path === 'liveSessions/legacy-replay' || path === 'attendanceSessions/cyber-security-2026-10-01' ? { ...data, track: 'Cybersecurity' } : data;
    assert.deepEqual(docs.get(path), expected, `Preserve ${path}`);
  }
  assert.equal([...docs.keys()].filter((path) => path.startsWith('attendanceSessions/')).length, 2);
  const backups = [...docs.entries()].filter(([path]) => path.startsWith(backupPrefix)).map(([, value]) => value);
  const backup = backups.find((value) => value.collection === 'scholarshipApplications' && value.documentId === 'learner');
  assert.equal(backup.status, 'updated');
  assert.deepEqual(backup.originalFields.attendance, before['scholarshipApplications/learner'].attendance);
  assert.equal(backup.originalFields.track, 'Cyber Security');
  assert.equal(Object.hasOwn(backup.originalFields, 'email'), false);
});

test('completed migration is idempotent and never overwrites later administrator edits', async () => {
  const { db, docs } = memoryFirestore(initial());
  await migrateProgrammeIdentity(db, () => NOW);
  await db.collection('liveSessions').doc('legacy-replay').update({ title: 'New title after migration', track: 'Web Development' });
  const learner = docs.get('scholarshipApplications/learner');
  docs.set('scholarshipApplications/learner', { ...learner, attendance: { ...learner.attendance, Cybersecurity: { ...learner.attendance.Cybersecurity, attendedDays: 10 } } });
  docs.set('scholarshipApplications/later', { track: 'Cyber Security' });
  const after = structuredClone(docs);
  const result = await migrateProgrammeIdentity(db, () => new Date(NOW.getTime() + 1000));
  assert.equal(result.alreadyComplete, true);
  assert.deepEqual(docs, after);
});

test('interrupted migration resumes fixed inventory without double merging counters or overwriting completed documents', async () => {
  const { db, docs } = memoryFirestore(initial());
  const realTransaction = db.runTransaction;
  let calls = 0;
  db.runTransaction = (callback) => {
    if (++calls === 3) throw new Error('Simulated build interruption');
    return realTransaction(callback);
  };
  await assert.rejects(migrateProgrammeIdentity(db, () => NOW), /Simulated build interruption/);
  assert.equal(docs.get('scholarshipApplications/learner').attendance.Cybersecurity.attendedDays, 9);
  assert.equal(docs.get('scholarshipApplications/another').track, 'Data Analysis');
  const processed = docs.get('scholarshipApplications/learner');
  docs.set('scholarshipApplications/learner', { ...processed, attendance: { ...processed.attendance, Cybersecurity: { ...processed.attendance.Cybersecurity, attendedDays: 10 } } });
  docs.set('scholarshipApplications/late', { track: 'Cyber Security' });
  db.runTransaction = realTransaction;
  const counts = await migrateProgrammeIdentity(db, () => new Date(NOW.getTime() + 1000));
  assert.equal(counts.scholarshipApplications.updated, 2);
  assert.equal(docs.get('scholarshipApplications/learner').attendance.Cybersecurity.attendedDays, 10);
  assert.equal(docs.get('scholarshipApplications/another').track, 'Data Analytics');
  assert.equal(docs.get('scholarshipApplications/late').track, 'Cyber Security');
  const backups = [...docs.values()].filter((value) => value.collection === 'scholarshipApplications' && value.documentId === 'learner');
  assert.equal(backups.length, 1);
  assert.equal(backups[0].originalFields.attendance['Cyber Security'].attendedDays, 9);
});

test('transaction re-read retains attendance updates made after inventory and saves their actual pre-migration values', async () => {
  const { db, docs } = memoryFirestore(initial());
  const realTransaction = db.runTransaction;
  let calls = 0;
  db.runTransaction = async (callback) => {
    if (++calls === 2) await realTransaction(async (tx) => {
      const ref = db.collection('scholarshipApplications').doc('learner');
      const data = (await tx.get(ref)).data();
      tx.update(ref, { attendance: { ...data.attendance, 'Cyber Security': { ...data.attendance['Cyber Security'], attendedDays: 10, lectureDays: 13 } }, paymentStatus: 'Updated safely' });
    });
    return realTransaction(callback);
  };
  await migrateProgrammeIdentity(db, () => NOW);
  assert.equal(docs.get('scholarshipApplications/learner').attendance.Cybersecurity.attendedDays, 10);
  assert.equal(docs.get('scholarshipApplications/learner').attendance.Cybersecurity.lectureDays, 13);
  assert.equal(docs.get('scholarshipApplications/learner').paymentStatus, 'Updated safely');
  const backup = [...docs.values()].find((value) => value.collection === 'scholarshipApplications' && value.documentId === 'learner');
  assert.equal(backup.originalFields.attendance['Cyber Security'].attendedDays, 10);
});

test('concurrent migration runs use one atomic backup/checkpoint per document and never double counts', async () => {
  const { db, docs } = memoryFirestore(initial());
  await Promise.all([migrateProgrammeIdentity(db, () => NOW), migrateProgrammeIdentity(db, () => NOW)]);
  assert.equal(docs.get('scholarshipApplications/learner').attendance.Cybersecurity.attendedDays, 9);
  assert.equal(docs.get('scholarshipApplications/another').attendance['Data Analytics'].attendedDays, 3);
  assert.equal([...docs.keys()].filter((path) => path.startsWith(backupPrefix)).length, 6);
});

test('unknown or malformed migration state stops before additional updates', async () => {
  const { db, docs } = memoryFirestore({ [migrationPath]: { startedAt: NOW, documents: {} }, 'scholarshipApplications/learner': { track: 'Cyber Security' } });
  const before = structuredClone(docs);
  await assert.rejects(migrateProgrammeIdentity(db, () => NOW), /Unexpected programme identity migration manifest/);
  assert.deepEqual(docs, before);
});

test('fallback enrollment fields normalize without allowing a conflicting secondary course or cross-cohort attendance', () => {
  const source = { course: 'Cyber Security', status: 'Enrolled', learningMethod: 'Live Online Classes', cohortId: 'july-2026' };
  assert.deepEqual(studentTracks(source), ['Cybersecurity']);
  assert.equal(isLiveAttendanceStudent(source), true);
  assert.equal(eligibleForSession(source, { track: 'Cybersecurity', cohortId: 'july-2026' }), true);
  assert.equal(eligibleForSession(source, { track: 'Cybersecurity', cohortId: 'october-2026' }), false);
  assert.deepEqual(studentTracks({ ...source, track: 'Web Development', courses: 'bad legacy shape' }), ['Web Development']);
  assert.equal(eligibleForSession({ ...source, track: 'Web Development' }, { track: 'Cybersecurity', cohortId: 'july-2026' }), false);
});
