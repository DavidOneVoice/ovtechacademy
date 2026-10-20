import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { LEGACY_LIVE_RECORDING_IDS } from './legacy-live-recordings.mjs';
import { LIVE_SESSION_COHORT_MIGRATION, migrateLiveSessionCohorts } from './live-session-cohort-migration.mjs';

const NOW = new Date('2026-10-20T12:00:00Z');
const markerPath = `academyMigrations/${LIVE_SESSION_COHORT_MIGRATION}`;
const backupPath = (id) => `${markerPath}/originalCohortFields/${id}`;
const [firstId, secondId, thirdId] = LEGACY_LIVE_RECORDING_IDS;
const recording = (extra = {}) => ({
  title: 'Existing recording', sessionDate: '2026-07-06',
  createdAt: new Date('2026-07-06T12:00:00Z'), updatedAt: new Date('2026-10-01T13:00:00Z'),
  youtubeUrl: 'https://youtu.be/original-video', attachmentName: 'original.pdf', attachmentUrl: 'https://example.test/original.pdf',
  audienceType: 'track', track: 'Cybersecurity', learningMode: 'live', isPublished: true,
  unknownMetadata: { keep: ['all', 'values'] }, ...extra,
});

test('the pinned historical manifest contains exactly the 60 reviewed recording IDs', () => {
  assert.equal(LEGACY_LIVE_RECORDING_IDS.length, 60);
  assert.equal(new Set(LEGACY_LIVE_RECORDING_IDS).size, 60);
  assert.equal(Object.isFrozen(LEGACY_LIVE_RECORDING_IDS), true);
  assert.ok(LEGACY_LIVE_RECORDING_IDS.every((id) => /^[a-zA-Z0-9]{20}$/.test(id)));
  const fingerprint = createHash('sha256').update([...LEGACY_LIVE_RECORDING_IDS].sort().join('\n')).digest('hex');
  assert.equal(fingerprint, '9a9497fb3352ab07baba282710e71b30adc53d8728d544f46101b67a99ece65f');
});

test('only cohortId is added to known historical recordings; all contents, IDs, dates, timestamps and unrelated data remain identical', async () => {
  const original = recording();
  const shared = recording({ audienceType: 'all', track: 'all', learningMode: '' });
  const newOctober = recording({ sessionDate: '2026-07-01', createdAt: new Date('2026-07-01T12:00:00Z'), title: 'A new ID must never be inferred from dates' });
  const before = {
    [`liveSessions/${firstId}`]: original,
    [`liveSessions/${secondId}`]: shared,
    'liveSessions/new-october-id': newOctober,
    [`attendanceSessions/${firstId}`]: { track: 'Cybersecurity', dateKey: '2026-10-20' },
    'scholarshipApplications/learner': { cohortId: 'october-2026', status: 'Enrolled' },
    'progress/learner': { completedLessonIds: ['original'] },
  };
  const { db, docs } = memoryFirestore(before);
  assert.deepEqual(await migrateLiveSessionCohorts(db, () => NOW), { assigned: 2, preserved: 0, missing: 58 });
  assert.deepEqual(docs.get(`liveSessions/${firstId}`), { ...original, cohortId: 'july-2026' });
  assert.deepEqual(docs.get(`liveSessions/${secondId}`), { ...shared, cohortId: 'july-2026' });
  for (const [path, value] of Object.entries(before)) {
    if (![firstId, secondId].some((id) => path === `liveSessions/${id}`)) assert.deepEqual(docs.get(path), value);
  }
  assert.equal(docs.get(backupPath(firstId)).hadCohortId, false);
  assert.equal(Object.hasOwn(docs.get(backupPath(firstId)), 'cohortId'), false);
  assert.equal([...docs.keys()].filter((path) => path.startsWith('liveSessions/')).length, 3);
});

test('blank cohort values are backed up exactly while every explicit assignment remains unchanged', async () => {
  const values = ['', '   ', null, 'july-2026', 'october-2026', 'january-2027', 'future-custom-cohort', 0, { custom: 'preserve' }];
  const before = Object.fromEntries(values.map((value, index) => [`liveSessions/${LEGACY_LIVE_RECORDING_IDS[index]}`, recording({ cohortId: value })]));
  const { db, docs } = memoryFirestore(before);
  assert.deepEqual(await migrateLiveSessionCohorts(db, () => NOW), { assigned: 3, preserved: 6, missing: 51 });
  values.forEach((value, index) => {
    const id = LEGACY_LIVE_RECORDING_IDS[index];
    const expected = index < 3 ? 'july-2026' : value;
    assert.deepEqual(docs.get(`liveSessions/${id}`), { ...before[`liveSessions/${id}`], cohortId: expected });
    const backup = docs.get(backupPath(id));
    assert.equal(backup.hadCohortId, true); assert.deepEqual(backup.cohortId, value);
  });
});

test('cohort membership follows pinned ID evidence regardless of recording or upload date', async () => {
  const original = recording({ sessionDate: '2030-01-01', createdAt: new Date('2030-01-01T12:00:00Z') });
  const { db, docs } = memoryFirestore({ [`liveSessions/${firstId}`]: original, 'liveSessions/unreviewed-old-id': recording({ sessionDate: '2020-01-01' }) });
  await migrateLiveSessionCohorts(db, () => NOW);
  assert.equal(docs.get(`liveSessions/${firstId}`).cohortId, 'july-2026');
  assert.equal(Object.hasOwn(docs.get('liveSessions/unreviewed-old-id'), 'cohortId'), false);
});

test('transaction re-read preserves an administrator cohort assignment made after the migration manifest', async () => {
  const original = recording();
  const { db, docs } = memoryFirestore({ [`liveSessions/${firstId}`]: original });
  const realTransaction = db.runTransaction;
  let calls = 0;
  db.runTransaction = async (callback) => {
    if (++calls === 2) await realTransaction(async (tx) => {
      const ref = db.collection('liveSessions').doc(firstId);
      await tx.get(ref);
      tx.update(ref, { cohortId: 'january-2027', title: 'Concurrent administrator title' });
    });
    return realTransaction(callback);
  };
  const result = await migrateLiveSessionCohorts(db, () => NOW);
  assert.equal(result.preserved, 1); assert.equal(result.assigned, 0);
  assert.deepEqual(docs.get(`liveSessions/${firstId}`), { ...original, cohortId: 'january-2027', title: 'Concurrent administrator title' });
  assert.equal(docs.get(backupPath(firstId)).cohortId, 'january-2027');
});

test('interrupted migration resumes its frozen IDs and never repeats completed assignments or touches new IDs', async () => {
  const { db, docs } = memoryFirestore({ [`liveSessions/${firstId}`]: recording(), [`liveSessions/${secondId}`]: recording() });
  const realTransaction = db.runTransaction;
  let calls = 0;
  db.runTransaction = (callback) => {
    if (++calls === 3) throw new Error('Simulated deployment interruption');
    return realTransaction(callback);
  };
  await assert.rejects(migrateLiveSessionCohorts(db, () => NOW), /Simulated deployment interruption/);
  assert.equal(docs.get(`liveSessions/${firstId}`).cohortId, 'july-2026');
  assert.equal(Object.hasOwn(docs.get(`liveSessions/${secondId}`), 'cohortId'), false);
  const firstBackup = structuredClone(docs.get(backupPath(firstId)));
  await db.collection('liveSessions').doc(firstId).update({ cohortId: 'october-2026', title: 'Later intentional edit' });
  docs.set('liveSessions/created-after-manifest', recording());
  db.runTransaction = realTransaction;
  assert.deepEqual(await migrateLiveSessionCohorts(db, () => new Date(NOW.getTime() + 1000)), { assigned: 2, preserved: 0, missing: 58 });
  assert.equal(docs.get(`liveSessions/${firstId}`).cohortId, 'october-2026');
  assert.equal(docs.get(`liveSessions/${secondId}`).cohortId, 'july-2026');
  assert.equal(Object.hasOwn(docs.get('liveSessions/created-after-manifest'), 'cohortId'), false);
  assert.deepEqual(docs.get(backupPath(firstId)), firstBackup);
});

test('completed reruns preserve later edits and do not claim a missing historical ID recreated afterward', async () => {
  const { db, docs } = memoryFirestore({ [`liveSessions/${firstId}`]: recording() });
  await migrateLiveSessionCohorts(db, () => NOW);
  await db.collection('liveSessions').doc(firstId).update({ cohortId: 'october-2026', title: 'New title after completion' });
  docs.set(`liveSessions/${thirdId}`, recording({ title: 'A recreated ID' }));
  const before = structuredClone(docs);
  const result = await migrateLiveSessionCohorts(db, () => new Date(NOW.getTime() + 1000));
  assert.equal(result.alreadyComplete, true);
  assert.deepEqual(docs, before);
  assert.equal(docs.get(backupPath(thirdId)).status, 'missing');
});

test('concurrent migration runs share one atomic checkpoint for each historical ID', async () => {
  const { db, docs } = memoryFirestore({ [`liveSessions/${firstId}`]: recording(), [`liveSessions/${secondId}`]: recording({ cohortId: 'october-2026' }) });
  const results = await Promise.all([migrateLiveSessionCohorts(db, () => NOW), migrateLiveSessionCohorts(db, () => NOW)]);
  for (const result of results) assert.deepEqual(result, { assigned: 1, preserved: 1, missing: 58 });
  assert.equal([...docs.keys()].filter((path) => path.startsWith(`${markerPath}/originalCohortFields/`)).length, 60);
  assert.equal(docs.get(backupPath(firstId)).hadCohortId, false);
  assert.equal(docs.get(`liveSessions/${secondId}`).cohortId, 'october-2026');
});

test('unexpected frozen manifests cannot add unreviewed IDs or remove historical membership', async () => {
  for (const documentIds of [
    ['unreviewed-id', ...LEGACY_LIVE_RECORDING_IDS.slice(1)],
    [...LEGACY_LIVE_RECORDING_IDS.slice(0, -1)],
    [firstId, ...LEGACY_LIVE_RECORDING_IDS.slice(0, -1)],
  ]) {
    const { db, docs } = memoryFirestore({ [markerPath]: { version: 1, startedAt: NOW, documentIds }, [`liveSessions/${firstId}`]: recording(), 'liveSessions/unreviewed-id': recording() });
    const before = structuredClone(docs);
    await assert.rejects(migrateLiveSessionCohorts(db, () => NOW), /Unexpected live-recording cohort migration manifest/);
    assert.deepEqual(docs, before);
  }
});
