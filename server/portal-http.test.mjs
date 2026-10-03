import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortal } from './portal-http.mjs';
import { PortalError } from './portal-service.mjs';

const ORIGIN = 'https://ovtechacademy.com';
const TOKEN = 'a'.repeat(64);
const STUDENT = { id: 'main', fullName: 'Test learner', email: 'learner@example.test', track: 'Data Analytics', cohortId: 'october-2026' };
const make = (body, options = {}) => new Request(`${ORIGIN}/api/portal`, {
  method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...options.headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const cookiePair = (response) => response.headers.get('set-cookie').split(';')[0];
function fixture(overrides = {}) {
  const calls = [];
  const service = {
    lookup: async (body, ip) => { calls.push(['lookup', body, ip]); return { enrollments: [{ id: 'main', track: STUDENT.track, cohortId: STUDENT.cohortId, pinRequired: true }] }; },
    login: async (body, ip) => { calls.push(['login', body, ip]); return { student: STUDENT, pinRequired: true, sessionToken: TOKEN }; },
    restore: async (token) => { calls.push(['restore', token]); return { student: STUDENT, pinRequired: true }; },
    logout: async (token) => { calls.push(['logout', token]); return { message: 'Signed out.' }; },
    updateProfile: async (body, token, ip) => { calls.push(['updateProfile', body, token, ip]); return { student: STUDENT, pinRequired: true, message: 'Saved.' }; },
    verifyProfile: async (body, token, ip) => { calls.push(['verifyProfile', body, token, ip]); return { student: STUDENT, pinRequired: true, message: 'Verified.' }; },
    requestPin: async (body, token, ip) => { calls.push(['requestPin', body, token, ip]); return { challenge: 'b'.repeat(64), message: 'Code requested.' }; },
    setPin: async (body, ip) => { calls.push(['setPin', body, ip]); return { message: 'PIN saved.' }; },
    ...overrides,
  };
  const handle = (request, context = { ip: 'platform-ip' }) => handlePortal(request, context, {}, service);
  return { service, calls, handle };
}

test('login stores the opaque session only in a secure HTTP-only cookie and responses cannot be cached', async () => {
  const f = fixture();
  const response = await f.handle(make({ action: 'login', identifier: STUDENT.email, studentId: STUDENT.id, pin: '584927' }));
  assert.equal(response.status, 200);
  const header = response.headers.get('set-cookie');
  assert.ok(header);
  assert.match(header, new RegExp(`=${TOKEN}(?:;|$)`));
  assert.match(header, /(?:^|;)\s*HttpOnly(?:;|$)/i);
  assert.match(header, /(?:^|;)\s*Secure(?:;|$)/i);
  assert.match(header, /(?:^|;)\s*SameSite=Strict(?:;|$)/i);
  assert.match(header, /(?:^|;)\s*Path=\/api\/portal(?:;|$)/i);
  assert.match(header, /(?:^|;)\s*Max-Age=86400(?:;|$)/i);
  assert.equal(/(?:^|;)\s*Domain=/i.test(header), false);
  const payload = await response.json();
  assert.deepEqual(payload, { student: STUDENT, pinRequired: true });
  assert.equal(JSON.stringify(payload).includes(TOKEN), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('session restoration and edits use the cookie rather than tokens supplied in JSON', async () => {
  const f = fixture();
  const signedIn = await f.handle(make({ action: 'login', identifier: STUDENT.email, studentId: 'main', pin: '584927' }));
  const cookie = cookiePair(signedIn);
  for (const action of ['restore', 'updateProfile', 'verifyProfile', 'requestPin']) {
    const body = { action, sessionToken: 'forged-body-token', fullName: 'Updated', challenge: 'b'.repeat(64), code: '654321' };
    const response = await f.handle(make(body, { headers: { Cookie: cookie } }));
    assert.equal(response.status, 200);
    const call = f.calls.at(-1);
    assert.equal(call[0], action);
    assert.equal(action === 'restore' ? call[1] : call[2], TOKEN);
    if (action !== 'restore') assert.equal('action' in call[1], false);
  }
  const response = await f.handle(make({ action: 'restore', sessionToken: TOKEN }));
  if (response.status === 200) assert.notEqual(f.calls.at(-1)[1], TOKEN);
  else assert.equal(response.status, 401);
});

test('logout revokes the server session and expires the browser cookie', async () => {
  const f = fixture();
  const entry = await f.handle(make({ action: 'login' }));
  const response = await f.handle(make({ action: 'logout' }, { headers: { Cookie: cookiePair(entry) } }));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls.at(-1), ['logout', TOKEN]);
  const cleared = response.headers.get('set-cookie');
  assert.match(cleared, /(?:^|;)\s*Max-Age=0(?:;|$)/i);
  assert.match(cleared, /(?:^|;)\s*HttpOnly(?:;|$)/i);
  assert.match(cleared, /(?:^|;)\s*Secure(?:;|$)/i);
  assert.equal(cleared.includes(TOKEN), false);
});

test('cross-origin, missing-origin and non-JSON requests are blocked before invoking service', async () => {
  const f = fixture();
  for (const headers of [{ Origin: 'https://attacker.test' }, { Origin: 'https://ovtechacademy.com.attacker.test' }, { Origin: 'null' }, { 'Content-Type': 'text/plain' }, { Origin: '' }]) {
    const response = await f.handle(make({ action: 'lookup', identifier: STUDENT.email }, { headers }));
    assert.equal(response.status, 403);
  }
  assert.equal(f.calls.length, 0);
  const valid = await f.handle(make({ action: 'lookup', identifier: STUDENT.email }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
  assert.equal(valid.status, 200);
});

test('oversized declared or actual bodies, malformed JSON and unknown actions never execute service', async () => {
  const f = fixture();
  for (const request of [make({ action: 'lookup' }, { headers: { 'Content-Length': '5001' } }), make({ action: 'lookup', identifier: 'x'.repeat(5001) })]) {
    assert.equal((await f.handle(request)).status, 413);
  }
  for (const body of ['{', 'null', '[]', { action: 'unknown' }, { action: '__proto__' }, { action: 'constructor' }]) {
    assert.equal((await f.handle(make(body))).status, 400);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await f.handle(new Request(`${ORIGIN}/api/portal`, { method: 'PUT' }))).status, 405);
});

test('rate-limiting receives the platform IP rather than attacker-controlled forwarded headers', async () => {
  const f = fixture();
  const response = await f.handle(make({ action: 'lookup', identifier: STUDENT.email }, { headers: { 'X-Forwarded-For': 'attacker-selected-ip', 'X-Real-IP': 'attacker-selected-ip' } }), { ip: 'trusted-platform-ip' });
  assert.equal(response.status, 200);
  assert.equal(f.calls.at(-1)[2], 'trusted-platform-ip');
});

test('unexpected backend failures never expose contacts, PINs, OTPs or internal exception details', async () => {
  const secrets = ['learner@example.test', '584927', '654321', 'private-database-path'];
  const f = fixture({ login: async () => { throw new Error(secrets.join(' ')); } });
  const response = await f.handle(make({ action: 'login', identifier: STUDENT.email, studentId: STUDENT.id, pin: '584927' }));
  assert.equal(response.status, 503);
  const text = await response.text();
  for (const secret of secrets) assert.equal(text.includes(secret), false);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('PIN setup and recovery dispatch only the documented arguments', async () => {
  const f = fixture();
  assert.equal((await f.handle(make({ action: 'requestPin', studentId: 'main', email: STUDENT.email }))).status, 200);
  const recovery = f.calls.at(-1);
  assert.equal(recovery[0], 'requestPin');
  assert.deepEqual(recovery[1], { studentId: 'main', email: STUDENT.email });
  assert.equal(recovery[3], 'platform-ip');
  const request = { challenge: 'b'.repeat(64), code: '654321', pin: '584927' };
  assert.equal((await f.handle(make({ action: 'setPin', ...request }))).status, 200);
  assert.deepEqual(f.calls.at(-1), ['setPin', request, 'platform-ip']);
});

test('verified profile changes renew the HTTP-only cookie without putting the new token in JSON', async () => {
  const nextToken = 'c'.repeat(64);
  const f = fixture({ verifyProfile: async () => ({ student: STUDENT, pinRequired: true, message: 'Verified.', sessionToken: nextToken }) });
  const signedIn = await f.handle(make({ action: 'login' }));
  const response = await f.handle(make({ action: 'verifyProfile', challenge: 'b'.repeat(64), code: '654321' }, { headers: { Cookie: cookiePair(signedIn) } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal('sessionToken' in body, false);
  assert.equal(JSON.stringify(body).includes(nextToken), false);
  assert.match(response.headers.get('set-cookie'), new RegExp(`=${nextToken}(?:;|$)`));
  assert.match(response.headers.get('set-cookie'), /(?:^|;)\s*HttpOnly(?:;|$)/i);
});

test('duplicate, malformed and unrelated cookies cannot supply a portal session', async () => {
  const f = fixture();
  for (const cookie of [`ovtech_portal=${TOKEN}; ovtech_portal=${TOKEN}`, `ovtech_portal=${TOKEN}bad`, `some_other_cookie=${TOKEN}`, 'ovtech_portal=']) {
    const response = await f.handle(make({ action: 'restore' }, { headers: { Cookie: cookie } }));
    assert.equal(response.status, 200);
    assert.deepEqual(f.calls.at(-1), ['restore', '']);
  }
});

test('same-origin GET restores from a cookie and an unauthenticated restore clears stale cookies', async () => {
  const f = fixture();
  const entry = await f.handle(make({ action: 'login' }));
  const response = await f.handle(new Request(`${ORIGIN}/api/portal`, { headers: { Cookie: cookiePair(entry) } }));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls.at(-1), ['restore', TOKEN]);
  const unauthorized = fixture({ restore: async () => { throw new PortalError('Please sign in again.', 401, 'sign_in_required'); } });
  const failed = await unauthorized.handle(make({ action: 'restore' }, { headers: { Cookie: cookiePair(entry) } }));
  assert.equal(failed.status, 401);
  assert.match(failed.headers.get('set-cookie'), /(?:^|;)\s*Max-Age=0(?:;|$)/i);
  assert.deepEqual(await failed.json(), { error: 'Please sign in again.', code: 'sign_in_required' });
});
