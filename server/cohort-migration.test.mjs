import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { migrateCohorts, COHORT_MIGRATION } from './cohort-migration.mjs';
import { belongsToCohort, sortCohorts, DEFAULT_COHORTS } from '../src/data/cohort.js';
test('cohort migration preserves identifiers, portal/payment facts, profiles and alumni; it is repeatable', async () => {
  const original = { status: 'Enrolled', paymentStatus: 'Paid', email: 'test@example.test', attendance: { Cybersecurity: { attendedDays: 3 } }, createdAt: '2026-07-05' };
  const { db, docs } = memoryFirestore({ 'scholarshipApplications/old': original, 'scholarshipApplications/new': { ...original, cohortId: 'october-2026' }, 'attendanceSessions/old': { track: 'Cybersecurity' }, 'certificateProfile/old': { status: 'Approved' }, 'publicAlumni/certificate': { status: 'active' }, 'progress/old': { completed: 5 } });
  await migrateCohorts(db); assert.deepEqual(docs.get('scholarshipApplications/old'), { ...original, cohortId: 'july-2026' });
  assert.equal(docs.get('scholarshipApplications/new').cohortId, 'october-2026'); assert.equal(docs.get('attendanceSessions/old').cohortId, 'july-2026');
  assert.deepEqual(docs.get('publicAlumni/certificate'), { status: 'active' }); assert.deepEqual(docs.get('certificateProfile/old'), { status: 'Approved' }); assert.deepEqual(docs.get('progress/old'), { completed: 5 });
  assert.equal(docs.get(`academyMigrations/${COHORT_MIGRATION}/originalCohortFields/applications-old`).hadCohortId, false);
  docs.set('scholarshipApplications/later', { ...original }); await migrateCohorts(db); assert.equal(docs.get('scholarshipApplications/later').cohortId, undefined);
  assert.ok(docs.has('cohorts/october-2026')); assert.ok(docs.has('cohorts/july-2026'));
});
test('a resumed migration preserves concurrently tagged records and ignores later additions', async () => {
  const { db, docs } = memoryFirestore({ [`academyMigrations/${COHORT_MIGRATION}`]: { applications: ['legacy', 'now-october'], sessions: [] }, 'scholarshipApplications/legacy': {}, 'scholarshipApplications/now-october': { cohortId: 'october-2026' }, 'scholarshipApplications/late': {} });
  await migrateCohorts(db); assert.equal(docs.get('scholarshipApplications/legacy').cohortId, 'july-2026'); assert.equal(docs.get('scholarshipApplications/now-october').cohortId, 'october-2026'); assert.equal(docs.get('scholarshipApplications/late').cohortId, undefined);
});
test('legacy fallback is July and future cohorts sort chronologically newest first', () => {
  assert.equal(belongsToCohort({}, 'july-2026'), true); assert.equal(belongsToCohort({}, 'october-2026'), false);
  assert.deepEqual(sortCohorts([...DEFAULT_COHORTS, { id: 'january-2029' }, { id: 'july-2027' }]).map((x) => x.id), ['january-2029', 'july-2027', 'october-2026', 'july-2026']);
});
