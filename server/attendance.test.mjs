import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { createAttendanceService } from './attendance-service.mjs';
import { hashPin, verifyPin, grantToken, readGrant, validPin } from './attendance-security.mjs';
import { isLiveAttendanceStudent, eligibleForSession, attendanceSessionId } from '../src/attendance/model.js';
import { handleAttendance } from '../netlify/functions/attendance.mjs';
import { attendanceRules } from './attendance-rules.mjs';
const NOW = Date.parse('2026-10-06T12:00:00Z');
const student = { fullName: 'Test learner', email: 'learner@example.test', status: 'Enrolled', track: 'Data Analytics', learningMethod: 'One-on-One Live Classes', cohortId: 'october-2026', attendance: { 'Data Analytics': { lectureDays: 1, attendedDays: 0 } } };
const session = { track: 'Data Analytics', cohortId: 'october-2026', dateKey: '2026-10-06' };
function fixture() {
  const { db, docs } = memoryFirestore({ 'scholarshipApplications/oct': { ...student }, 'scholarshipApplications/july': { ...student, cohortId: 'july-2026', email: 'july@example.test' }, 'scholarshipApplications/recorded': { ...student, learningMethod: 'Self-Paced Pre-recorded Videos', email: 'recorded@example.test' }, 'attendanceSessions/session': { ...session } });
  const emails = [];
  let clock = NOW;
  const service = createAttendanceService({ db, secret: 'test-secret', now: () => clock, sendCode: async (email, name, code) => emails.push({ email, name, code }) });
  return { db, docs, service, emails, advance: (ms) => { clock += ms; } };
}
test('all six attendance courses respect learning method, enrollment, and cohort', () => {
  for (const track of ['Data Analytics', 'Web Development', 'Software Development', 'Virtual Assistant', 'Cybersecurity', 'AI Automation']) {
    assert.equal(isLiveAttendanceStudent({ ...student, track, learningMethod: 'Live Online Classes' }, track), true);
    assert.equal(isLiveAttendanceStudent({ ...student, track, learningMethod: 'Self-Paced Pre-recorded Videos' }, track), false);
    assert.equal(isLiveAttendanceStudent({ ...student, track, status: 'Approved' }, track), false);
  }
  assert.equal(isLiveAttendanceStudent({ ...student, track: 'AI Automation', learningMethod: '' }), true);
  assert.equal(isLiveAttendanceStudent({ ...student, learningMethod: '' }), false);
  assert.equal(isLiveAttendanceStudent({ ...student, track: 'Software Development (Frontend)' }, 'Software Development'), true);
  assert.equal(eligibleForSession({ ...student, cohortId: 'july-2026' }, session), false);
  assert.notEqual(attendanceSessionId('Data Analytics', '2026-10-06', 'july-2026'), attendanceSessionId('Data Analytics', '2026-10-06', 'october-2026'));
});
test('PIN hashes are salted; signed grants reject tampering and expiry', async () => {
  const first = await hashPin('584927'), second = await hashPin('584927');
  assert.notEqual(first.hash, second.hash); assert.equal(await verifyPin('584927', first), true); assert.equal(await verifyPin('123098', first), false);
  for (const pin of ['123456', '111111', '123', 'abcdef']) assert.equal(validPin(pin), false);
  const token = grantToken({ studentId: 'a' }, 'secret', NOW);
  assert.equal(readGrant(token, 'secret', NOW).studentId, 'a'); assert.equal(readGrant(token + 'x', 'secret', NOW), null); assert.equal(readGrant(token, 'secret', NOW + 300001), null);
});
test('setup requires email proof, stores no raw PIN, consumes code and locks incorrect codes', async () => {
  const f = fixture(); const response = await f.service.requestPin({ email: student.email, studentId: 'oct' }, 'ip');
  assert.equal(f.emails.length, 1); assert.equal(JSON.stringify(response).includes(f.emails[0].code), false);
  await assert.rejects(f.service.setPin({ challenge: response.challenge, code: '000000', pin: '584927' }, 'ip'));
  assert.ok(!f.docs.has('attendanceCredentials/oct'));
  await f.service.setPin({ challenge: response.challenge, code: f.emails[0].code, pin: '584927' }, 'ip');
  assert.ok(!JSON.stringify(f.docs.get('attendanceCredentials/oct')).includes('584927'));
  await assert.rejects(f.service.setPin({ challenge: response.challenge, code: f.emails[0].code, pin: '584927' }, 'ip'));
  const locked = await f.service.requestPin({ email: student.email, studentId: 'oct' }, 'ip');
  for (let i = 0; i < 5; i++) await assert.rejects(f.service.setPin({ challenge: locked.challenge, code: '000000', pin: '584927' }, 'ip'));
  await assert.rejects(f.service.setPin({ challenge: locked.challenge, code: f.emails.at(-1).code, pin: '584927' }, 'ip'));
});
test('no public roster; PIN verification rejects wrong cohort, recorded students and guessing', async () => {
  const f = fixture();
  const info = await f.service.session('session'); assert.deepEqual(Object.keys(info).sort(), ['cohort', 'dateKey', 'track']);
  f.docs.set('attendanceCredentials/oct', { ...await hashPin('584927'), version: 'v1' });
  f.docs.set('attendanceCredentials/july', { ...await hashPin('584927'), version: 'v1' });
  f.docs.set('attendanceCredentials/recorded', { ...await hashPin('584927'), version: 'v1' });
  for (const email of ['july@example.test', 'recorded@example.test', 'missing@example.test']) await assert.rejects(f.service.verify({ sessionId: 'session', email, pin: '584927' }, 'ip'));
  for (let i = 0; i < 8; i++) await assert.rejects(f.service.verify({ sessionId: 'session', email: student.email, pin: '999998' }, 'ip'));
  await assert.rejects(f.service.verify({ sessionId: 'session', email: student.email, pin: '584927' }, 'ip'), /Too many attempts/);
});
test('real verification precedes marking, duplicate requests count once and reset invalidates grants', async () => {
  const f = fixture(); f.docs.set('attendanceCredentials/oct', { ...await hashPin('584927'), version: 'v1' });
  await assert.rejects(f.service.mark({ grant: 'forged' }, 'ip'));
  const verification = await f.service.verify({ sessionId: 'session', email: student.email, pin: '584927' }, 'ip');
  assert.equal(verification.student.fullName, student.fullName); assert.equal('email' in verification.student, false); assert.equal('whatsapp' in verification.student, false);
  const results = await Promise.all([f.service.mark({ grant: verification.grant }, 'ip'), f.service.mark({ grant: verification.grant }, 'ip')]);
  assert.equal(results.filter((r) => !r.alreadyMarked).length, 1);
  assert.equal(f.docs.get('scholarshipApplications/oct').attendance['Data Analytics'].attendedDays, 1);
  assert.equal(f.docs.get('scholarshipApplications/july').attendance['Data Analytics'].attendedDays, 0);
  assert.equal(f.docs.get('attendanceSessions/session/records/oct').cohortId, 'october-2026');
  f.docs.set('attendanceCredentials/oct', { ...f.docs.get('attendanceCredentials/oct'), version: 'v2' });
  await assert.rejects(f.service.mark({ grant: verification.grant }, 'ip'));
});
test('email failure and expired challenge fail closed; unregistered recipients receive no email', async () => {
  const f = fixture(); await f.service.requestPin({ email: 'unknown@example.test', studentId: 'oct' }, 'ip'); assert.equal(f.emails.length, 0);
  const response = await f.service.requestPin({ email: student.email, studentId: 'oct' }, 'ip'); f.advance(600001);
  await assert.rejects(f.service.setPin({ challenge: response.challenge, code: f.emails[0].code, pin: '584927' }, 'ip'));
  const unavailable = createAttendanceService({ db: f.db, secret: 'x', now: () => NOW, sendCode: async () => { throw new Error('unavailable'); } });
  await assert.rejects(unavailable.requestPin({ email: student.email, studentId: 'oct' }, 'other-ip'), /could not be sent/);
});
test('HTTP rejects cross-origin and large requests and does not expose server exceptions', async () => {
  const make = (body, origin = 'https://ovtechacademy.com') => new Request('https://ovtechacademy.com/api/attendance', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await handleAttendance(make({}, 'https://other.test'), {}, {}, {})).status, 403);
  assert.equal((await handleAttendance(make({ data: 'a'.repeat(5000) }), {}, {}, {})).status, 413);
  const failed = await handleAttendance(make({ action: 'session' }), {}, {}, { session: () => { throw new Error('sensitive internal detail'); } });
  assert.equal(failed.status, 503); assert.equal((await failed.text()).includes('sensitive'), false);
});
test('rules patch is repeatable and refuses unreviewed rule layouts', () => {
  const updated = fs.readFileSync('firestore.rules', 'utf8'); assert.equal(attendanceRules(updated), updated);
  assert.match(updated, /allow write: if false/); assert.match(updated, /attendanceMarkedSessions/);
  assert.throws(() => attendanceRules('match /{document=**} { allow read, write: if true; }'), /differ/);
});

test('graduates cannot verify or use an earlier attendance grant after completion', async () => {
  const f = fixture(); f.docs.set('attendanceCredentials/oct', { ...await hashPin('584927'), version: 'v1' });
  const verified = await f.service.verify({ sessionId: 'session', email: student.email, pin: '584927' }, 'ip');
  f.docs.set('certificateProfile/oct', { status: 'Approved' });
  await assert.rejects(f.service.mark({ grant: verified.grant }, 'ip'));
  await assert.rejects(f.service.verify({ sessionId: 'session', email: student.email, pin: '584927' }, 'ip'));
});
