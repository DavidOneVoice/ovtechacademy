import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { hashPin, verifyPin, grantToken, readGrant } from './attendance-security.mjs';
import { migratePortalCredentials, PORTAL_CREDENTIAL_MIGRATION } from './portal-credential-migration.mjs';

const NOW = new Date('2026-10-03T23:00:00Z');
const markerPath = `academyMigrations/${PORTAL_CREDENTIAL_MIGRATION}`;
const backupPath = (id) => `${markerPath}/originalCredentialFields/${id}`;
const fixtureCredential = (extra = {}) => ({ salt: '1'.repeat(32), hash: '2'.repeat(128), version: 'original-version', updatedAt: 'original-time', customMetadata: { preserve: true }, ...extra });

test('backfill binds normalized primary registered email while preserving PIN hashes, versions, grants and all application fields', async () => {
  const credential = { ...await hashPin('584927'), version: 'existing-version', updatedAt: NOW, customMetadata: { preserve: true } };
  const application = { fullName: 'Test learner', email: '  Student@Example.Test  ', emailAddress: 'different@example.test', status: 'Enrolled', attendance: { Cybersecurity: { lectureDays: 12, attendedDays: 9 } }, paymentVerified: true };
  const { db, docs } = memoryFirestore({ 'attendanceCredentials/learner': credential, 'scholarshipApplications/learner': application });
  const grant = grantToken({ studentId: 'learner', sessionId: 'session', version: credential.version }, 'test-secret', NOW.getTime());
  const result = await migratePortalCredentials(db, () => NOW);
  assert.equal(result.bound, 1);
  assert.deepEqual(docs.get('attendanceCredentials/learner'), { ...credential, recoveryEmail: 'student@example.test' });
  assert.deepEqual(docs.get('scholarshipApplications/learner'), application);
  assert.equal(await verifyPin('584927', docs.get('attendanceCredentials/learner')), true);
  assert.equal(readGrant(grant, 'test-secret', NOW.getTime()).version, docs.get('attendanceCredentials/learner').version);
  const backup = docs.get(backupPath('learner'));
  assert.deepEqual(backup.originalFields, {}); assert.deepEqual(backup.absentFields, ['recoveryEmail']);
  assert.equal(Object.hasOwn(backup, 'hash'), false); assert.equal(Object.hasOwn(backup, 'salt'), false); assert.equal(Object.hasOwn(backup, 'recoveryEmail'), false);
});

test('correct alias email is used only when higher-priority registered fields are absent or blank', async () => {
  for (const [application, email] of [
    [{ emailAddress: 'Alias@Example.Test', studentEmail: 'other@example.test' }, 'alias@example.test'],
    [{ email: '   ', emailAddress: null, studentEmail: 'Last@Example.Test' }, 'last@example.test'],
  ]) {
    const { db, docs } = memoryFirestore({ 'attendanceCredentials/learner': fixtureCredential(), 'scholarshipApplications/learner': application });
    await migratePortalCredentials(db, () => NOW);
    assert.equal(docs.get('attendanceCredentials/learner').recoveryEmail, email);
    assert.deepEqual(docs.get('scholarshipApplications/learner'), application);
  }
});

test('missing or malformed primary email fails the affected document atomically instead of redirecting recovery to another mailbox', async () => {
  for (const application of [
    {}, { email: 'not-an-email', emailAddress: 'fallback@example.test' },
    { email: 42, emailAddress: 'fallback@example.test' }, { email: 'space inside@example.test' },
    { email: `${'x'.repeat(250)}@example.test` }, { email: 'control\u0000@example.test' },
  ]) {
    const credential = fixtureCredential();
    const { db, docs } = memoryFirestore({ 'attendanceCredentials/learner': credential, 'scholarshipApplications/learner': application });
    await assert.rejects(migratePortalCredentials(db, () => NOW), /registered email; no recovery address was changed/);
    assert.deepEqual(docs.get('attendanceCredentials/learner'), credential);
    assert.deepEqual(docs.get('scholarshipApplications/learner'), application);
    assert.equal(docs.has(backupPath('learner')), false);
    assert.equal(docs.get(markerPath).completedAt, undefined);
  }
});

test('existing recovery fields are excluded from the frozen target inventory and remain untouched', async () => {
  const existing = fixtureCredential({ recoveryEmail: 'Original@Example.Test' });
  const unavailable = fixtureCredential({ recoveryEmail: '' });
  const { db, docs } = memoryFirestore({ 'attendanceCredentials/bound': existing, 'attendanceCredentials/unavailable': unavailable, 'scholarshipApplications/bound': { email: 'new-public-address@example.test' } });
  const before = new Map(docs);
  const result = await migratePortalCredentials(db, () => NOW);
  assert.equal(result.bound, 0);
  assert.deepEqual(docs.get(markerPath).credentialIds, []);
  for (const [path, value] of before) assert.deepEqual(docs.get(path), value);
});

test('orphan and invalid credentials are checkpointed without inventing recovery addresses or changing their hashes', async () => {
  const orphan = fixtureCredential();
  const invalid = { hash: 'legacy-invalid', salt: 'unchanged', version: 'keep-version' };
  const { db, docs } = memoryFirestore({ 'attendanceCredentials/orphan': orphan, 'attendanceCredentials/invalid': invalid, 'scholarshipApplications/invalid': { email: 'do-not-bind@example.test' } });
  const result = await migratePortalCredentials(db, () => NOW);
  assert.equal(result.skippedMissingApplication, 1); assert.equal(result.skippedInvalidCredential, 1);
  assert.deepEqual(docs.get('attendanceCredentials/orphan'), orphan);
  assert.deepEqual(docs.get('attendanceCredentials/invalid'), invalid);
  assert.equal(docs.get(backupPath('orphan')).status, 'skippedMissingApplication');
  docs.set('scholarshipApplications/orphan', { email: 'later-recreated@example.test' });
  assert.equal((await migratePortalCredentials(db, () => NOW)).alreadyComplete, true);
  assert.equal(Object.hasOwn(docs.get('attendanceCredentials/orphan'), 'recoveryEmail'), false);
});

test('interrupted migration resumes fixed IDs without overwriting a bound recovery address or absorbing later credentials', async () => {
  const { db, docs } = memoryFirestore({
    'attendanceCredentials/first': fixtureCredential(), 'scholarshipApplications/first': { email: 'first@example.test' },
    'attendanceCredentials/second': fixtureCredential(), 'scholarshipApplications/second': { email: 'invalid' },
  });
  await assert.rejects(migratePortalCredentials(db, () => NOW), /registered email/);
  assert.equal(docs.get('attendanceCredentials/first').recoveryEmail, 'first@example.test');
  docs.set('scholarshipApplications/first', { email: 'later-public-edit@example.test' });
  docs.set('attendanceCredentials/first', { ...docs.get('attendanceCredentials/first'), version: 'later-version', recoveryEmail: 'verified-later@example.test' });
  docs.set('scholarshipApplications/second', { email: 'second@example.test' });
  docs.set('attendanceCredentials/later', fixtureCredential()); docs.set('scholarshipApplications/later', { email: 'later@example.test' });
  const result = await migratePortalCredentials(db, () => new Date(NOW.getTime() + 1000));
  assert.equal(result.bound, 2);
  assert.equal(docs.get('attendanceCredentials/first').recoveryEmail, 'verified-later@example.test');
  assert.equal(docs.get('attendanceCredentials/first').version, 'later-version');
  assert.equal(docs.get('attendanceCredentials/second').recoveryEmail, 'second@example.test');
  assert.equal(Object.hasOwn(docs.get('attendanceCredentials/later'), 'recoveryEmail'), false);
  assert.equal(docs.get(backupPath('first')).processedAt, NOW);
});

test('transaction reads preserve newer private recovery bindings and fresh credential fields written after inventory', async () => {
  for (const bindConcurrently of [false, true]) {
    const { db, docs } = memoryFirestore({ 'attendanceCredentials/learner': fixtureCredential(), 'scholarshipApplications/learner': { email: 'initial@example.test' } });
    const realTransaction = db.runTransaction;
    let calls = 0;
    db.runTransaction = async (callback) => {
      if (++calls === 2) {
        await realTransaction(async (tx) => {
          const credentialRef = db.collection('attendanceCredentials').doc('learner');
          await tx.get(credentialRef);
          tx.update(credentialRef, { hash: '3'.repeat(128), salt: '4'.repeat(32), version: 'new-version', ...(bindConcurrently ? { recoveryEmail: 'verified@example.test' } : {}) });
          tx.update(db.collection('scholarshipApplications').doc('learner'), { email: 'fresh@example.test' });
        });
      }
      return realTransaction(callback);
    };
    const result = await migratePortalCredentials(db, () => NOW);
    assert.equal(result[bindConcurrently ? 'alreadyBound' : 'bound'], 1);
    const credential = docs.get('attendanceCredentials/learner');
    assert.equal(credential.hash, '3'.repeat(128)); assert.equal(credential.salt, '4'.repeat(32)); assert.equal(credential.version, 'new-version');
    assert.equal(credential.recoveryEmail, bindConcurrently ? 'verified@example.test' : 'fresh@example.test');
  }
});

test('concurrent migration calls create one checkpoint and completed reruns do not change later values', async () => {
  const { db, docs } = memoryFirestore({ 'attendanceCredentials/learner': fixtureCredential(), 'scholarshipApplications/learner': { email: 'first@example.test' } });
  await Promise.all([migratePortalCredentials(db, () => NOW), migratePortalCredentials(db, () => NOW)]);
  assert.equal([...docs.keys()].filter((path) => path.startsWith(`${markerPath}/originalCredentialFields/`)).length, 1);
  docs.set('attendanceCredentials/learner', { ...docs.get('attendanceCredentials/learner'), recoveryEmail: 'verified-change@example.test' });
  const after = structuredClone(docs);
  assert.equal((await migratePortalCredentials(db, () => NOW)).alreadyComplete, true);
  assert.deepEqual(docs, after);
});

test('deleted target credentials are checkpointed safely and malformed manifests stop before mutations', async () => {
  const { db, docs } = memoryFirestore({ [markerPath]: { version: 1, startedAt: NOW, credentialIds: ['deleted'] } });
  assert.equal((await migratePortalCredentials(db, () => NOW)).skippedMissingCredential, 1);
  assert.equal(docs.get(backupPath('deleted')).status, 'skippedMissingCredential');
  for (const credentialIds of [['repeated', 'repeated'], ['bad/path'], 'not-an-array']) {
    const fixture = memoryFirestore({ [markerPath]: { version: 1, credentialIds }, 'attendanceCredentials/learner': fixtureCredential() });
    const before = structuredClone(fixture.docs);
    await assert.rejects(migratePortalCredentials(fixture.db, () => NOW), /Unexpected PIN recovery migration manifest/);
    assert.deepEqual(fixture.docs, before);
  }
});
