import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { createPortalService } from './portal-service.mjs';
import { hashPin, verifyPin } from './attendance-security.mjs';

const NOW = Date.parse('2026-10-06T12:00:00Z');
const PIN = '584927';
const NEXT_PIN = '684927';
const learner = {
  fullName: 'Test learner', email: 'learner@example.test', emailAddress: 'learner@example.test', studentEmail: 'learner@example.test',
  whatsapp: '+2348012345678', whatsApp: '+2348012345678', whatsappNumber: '+2348012345678', phone: '+2348012345678', phoneNumber: '+2348012345678', mobile: '+2348012345678', mobileNumber: '+2348012345678',
  phoneCountry: 'NG', phoneCallingCode: '+234', phoneNationalNumber: '8012345678',
  status: 'Enrolled', track: 'Data Analytics', courseId: 'data-analytics', learningMethod: 'One-on-One Live Classes', cohortId: 'october-2026',
  paymentVerified: true, registrationStatus: 'submitted', tuitionFee: 100000,
  attendance: { 'Data Analytics': { lectureDays: 12, attendedDays: 9 } }, attendanceMarkedSessions: ['old-session'],
  enrollmentDate: '2026-10-05', curriculumVersion: 'keep', unknownLegacyField: 'keep',
};

function fixture(extra = {}, sender) {
  const { db, docs } = memoryFirestore({
    'scholarshipApplications/main': structuredClone(learner),
    'scholarshipApplications/other': { ...structuredClone(learner), email: 'other@example.test', emailAddress: 'other@example.test', studentEmail: 'other@example.test', whatsapp: '+256772345679', phone: '+256772345679', whatsApp: '+256772345679', whatsappNumber: '+256772345679', phoneNumber: '+256772345679', mobile: '+256772345679', mobileNumber: '+256772345679' },
    'scholarshipApplications/offer': { ...structuredClone(learner), email: 'offer@example.test', emailAddress: 'offer@example.test', studentEmail: 'offer@example.test', status: 'Approved', whatsapp: '+2349012345678' },
    'scholarshipApplications/unpaid': { ...structuredClone(learner), email: 'unpaid@example.test', emailAddress: 'unpaid@example.test', studentEmail: 'unpaid@example.test', applicationType: 'tuition', paymentVerified: false },
    ...extra,
  });
  let clock = NOW;
  const emails = [];
  const service = createPortalService({ db, secret: 'portal-test-secret', now: () => clock,
    sendCode: sender || (async (email, name, code) => emails.push({ email, name, code })),
  });
  return { db, docs, service, emails, advance: (ms) => { clock += ms; } };
}
async function addPin(f, id = 'main', pin = PIN) {
  const credential = { ...await hashPin(pin), version: `${id}-version`, recoveryEmail: f.docs.get(`scholarshipApplications/${id}`).email, updatedAt: NOW };
  f.docs.set(`attendanceCredentials/${id}`, credential);
  return credential;
}
const login = (f, id = 'main', identifier = learner.email, pin) => f.service.login({ identifier, studentId: id, ...(pin ? { pin } : {}) }, 'login-ip');
const profileInput = (f, change = {}) => {
  const saved = f.docs.get('scholarshipApplications/main');
  return { fullName: saved.fullName, email: saved.email, phoneCountry: saved.phoneCountry, phoneNationalNumber: saved.phoneNationalNumber, ...change };
};
const expectedPrivateAbsent = (value, secrets = []) => {
  const text = JSON.stringify(value);
  for (const secret of secrets) assert.equal(text.includes(secret), false, `Response must not contain ${secret}`);
  for (const key of ['hash', 'salt', 'code', 'credentialVersion']) assert.equal(Object.prototype.hasOwnProperty.call(value.student || {}, key), false);
};

test('lookup returns enrollment choices without exposing a roster, contacts or credentials', async () => {
  const f = fixture({ 'scholarshipApplications/july': { ...structuredClone(learner), cohortId: 'july-2026', track: 'Software Development' } });
  const credential = await addPin(f);
  const response = await f.service.lookup({ identifier: '  LEARNER@EXAMPLE.TEST  ' }, 'ip');
  assert.equal(response.enrollments.length, 2);
  assert.deepEqual(new Set(response.enrollments.map((item) => item.id)), new Set(['main', 'july']));
  assert.equal(response.enrollments.find((item) => item.id === 'main').pinRequired, true);
  assert.equal(response.enrollments.find((item) => item.id === 'july').pinRequired, false);
  for (const item of response.enrollments) assert.deepEqual(Object.keys(item).sort(), ['cohortId', 'id', 'pinRequired', 'track']);
  expectedPrivateAbsent(response, [learner.email, learner.whatsapp, credential.hash, credential.salt]);
  assert.deepEqual((await f.service.lookup({ identifier: 'missing@example.test' }, 'ip')).enrollments, []);
  assert.deepEqual((await f.service.lookup({ identifier: 'offer@example.test' }, 'ip')).enrollments, []);
  assert.deepEqual((await f.service.lookup({ identifier: 'unpaid@example.test' }, 'ip')).enrollments, []);
});

test('server matches registered contact aliases exactly without inventing a country or matching a suffix', async () => {
  const f = fixture({ 'scholarshipApplications/alias': { status: 'paid', track: 'Cyber Security', cohortId: 'july-2026', studentEmail: 'ALIAS@EXAMPLE.TEST', mobileNumber: '+44 7400 123456', fullName: 'Alias learner' } });
  for (const identifier of ['ALIAS@EXAMPLE.TEST', 'alias@example.test', '+44 (7400) 123456', '447400123456']) {
    const response = await f.service.lookup({ identifier }, 'ip');
    assert.deepEqual(response.enrollments.map((item) => item.id), ['alias']);
  }
  for (const identifier of ['7400123456', '07400123456', '8012345678', '08012345678']) {
    assert.deepEqual((await f.service.lookup({ identifier }, 'ip')).enrollments, []);
  }
});

test('login binds the contact and chosen course/cohort instead of silently selecting the first match', async () => {
  const f = fixture({ 'scholarshipApplications/july': { ...structuredClone(learner), cohortId: 'july-2026', track: 'Software Development' } });
  await addPin(f);
  await assert.rejects(f.service.login({ identifier: learner.email, pin: PIN }, 'ip'));
  await assert.rejects(login(f, 'other', learner.email, PIN));
  await assert.rejects(login(f, 'main', 'other@example.test', PIN));
  await assert.rejects(login(f));
  await assert.rejects(login(f, 'main', learner.email, '999998'));
  const chosen = await login(f, 'july');
  assert.equal(chosen.student.id, 'july');
  assert.equal(chosen.student.cohortId, 'july-2026');
  assert.equal(chosen.student.track, 'Software Development');
  assert.equal(chosen.pinRequired, false);
  const secured = await login(f, 'main', '2348012345678', PIN);
  assert.equal(secured.student.id, 'main');
  assert.equal(secured.pinRequired, true);
});

test('sessions are opaque, stored only under keyed tokens, restored fresh, revoked and expiring', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const response = await login(f, 'main', learner.email, PIN);
  assert.match(response.sessionToken, /^[a-f0-9]{64}$/);
  const sessions = [...f.docs.entries()].filter(([path]) => path.startsWith('portalSessions/'));
  assert.equal(sessions.length, 1);
  assert.equal(JSON.stringify(sessions).includes(response.sessionToken), false);
  expectedPrivateAbsent(response, [credential.hash, credential.salt]);
  f.docs.set('scholarshipApplications/main', { ...f.docs.get('scholarshipApplications/main'), fullName: 'Updated externally' });
  assert.equal((await f.service.restore(response.sessionToken)).student.fullName, 'Updated externally');
  await assert.rejects(f.service.restore(response.sessionToken + '0'));
  await f.service.logout(response.sessionToken);
  await assert.rejects(f.service.restore(response.sessionToken));
  const fresh = await login(f, 'main', learner.email, PIN);
  f.advance(86400001);
  await assert.rejects(f.service.restore(fresh.sessionToken));
});

test('attendance hashes are reused; resets invalidate sessions for that enrollment', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const first = await login(f, 'main', learner.email, PIN);
  const other = await login(f, 'other', 'other@example.test');
  assert.deepEqual(f.docs.get('attendanceCredentials/main'), credential);
  const request = await f.service.requestPin({}, first.sessionToken, 'reset-ip');
  assert.equal(f.emails[0].email, learner.email);
  expectedPrivateAbsent(request, [f.emails[0].code]);
  await f.service.setPin({ challenge: request.challenge, code: f.emails[0].code, pin: NEXT_PIN }, 'reset-ip');
  assert.equal(await verifyPin(NEXT_PIN, f.docs.get('attendanceCredentials/main')), true);
  assert.equal(await verifyPin(PIN, f.docs.get('attendanceCredentials/main')), false);
  await assert.rejects(f.service.restore(first.sessionToken));
  await assert.rejects(login(f, 'main', learner.email, PIN));
  assert.equal((await login(f, 'main', learner.email, NEXT_PIN)).pinRequired, true);
  assert.equal((await f.service.restore(other.sessionToken)).student.id, 'other');
  await assert.rejects(f.service.setPin({ challenge: request.challenge, code: f.emails[0].code, pin: PIN }, 'reset-ip'));
});

test('creating the first PIN invalidates older legacy sessions without moving enrollment', async () => {
  const f = fixture();
  const legacy = await login(f);
  assert.equal(legacy.pinRequired, false);
  const requested = await f.service.requestPin({}, legacy.sessionToken, 'setup-ip');
  await f.service.setPin({ challenge: requested.challenge, code: f.emails[0].code, pin: PIN }, 'setup-ip');
  await assert.rejects(f.service.restore(legacy.sessionToken));
  await assert.rejects(login(f));
  assert.equal((await login(f, 'main', learner.email, PIN)).student.cohortId, learner.cohortId);
  assert.equal(f.docs.get('scholarshipApplications/main').attendance['Data Analytics'].attendedDays, 9);
});

test('graduates and self-paced learners can use the portal and establish the same PIN', async () => {
  const f = fixture({
    'scholarshipApplications/graduate': { ...structuredClone(learner), email: 'graduate@example.test', emailAddress: 'graduate@example.test', studentEmail: 'graduate@example.test', cohortId: 'july-2026' },
    'certificateProfile/graduate': { status: 'Approved' },
    'scholarshipApplications/recorded': { ...structuredClone(learner), email: 'recorded@example.test', emailAddress: 'recorded@example.test', studentEmail: 'recorded@example.test', learningMethod: 'Self-Paced Pre-recorded Videos' },
  });
  for (const id of ['graduate', 'recorded']) {
    const email = `${id}@example.test`;
    const entry = await login(f, id, email);
    const request = await f.service.requestPin({}, entry.sessionToken, id);
    assert.equal(f.emails.at(-1).email, email);
    await f.service.setPin({ challenge: request.challenge, code: f.emails.at(-1).code, pin: PIN }, id);
    assert.equal((await login(f, id, email, PIN)).pinRequired, true);
  }
});

test('legacy profile edits canonicalize phones and update all existing aliases while preserving enrollment facts', async () => {
  const f = fixture();
  const entry = await login(f);
  const before = structuredClone(f.docs.get('scholarshipApplications/main'));
  const response = await f.service.updateProfile({ fullName: '  Updated learner  ', email: 'New@Example.test', phoneCountry: 'UG', phoneNationalNumber: '712345678' }, entry.sessionToken, 'ip');
  assert.equal(response.verificationRequired, undefined);
  assert.equal(response.student.fullName, 'Updated learner');
  const after = f.docs.get('scholarshipApplications/main');
  for (const field of ['email', 'emailAddress', 'studentEmail']) assert.equal(after[field], 'new@example.test');
  for (const field of ['whatsapp', 'whatsApp', 'whatsappNumber', 'phone', 'phoneNumber', 'mobile', 'mobileNumber']) assert.equal(after[field], '+256712345678');
  assert.equal(after.phoneCountry, 'UG');
  assert.equal(after.phoneCallingCode, '+256');
  assert.equal(after.phoneNationalNumber, '712345678');
  for (const field of ['status', 'track', 'courseId', 'cohortId', 'learningMethod', 'paymentVerified', 'registrationStatus', 'tuitionFee', 'attendance', 'attendanceMarkedSessions', 'enrollmentDate', 'curriculumVersion', 'unknownLegacyField']) assert.deepEqual(after[field], before[field]);
  assert.equal(f.emails.length, 0);
});

test('profile whitelist rejects or ignores enrollment, payment, attendance and credential injection', async () => {
  const f = fixture();
  const entry = await login(f);
  const malicious = { fullName: 'Safe new name', status: 'Paid', track: 'Cybersecurity', cohortId: 'july-2026', paymentVerified: false, tuitionFee: 0, attendance: {}, attendanceMarkedSessions: [], pinRequired: false, hash: 'injected', salt: 'injected' };
  const before = structuredClone(f.docs.get('scholarshipApplications/main'));
  try { await f.service.updateProfile(malicious, entry.sessionToken, 'ip'); } catch {}
  const after = f.docs.get('scholarshipApplications/main');
  for (const key of Object.keys(malicious).filter((key) => key !== 'fullName')) assert.deepEqual(after[key], before[key]);
  assert.equal(f.docs.has('attendanceCredentials/main'), false);
});

test('a PIN holder can change a name directly but contact changes require current PIN and email proof', async () => {
  const f = fixture();
  await addPin(f);
  const entry = await login(f, 'main', learner.email, PIN);
  await f.service.updateProfile(profileInput(f, { fullName: 'New name' }), entry.sessionToken, 'ip');
  assert.equal(f.emails.length, 0);
  const edits = profileInput(f, { email: 'new@example.test', phoneCountry: 'UG', phoneNationalNumber: '712345678' });
  await assert.rejects(f.service.updateProfile(edits, entry.sessionToken, 'ip'));
  await assert.rejects(f.service.updateProfile({ ...edits, pin: '999998' }, entry.sessionToken, 'ip'));
  const pending = await f.service.updateProfile({ ...edits, pin: PIN }, entry.sessionToken, 'ip');
  assert.equal(pending.verificationRequired, true);
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].email, edits.email);
  assert.equal(f.docs.get('scholarshipApplications/main').email, learner.email);
  assert.equal(f.docs.get('scholarshipApplications/main').whatsapp, learner.whatsapp);
  expectedPrivateAbsent(pending, [f.emails[0].code, PIN]);
  await assert.rejects(f.service.verifyProfile({ challenge: pending.challenge, code: '000000' }, entry.sessionToken, 'ip'));
  const result = await f.service.verifyProfile({ challenge: pending.challenge, code: f.emails[0].code }, entry.sessionToken, 'ip');
  assert.equal(result.student.email, edits.email);
  assert.equal(result.student.whatsapp, '+256712345678');
  assert.equal(result.student.fullName, 'New name');
  await assert.rejects(f.service.verifyProfile({ challenge: pending.challenge, code: f.emails[0].code }, entry.sessionToken, 'ip'));
});

test('contact verification is bound to the original session and rejected after logout, expiry or PIN reset', async () => {
  for (const mutation of ['session', 'logout', 'expire', 'pin']) {
    const f = fixture();
    await addPin(f);
    const entry = await login(f, 'main', learner.email, PIN);
    const pending = await f.service.updateProfile(profileInput(f, { email: 'new@example.test', pin: PIN }), entry.sessionToken, 'ip');
    const code = f.emails[0].code;
    let token = entry.sessionToken;
    if (mutation === 'session') token = (await login(f, 'main', learner.email, PIN)).sessionToken;
    if (mutation === 'logout') await f.service.logout(token);
    if (mutation === 'expire') f.advance(600001);
    if (mutation === 'pin') f.docs.set('attendanceCredentials/main', { ...f.docs.get('attendanceCredentials/main'), version: 'reset-version' });
    await assert.rejects(f.service.verifyProfile({ challenge: pending.challenge, code }, token, 'ip'));
    assert.equal(f.docs.get('scholarshipApplications/main').email, learner.email);
  }
});

test('contact verification detects stale contacts and concurrent requests apply exactly once', async () => {
  const stale = fixture();
  await addPin(stale);
  const entry = await login(stale, 'main', learner.email, PIN);
  const pending = await stale.service.updateProfile(profileInput(stale, { email: 'new@example.test', pin: PIN }), entry.sessionToken, 'ip');
  stale.docs.set('scholarshipApplications/main', { ...stale.docs.get('scholarshipApplications/main'), email: 'changed@example.test' });
  await assert.rejects(stale.service.verifyProfile({ challenge: pending.challenge, code: stale.emails[0].code }, entry.sessionToken, 'ip'));
  assert.equal(stale.docs.get('scholarshipApplications/main').email, 'changed@example.test');
  const f = fixture();
  await addPin(f);
  const logged = await login(f, 'main', learner.email, PIN);
  const request = await f.service.updateProfile(profileInput(f, { email: 'new@example.test', pin: PIN }), logged.sessionToken, 'ip');
  const results = await Promise.allSettled([1, 2].map(() => f.service.verifyProfile({ challenge: request.challenge, code: f.emails[0].code }, logged.sessionToken, 'ip')));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(f.docs.get('scholarshipApplications/main').email, 'new@example.test');
});

test('failed profile verification email cleans only its new challenge and preserves the PIN and contacts', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const entry = await login(f, 'main', learner.email, PIN);
  const existing = await f.service.updateProfile(profileInput(f, { email: 'first@example.test', pin: PIN }), entry.sessionToken, 'first-ip');
  const existingDocuments = new Map([...f.docs].filter(([path]) => path.includes('Challenges/')).map(([path, value]) => [path, structuredClone(value)]));
  assert.equal(existingDocuments.size, 1);
  const unavailable = createPortalService({ db: f.db, secret: 'portal-test-secret', now: () => NOW, sendCode: async () => { throw new Error('sensitive provider detail'); } });
  await assert.rejects(unavailable.updateProfile(profileInput(f, { email: 'second@example.test', pin: PIN }), entry.sessionToken, 'second-ip'), (error) => !error.message.includes('sensitive provider'));
  assert.deepEqual(new Map([...f.docs].filter(([path]) => path.includes('Challenges/'))), existingDocuments);
  assert.deepEqual(f.docs.get('attendanceCredentials/main'), credential);
  assert.equal(f.docs.get('scholarshipApplications/main').email, learner.email);
  await f.service.verifyProfile({ challenge: existing.challenge, code: f.emails[0].code }, entry.sessionToken, 'first-ip');
  assert.equal(f.docs.get('scholarshipApplications/main').email, 'first@example.test');
});

test('PIN recovery sends codes only to stored registered email and protects existing credentials on delivery failure', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const entry = await login(f, 'main', learner.email, PIN);
  await f.service.requestPin({ studentId: 'other', email: 'attacker@example.test' }, entry.sessionToken, 'ip');
  assert.equal(f.emails.length, 0);
  const pending = await f.service.requestPin({ email: learner.email, studentId: 'main' }, '', 'public-ip');
  assert.equal(f.emails.at(-1).email, learner.email);
  const stored = new Map([...f.docs].filter(([path]) => path.includes('Challenges/')).map(([path, value]) => [path, structuredClone(value)]));
  const unavailable = createPortalService({ db: f.db, secret: 'portal-test-secret', now: () => NOW, sendCode: async () => { throw new Error('email service rejected'); } });
  await assert.rejects(unavailable.requestPin({ email: learner.email, studentId: 'main' }, '', 'failed-ip'));
  assert.deepEqual(new Map([...f.docs].filter(([path]) => path.includes('Challenges/'))), stored);
  assert.deepEqual(f.docs.get('attendanceCredentials/main'), credential);
  assert.equal(await verifyPin(PIN, f.docs.get('attendanceCredentials/main')), true);
  const count = f.emails.length;
  await f.service.requestPin({ email: 'attacker@example.test', studentId: 'main' }, '', 'unknown-ip');
  assert.equal(f.emails.length, count);
  expectedPrivateAbsent(pending, f.emails.map(({ code }) => code));
});

test('OTP guessing locks challenges and invalid PINs, expired codes and tampering never save credentials', async () => {
  const f = fixture();
  const request = await f.service.requestPin({ email: learner.email, studentId: 'main' }, '', 'ip');
  for (const pin of ['111111', '123456', 'abc123', '123']) await assert.rejects(f.service.setPin({ challenge: request.challenge, code: f.emails[0].code, pin }, 'ip'));
  assert.equal(f.docs.has('attendanceCredentials/main'), false);
  for (let i = 0; i < 5; i++) await assert.rejects(f.service.setPin({ challenge: request.challenge, code: '000000', pin: PIN }, 'ip'));
  await assert.rejects(f.service.setPin({ challenge: request.challenge, code: f.emails[0].code, pin: PIN }, 'ip'));
  await assert.rejects(f.service.setPin({ challenge: 'forged', code: f.emails[0].code, pin: PIN }, 'ip'));
  assert.equal(f.docs.has('attendanceCredentials/main'), false);
  const fresh = await f.service.requestPin({ email: learner.email, studentId: 'main' }, '', 'ip');
  f.advance(600001);
  await assert.rejects(f.service.setPin({ challenge: fresh.challenge, code: f.emails.at(-1).code, pin: PIN }, 'ip'));
});

test('profile rejects missing country, malformed contacts and empty names without modifying saved data', async () => {
  const f = fixture();
  const entry = await login(f);
  const before = structuredClone(f.docs.get('scholarshipApplications/main'));
  for (const change of [{ fullName: ' ' }, { fullName: 'x'.repeat(201) }, { email: 'invalid' }, { phoneCountry: '', phoneNationalNumber: '8012345678' }, { phoneCountry: 'UG', phoneNationalNumber: '71234' }, { phoneCountry: 'NG', phoneNationalNumber: '+256712345678' }]) {
    await assert.rejects(f.service.updateProfile(profileInput(f, change), entry.sessionToken, 'ip'));
    assert.deepEqual(f.docs.get('scholarshipApplications/main'), before);
  }
});

test('contact collisions are rejected while existing shared enrollment contacts remain usable', async () => {
  const f = fixture({ 'scholarshipApplications/july': { ...structuredClone(learner), cohortId: 'july-2026', track: 'Software Development' } });
  const entry = await login(f);
  for (const change of [{ email: 'other@example.test' }, { phoneCountry: 'UG', phoneNationalNumber: '772345679' }]) {
    await assert.rejects(f.service.updateProfile(profileInput(f, change), entry.sessionToken, 'ip'));
    assert.equal(f.docs.get('scholarshipApplications/main').email, learner.email);
    assert.equal(f.docs.get('scholarshipApplications/main').whatsapp, learner.whatsapp);
  }
  await f.service.updateProfile({ fullName: 'Shared contacts kept', email: learner.email, phoneCountry: 'NG', phoneNationalNumber: '8012345678' }, entry.sessionToken, 'ip');
  assert.equal(f.docs.get('scholarshipApplications/main').fullName, 'Shared contacts kept');
  assert.equal(f.docs.get('scholarshipApplications/july').fullName, learner.fullName);
});

test('recovery with an ambiguous registered email requires the selected enrollment', async () => {
  const f = fixture({ 'scholarshipApplications/july': { ...structuredClone(learner), cohortId: 'july-2026', track: 'Software Development' } });
  const ambiguous = await f.service.requestPin({ email: learner.email }, '', 'ip');
  assert.equal(f.emails.length, 0);
  expectedPrivateAbsent(ambiguous);
  const chosen = await f.service.requestPin({ email: learner.email, studentId: 'july' }, '', 'ip');
  assert.equal(f.emails.length, 1);
  await f.service.setPin({ challenge: chosen.challenge, code: f.emails[0].code, pin: PIN }, 'ip');
  assert.equal(f.docs.has('attendanceCredentials/main'), false);
  assert.equal(await verifyPin(PIN, f.docs.get('attendanceCredentials/july')), true);
});

test('a credential change invalidates earlier recovery challenges and protects contacts from OTP guessing', async () => {
  const f = fixture();
  await addPin(f);
  const first = await f.service.requestPin({ email: learner.email, studentId: 'main' }, '', 'first-ip');
  const second = await f.service.requestPin({ email: learner.email, studentId: 'main' }, '', 'second-ip');
  await f.service.setPin({ challenge: second.challenge, code: f.emails[1].code, pin: NEXT_PIN }, 'second-ip');
  await assert.rejects(f.service.setPin({ challenge: first.challenge, code: f.emails[0].code, pin: PIN }, 'first-ip'));
  const entry = await login(f, 'main', learner.email, NEXT_PIN);
  const contact = await f.service.updateProfile(profileInput(f, { email: 'new@example.test', pin: NEXT_PIN }), entry.sessionToken, 'ip');
  for (let i = 0; i < 5; i++) await assert.rejects(f.service.verifyProfile({ challenge: contact.challenge, code: '000000' }, entry.sessionToken, 'ip'));
  await assert.rejects(f.service.verifyProfile({ challenge: contact.challenge, code: f.emails.at(-1).code }, entry.sessionToken, 'ip'));
  assert.equal(f.docs.get('scholarshipApplications/main').email, learner.email);
});

test('changed eligibility is enforced on restored sessions and profile writes', async () => {
  const f = fixture();
  const entry = await login(f);
  f.docs.set('scholarshipApplications/main', { ...f.docs.get('scholarshipApplications/main'), status: 'Rejected' });
  await assert.rejects(f.service.restore(entry.sessionToken));
  await assert.rejects(f.service.updateProfile(profileInput(f, { fullName: 'Unauthorized' }), entry.sessionToken, 'ip'));
  assert.equal(f.docs.get('scholarshipApplications/main').fullName, learner.fullName);
});

test('PIN guessing is limited by enrollment across IP changes and by platform IP across accounts', async () => {
  const f = fixture();
  await addPin(f);
  for (let i = 0; i < 8; i++) await assert.rejects(f.service.login({ identifier: learner.email, studentId: 'main', pin: '999998' }, `ip-${i}`), (error) => error.status === 403);
  await assert.rejects(f.service.login({ identifier: learner.email, studentId: 'main', pin: PIN }, 'new-ip'), (error) => error.status === 429);
  f.advance(900001);
  assert.equal((await login(f, 'main', learner.email, PIN)).student.id, 'main');
  const sharedIp = fixture();
  for (let i = 0; i < 60; i++) await assert.rejects(sharedIp.service.login({ identifier: `missing-${i}@example.test`, studentId: 'missing' }, 'shared-ip'), (error) => error.status === 403);
  await assert.rejects(sharedIp.service.login({ identifier: learner.email, studentId: 'main' }, 'shared-ip'), (error) => error.status === 429);
  assert.equal([...sharedIp.docs.keys()].some((path) => path.startsWith('portalSessions/')), false);
});

test('lookup applies both per-contact and per-IP limits before returning enrollment choices', async () => {
  const f = fixture();
  for (let i = 0; i < 30; i++) await f.service.lookup({ identifier: learner.email }, `ip-${i}`);
  await assert.rejects(f.service.lookup({ identifier: learner.email }, 'new-ip'), (error) => error.status === 429);
  f.advance(900001);
  assert.equal((await f.service.lookup({ identifier: learner.email }, 'new-ip')).enrollments[0].id, 'main');
  const sharedIp = fixture();
  for (let i = 0; i < 60; i++) await sharedIp.service.lookup({ identifier: `missing-${i}@example.test` }, 'shared-ip');
  await assert.rejects(sharedIp.service.lookup({ identifier: learner.email }, 'shared-ip'), (error) => error.status === 429);
});

test('PIN recovery uses the credential recovery address even if public profile contacts have changed', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const changed = { ...f.docs.get('scholarshipApplications/main'), email: 'attacker@example.test', emailAddress: 'attacker@example.test', studentEmail: 'attacker@example.test' };
  f.docs.set('scholarshipApplications/main', changed);
  const request = await f.service.requestPin({ studentId: 'main', email: changed.email }, '', 'ip');
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].email, credential.recoveryEmail);
  assert.notEqual(f.emails[0].email, changed.email);
  await f.service.setPin({ challenge: request.challenge, code: f.emails[0].code, pin: NEXT_PIN }, 'ip');
  assert.equal(f.docs.get('attendanceCredentials/main').recoveryEmail, credential.recoveryEmail);
  assert.equal(await verifyPin(NEXT_PIN, f.docs.get('attendanceCredentials/main')), true);
});

test('missing or invalid credential recovery address fails closed without sending to public profile contacts', async () => {
  for (const recoveryEmail of [undefined, '', 'malformed']) {
    const f = fixture();
    const credential = await addPin(f);
    if (recoveryEmail === undefined) delete credential.recoveryEmail;
    else credential.recoveryEmail = recoveryEmail;
    f.docs.set('attendanceCredentials/main', credential);
    const before = structuredClone(credential);
    try { await f.service.requestPin({ studentId: 'main', email: learner.email }, '', 'ip'); } catch (error) { assert.equal(error.status, 503); }
    assert.equal(f.emails.length, 0);
    assert.deepEqual(f.docs.get('attendanceCredentials/main'), before);
  }
});

test('verified contact changes rotate the credential version and renew only the active portal session', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const first = await login(f, 'main', learner.email, PIN);
  const second = await login(f, 'main', learner.email, PIN);
  const pending = await f.service.updateProfile(profileInput(f, { email: 'verified-new@example.test', pin: PIN }), first.sessionToken, 'ip');
  const result = await f.service.verifyProfile({ challenge: pending.challenge, code: f.emails[0].code }, first.sessionToken, 'ip');
  const saved = f.docs.get('attendanceCredentials/main');
  assert.equal(saved.hash, credential.hash);
  assert.equal(saved.salt, credential.salt);
  assert.notEqual(saved.version, credential.version);
  assert.equal(saved.recoveryEmail, 'verified-new@example.test');
  assert.match(result.sessionToken, /^[a-f0-9]{64}$/);
  assert.notEqual(result.sessionToken, first.sessionToken);
  await assert.rejects(f.service.restore(first.sessionToken));
  await assert.rejects(f.service.restore(second.sessionToken));
  assert.equal((await f.service.restore(result.sessionToken)).student.email, 'verified-new@example.test');
  assert.equal((await login(f, 'main', 'verified-new@example.test', PIN)).pinRequired, true);
});

test('phone-only verification uses fixed recovery email and retains that verified recovery address', async () => {
  const f = fixture();
  const credential = await addPin(f);
  const entry = await login(f, 'main', learner.email, PIN);
  const pending = await f.service.updateProfile(profileInput(f, { phoneCountry: 'UG', phoneNationalNumber: '712345678', pin: PIN }), entry.sessionToken, 'ip');
  assert.equal(f.emails[0].email, credential.recoveryEmail);
  await f.service.verifyProfile({ challenge: pending.challenge, code: f.emails[0].code }, entry.sessionToken, 'ip');
  assert.equal(f.docs.get('attendanceCredentials/main').recoveryEmail, credential.recoveryEmail);
  assert.equal(f.docs.get('scholarshipApplications/main').whatsapp, '+256712345678');
});

test('partial name edits preserve legacy local phone data until the learner explicitly edits their phone', async () => {
  const f = fixture();
  const original = f.docs.get('scholarshipApplications/main');
  for (const field of ['whatsapp', 'whatsApp', 'whatsappNumber', 'phone', 'phoneNumber', 'mobile', 'mobileNumber']) original[field] = '08012345678';
  for (const field of ['phoneCountry', 'phoneCallingCode', 'phoneNationalNumber']) delete original[field];
  const before = structuredClone(original);
  const entry = await login(f);
  const result = await f.service.updateProfile({ fullName: 'Edited legacy learner' }, entry.sessionToken, 'ip');
  assert.equal(result.student.fullName, 'Edited legacy learner');
  const after = f.docs.get('scholarshipApplications/main');
  for (const field of Object.keys(before).filter((field) => field !== 'fullName')) assert.deepEqual(after[field], before[field]);
  for (const field of ['phoneCountry', 'phoneCallingCode', 'phoneNationalNumber']) assert.equal(field in after, false);
  await assert.rejects(f.service.updateProfile({ phoneNationalNumber: '8012345678' }, entry.sessionToken, 'ip'));
  assert.equal(f.docs.get('scholarshipApplications/main').whatsapp, '08012345678');
});

test('an existing PIN without recovery metadata can establish a verified email only after PIN and OTP proof', async () => {
  const f = fixture();
  const credential = await addPin(f);
  delete credential.recoveryEmail;
  f.docs.set('attendanceCredentials/main', credential);
  const entry = await login(f, 'main', learner.email, PIN);
  await assert.rejects(f.service.updateProfile({ email: 'verified@example.test' }, entry.sessionToken, 'ip'));
  const pending = await f.service.updateProfile({ email: 'verified@example.test', pin: PIN }, entry.sessionToken, 'ip');
  assert.equal(f.emails[0].email, 'verified@example.test');
  assert.equal(f.docs.get('attendanceCredentials/main').recoveryEmail, undefined);
  await f.service.verifyProfile({ challenge: pending.challenge, code: f.emails[0].code }, entry.sessionToken, 'ip');
  assert.equal(f.docs.get('attendanceCredentials/main').recoveryEmail, 'verified@example.test');
  assert.equal(await verifyPin(PIN, f.docs.get('attendanceCredentials/main')), true);
});

test('malformed existing credentials require a PIN and never fall back to legacy sign-in', async () => {
  for (const credential of [{ version: 'v1' }, { hash: 'invalid', salt: 'salt', version: 'v1' }, { ...await hashPin(PIN) }]) {
    const f = fixture();
    f.docs.set('attendanceCredentials/main', credential);
    assert.equal((await f.service.lookup({ identifier: learner.email }, 'ip')).enrollments[0].pinRequired, true);
    await assert.rejects(login(f));
    await assert.rejects(login(f, 'main', learner.email, PIN));
    assert.equal([...f.docs.keys()].some((path) => path.startsWith('portalSessions/')), false);
  }
});

test('simultaneous legacy profile edits cannot assign one new contact to different enrollments', async () => {
  const f = fixture();
  const first = await login(f);
  const second = await login(f, 'other', 'other@example.test');
  const shared = 'shared-new@example.test';
  const results = await Promise.allSettled([
    f.service.updateProfile({ email: shared }, first.sessionToken, 'first-ip'),
    f.service.updateProfile({ email: shared }, second.sessionToken, 'second-ip'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failures = results.filter((result) => result.status === 'rejected');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].reason.status, 409);
  assert.equal(['main', 'other'].filter((id) => f.docs.get(`scholarshipApplications/${id}`).email === shared).length, 1);
  assert.equal(f.docs.get('scholarshipApplications/main').attendance['Data Analytics'].attendedDays, 9);
  assert.equal(f.docs.get('scholarshipApplications/other').attendance['Data Analytics'].attendedDays, 9);
});

test('simultaneous verified profile edits atomically bind a new contact to only one enrollment', async () => {
  const f = fixture();
  await addPin(f);
  await addPin(f, 'other');
  const first = await login(f, 'main', learner.email, PIN);
  const second = await login(f, 'other', 'other@example.test', PIN);
  const shared = 'shared-verified@example.test';
  const firstRequest = await f.service.updateProfile({ email: shared, pin: PIN }, first.sessionToken, 'first-ip');
  const secondRequest = await f.service.updateProfile({ email: shared, pin: PIN }, second.sessionToken, 'second-ip');
  const results = await Promise.allSettled([
    f.service.verifyProfile({ challenge: firstRequest.challenge, code: f.emails[0].code }, first.sessionToken, 'first-ip'),
    f.service.verifyProfile({ challenge: secondRequest.challenge, code: f.emails[1].code }, second.sessionToken, 'second-ip'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failures = results.filter((result) => result.status === 'rejected');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].reason.status, 409);
  assert.equal(['main', 'other'].filter((id) => f.docs.get(`scholarshipApplications/${id}`).email === shared).length, 1);
  assert.equal(['main', 'other'].filter((id) => f.docs.get(`attendanceCredentials/${id}`).recoveryEmail === shared).length, 1);
});

test('login returns the latest selected enrollment when an administrator updates it before the transaction', async () => {
  const f = fixture();
  await addPin(f);
  const transact = f.db.runTransaction;
  let changed = false;
  const updated = { fullName: 'Updated by admissions', track: 'Cybersecurity', cohortId: 'july-2026' };
  f.db.runTransaction = (callback) => transact((tx) => callback({ ...tx, get: async (ref) => {
    if (!changed && ref.path === 'scholarshipApplications/main') {
      changed = true;
      f.docs.set(ref.path, { ...f.docs.get(ref.path), ...updated });
    }
    return tx.get(ref);
  } }));
  const response = await login(f, 'main', learner.email, PIN);
  assert.equal(changed, true);
  assert.equal(response.student.id, 'main');
  for (const [field, value] of Object.entries(updated)) assert.equal(response.student[field], value);
  assert.equal(response.pinRequired, true);
  const restored = await f.service.restore(response.sessionToken);
  for (const [field, value] of Object.entries(updated)) assert.equal(restored.student[field], value);
});
