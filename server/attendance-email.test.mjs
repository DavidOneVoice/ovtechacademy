import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceEmailConfiguration,
  attendanceEmailReadiness,
  AttendanceEmailError,
  createAttendanceEmailSender,
} from './attendance-email.mjs';
import { handleAttendance } from '../netlify/functions/attendance.mjs';

const configured = {
  EMAILJS_SERVICE_ID: 'srv_7f601c',
  EMAILJS_TEMPLATE_ID: 'tpl_86139b',
  EMAILJS_PUBLIC_KEY: 'pub_9187ef',
};
const recipient = 'delivery-recipient@example.test';
const code = '937481';
const privateKey = 'sec_10a01e';
const userMessage = 'The verification email could not be sent. Contact admissions for help setting up your attendance PIN.';

function assertSafeFailure(error, kind, reports, status) {
  assert.ok(error instanceof AttendanceEmailError);
  assert.equal(error.kind, kind);
  assert.equal(error.status, 503);
  assert.equal(error.message, userMessage);
  assert.deepEqual(reports, [status ? { kind, providerStatus: status } : { kind }]);
  const diagnostic = JSON.stringify({ message: error.message, kind: error.kind, reports });
  for (const sensitive of [recipient, code, privateKey, ...Object.values(configured), 'provider-raw-sentinel']) {
    assert.equal(diagnostic.includes(sensitive), false, `Failure diagnostics contain ${sensitive}`);
  }
}

test('server configuration overrides legacy public values and accepts a dedicated attendance template', () => {
  const env = {
    ...configured,
    EMAILJS_ATTENDANCE_TEMPLATE_ID: ' attendance-server-sentinel ',
    EMAILJS_PRIVATE_KEY: ` ${privateKey} `,
    VITE_EMAILJS_SERVICE_ID: 'legacy-service',
    VITE_EMAILJS_TEMPLATE_ID: 'legacy-template',
    VITE_EMAILJS_PUBLIC_KEY: 'legacy-public',
    VITE_EMAILJS_ATTENDANCE_TEMPLATE_ID: 'legacy-attendance',
    VITE_EMAILJS_PRIVATE_KEY: 'must-not-use-client-private',
  };
  assert.deepEqual(attendanceEmailConfiguration(env), {
    service: configured.EMAILJS_SERVICE_ID,
    template: 'attendance-server-sentinel',
    publicKey: configured.EMAILJS_PUBLIC_KEY,
    privateKey,
  });
  assert.deepEqual(attendanceEmailConfiguration({ ...configured }), {
    service: configured.EMAILJS_SERVICE_ID,
    template: configured.EMAILJS_TEMPLATE_ID,
    publicKey: configured.EMAILJS_PUBLIC_KEY,
    privateKey: '',
  });
  assert.deepEqual(attendanceEmailReadiness(env), { configured: true });
});

test('legacy public environment configuration remains supported without accepting a VITE private key', () => {
  const env = {
    VITE_EMAILJS_SERVICE_ID: ' legacy-service ',
    VITE_EMAILJS_TEMPLATE_ID: ' legacy-template ',
    VITE_EMAILJS_PUBLIC_KEY: ' legacy-public ',
    VITE_EMAILJS_PRIVATE_KEY: 'must-not-use-client-private',
  };
  assert.deepEqual(attendanceEmailConfiguration(env), {
    service: 'legacy-service', template: 'legacy-template', publicKey: 'legacy-public', privateKey: '',
  });
  assert.equal(attendanceEmailReadiness(env).configured, true);
  assert.equal(attendanceEmailConfiguration({ ...env, VITE_EMAILJS_ATTENDANCE_TEMPLATE_ID: 'dedicated-legacy' }).template, 'dedicated-legacy');
  assert.deepEqual(attendanceEmailReadiness({ EMAILJS_PRIVATE_KEY: privateKey }), { configured: false });
});

test('each missing required setting fails before a provider request and reports only its classification', async () => {
  for (const field of ['EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY']) {
    const env = { ...configured, [field]: '' };
    const reports = [];
    let requests = 0;
    const send = createAttendanceEmailSender({ env, report: (entry) => reports.push(entry), fetchImpl: async () => { requests++; throw new Error('Should not fetch'); } });
    await assert.rejects(send(recipient, 'Test learner', code), (error) => {
      assertSafeFailure(error, 'missing_function_configuration', reports);
      return true;
    });
    assert.equal(requests, 0);
  }
});

test('REST delivery preserves the existing email template fields and uses the optional private key only on the server', async () => {
  for (const usePrivateKey of [false, true]) {
    const env = {
      ...configured,
      EMAILJS_ATTENDANCE_TEMPLATE_ID: 'dedicated-attendance-template',
      VITE_EMAILJS_PRIVATE_KEY: 'must-not-use-client-private',
      ...(usePrivateKey ? { EMAILJS_PRIVATE_KEY: privateKey } : {}),
    };
    const requests = [], reports = [];
    const send = createAttendanceEmailSender({ env, report: (entry) => reports.push(entry), fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, text: () => { throw new Error('Do not inspect successful provider responses'); } };
    } });
    await send(recipient, 'Test learner', code);
    assert.equal(requests.length, 1);
    const [{ url, options }] = requests;
    assert.equal(url, 'https://api.emailjs.com/api/v1.0/email/send');
    assert.equal(options.method, 'POST');
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {
      service_id: configured.EMAILJS_SERVICE_ID,
      template_id: 'dedicated-attendance-template',
      user_id: configured.EMAILJS_PUBLIC_KEY,
      ...(usePrivateKey ? { accessToken: privateKey } : {}),
      template_params: {
        email: recipient,
        to_name: 'Test learner',
        subjectTitle: 'Your OVTech attendance verification code',
        mainMessage: `Your attendance PIN setup or reset code is ${code}. This code expires in 10 minutes.`,
        extraMessage: 'Do not share this code or your attendance PIN. If you did not request this, ignore this email; your current PIN has not changed.',
        ctaText: 'Open student portal',
        ctaLink: 'https://ovtechacademy.com/lms',
      },
    });
    assert.deepEqual(reports, []);
    assert.equal(options.body.includes('must-not-use-client-private'), false);
  }
});

test('provider rejection diagnostics distinguish actionable failures while excluding raw responses and secrets', async () => {
  const cases = [
    [403, 'API calls are disabled for non-browser applications', 'server_requests_disabled'],
    [403, 'Non browser requests disabled. Access denied', 'server_requests_disabled'],
    [400, 'Invalid public key or accessToken', 'authorization'],
    [401, 'Authentication required', 'authorization'],
    [403, 'Forbidden', 'authorization'],
    [403, 'Unspecified upstream rejection', 'provider_rejected'],
    [429, 'Retry later', 'rate_or_quota_limit'],
    [400, 'Monthly quota limit reached', 'rate_or_quota_limit'],
    [404, 'The template ID was not found', 'template_configuration'],
    [400, 'The Gmail service connection needs authentication', 'email_service_connection'],
    [500, 'Unspecified server failure', 'provider_rejected'],
  ];
  for (const [status, reason, kind] of cases) {
    const reports = [];
    const raw = `${reason}; provider-raw-sentinel ${recipient} ${code} ${privateKey} ${Object.values(configured).join(' ')}`;
    const send = createAttendanceEmailSender({ env: { ...configured, EMAILJS_PRIVATE_KEY: privateKey }, report: (entry) => reports.push(entry), fetchImpl: async () => ({ ok: false, status, text: async () => raw }) });
    await assert.rejects(send(recipient, 'Test learner', code), (error) => {
      assertSafeFailure(error, kind, reports, status);
      return true;
    });
  }
});

test('unreadable provider responses remain sanitized and retain their HTTP status', async () => {
  const reports = [];
  const send = createAttendanceEmailSender({ env: configured, report: (entry) => reports.push(entry), fetchImpl: async () => ({ ok: false, status: 502, text: async () => { throw new Error(`${recipient} ${privateKey}`); } }) });
  await assert.rejects(send(recipient, 'Test learner', code), (error) => {
    assertSafeFailure(error, 'provider_rejected', reports, 502);
    return true;
  });
});

test('timeout, abort and connection errors have typed sanitized failures', async () => {
  for (const [name, kind] of [['TimeoutError', 'delivery_timeout'], ['AbortError', 'delivery_timeout'], ['TypeError', 'delivery_connection_failed']]) {
    const reports = [];
    const failure = new Error(`provider-raw-sentinel ${recipient} ${code} ${privateKey}`);
    failure.name = name;
    const send = createAttendanceEmailSender({ env: configured, report: (entry) => reports.push(entry), fetchImpl: async () => { throw failure; } });
    await assert.rejects(send(recipient, 'Test learner', code), (error) => {
      assertSafeFailure(error, kind, reports);
      return true;
    });
  }
});

test('read-only attendance readiness exposes only a boolean without database, provider or attendance actions', async (t) => {
  let providerCalls = 0, serviceCalls = 0, databaseReads = 0;
  t.mock.method(globalThis, 'fetch', async () => { providerCalls++; throw new Error('Readiness must not contact the email provider'); });
  const service = new Proxy({}, { get: () => { serviceCalls++; throw new Error('Readiness must not call attendance actions'); } });
  for (const [settings, expected] of [[{}, false], [configured, true], [{ ...configured, EMAILJS_PUBLIC_KEY: '' }, false]]) {
    const env = { ...settings };
    Object.defineProperty(env, 'FIREBASE_SERVICE_ACCOUNT_JSON', { get: () => { databaseReads++; throw new Error('Readiness must not initialize the database'); } });
    const request = new Request('https://ovtechacademy.com/api/attendance', { method: 'GET' });
    for (const injection of [undefined, service]) {
      const response = await handleAttendance(request, {}, env, injection);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
      assert.deepEqual(await response.json(), { pinEmailConfigured: expected });
    }
  }
  assert.equal(providerCalls, 0);
  assert.equal(serviceCalls, 0);
  assert.equal(databaseReads, 0);
});
