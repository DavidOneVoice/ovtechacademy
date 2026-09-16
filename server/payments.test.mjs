import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import courses, { RECORDED_METHOD, ONE_TO_ONE_METHOD } from '../src/data/courses.js';
import { getCoursePricing } from '../src/data/pricing.js';
import { validateRegistration } from '../src/data/registration.js';
import { createPaymentService, assertSuccessfulPayment } from './payment-core.mjs';
import { handlePaymentRequest, handlePaystackWebhook, sessionToken } from './payment-http.mjs';

const reference = `ovt_${'a'.repeat(32)}`;
const details = {
  fullName: 'Test Learner', email: 'learner@example.com', whatsapp: '+234 801 234 5678',
  location: 'Lagos, Nigeria', ageRange: '25 - 34', referral: 'Other', reason: 'I want to build useful projects.',
  courseId: 'data-analytics', learningMethod: ONE_TO_ONE_METHOD, referralCode: '',
};
const payment = (order, overrides = {}) => ({
  id: 123456, status: 'success', reference: order.reference, amount: order.amount * 100,
  currency: 'NGN', customer: { email: order.details.email },
  metadata: { orderReference: order.reference, courseId: order.courseId, applicationType: order.type }, ...overrides,
});
function fixture(overrides = {}) {
  const orders = new Map(); const applications = new Map(); let initialized; let badPayment = {};
  const store = {
    getOrder: async (id) => orders.get(id), getApplication: async (id) => applications.get(id),
    reserveOrder: async (order) => { orders.set(order.reference, order); return order; },
    saveCheckout: async (id, authorizationUrl) => Object.assign(orders.get(id), { authorizationUrl }),
    markVerified: async (order, transaction, application) => {
      const current = orders.get(order.reference);
      if (!['paid', 'submitted'].includes(current.status)) {
        current.status = 'paid';
        applications.set(order.applicationId, { ...application, paymentVerified: true, registrationStatus: 'awaiting_submission' });
      }
      return current;
    },
    finalize: async (id) => {
      const order = orders.get(id);
      assert.ok(['paid', 'submitted'].includes(order.status));
      order.status = 'submitted'; applications.get(order.applicationId).registrationStatus = 'submitted';
    },
  };
  const service = createPaymentService({ store, makeReference: () => reference, gateway: {
    initialize: async (body) => { initialized = body; return { authorization_url: 'https://checkout.paystack.com/test-only' }; },
    verify: async (id) => payment(orders.get(id), badPayment),
  }, ...overrides });
  return { service, orders, applications, initialized: () => initialized, setPayment: (value) => { badPayment = value; } };
}

test('all six fees, durations, and scholarship percentages match the cohort', () => {
  assert.deepEqual(courses.map((c) => [c.id, c.durationWeeks, c.tuitionAmount, c.scholarshipAmount]), [
    ['data-analytics', 12, 300000, 20000], ['web-development', 20, 500000, 20000],
    ['software-development', 20, 500000, 20000], ['virtual-assistance', 8, 150000, 15000],
    ['cyber-security', 12, 400000, 20000], ['ai-automation', 12, 400000, 20000],
  ]);
  assert.deepEqual(courses.map((c) => [getCoursePricing(c.id).scholarshipPercent, getCoursePricing(c.id).studentPaysPercent]),
    [['93.33%', '6.67%'], ['96%', '4%'], ['96%', '4%'], ['90%', '10%'], ['95%', '5%'], ['95%', '5%']]);
});
test('scholarships cannot select one-on-one classes; single-format courses do not require a selector', () => {
  for (const course of courses) {
    const data = { ...details, courseId: course.id };
    assert.equal(validateRegistration(data, 'scholarship').learningMethod, course.scholarshipMethod);
    if (course.scholarshipRecordedOnly) {
      assert.equal(course.scholarshipMethod, RECORDED_METHOD);
      assert.throws(() => validateRegistration({ ...data, learningMethod: '' }, 'tuition'), /learning method/);
      assert.equal(validateRegistration(data, 'tuition').learningMethod, ONE_TO_ONE_METHOD);
    } else assert.equal(validateRegistration({ ...data, learningMethod: '' }).learningMethod, course.tuitionMethods[0]);
  }
});
test('checkout uses trusted course prices and retains a draft before contacting Paystack', async () => {
  const f = fixture();
  await f.service.initialize({ type: 'tuition', details, amount: 1, paymentVerified: true }, 'https://ovtechacademy.com');
  assert.equal(f.initialized().amount, 30000000);
  assert.equal(f.initialized().callback_url, 'https://ovtechacademy.com/registration/complete');
  assert.equal(f.orders.size, 1); assert.equal(f.applications.size, 0);
});
test('invalid form data never starts a payment', async () => {
  const f = fixture();
  await assert.rejects(f.service.initialize({ type: 'tuition', details: { ...details, email: 'invalid' } }, 'https://ovtechacademy.com'), /email/);
  assert.equal(f.orders.size, 0); assert.equal(f.initialized(), undefined);
});
test('payment mismatches and unsuccessful transactions cannot submit a registration', async () => {
  const invalid = [{ status: 'pending' }, { status: 'failed' }, { amount: 2000000 }, { currency: 'USD' },
    { reference: `ovt_${'b'.repeat(32)}` }, { customer: { email: 'someone@example.com' } },
    { metadata: {} }, { metadata: { orderReference: reference, courseId: 'ai-automation', applicationType: 'tuition' } }, { id: null }];
  for (const mismatch of invalid) {
    const f = fixture(); await f.service.initialize({ type: 'tuition', details }, 'https://ovtechacademy.com'); f.setPayment(mismatch);
    await assert.rejects(f.service.complete(reference)); assert.equal(f.applications.size, 0);
  }
});
test('verified payment creates an admin record, final submission is idempotent and re-verifies payment', async () => {
  const f = fixture(); await f.service.initialize({ type: 'tuition', details }, 'https://ovtechacademy.com');
  assert.equal((await f.service.verify(reference)).submitted, false);
  assert.equal(f.applications.size, 1);
  assert.equal(f.applications.values().next().value.registrationStatus, 'awaiting_submission');
  f.setPayment({ status: 'failed' }); await assert.rejects(f.service.complete(reference));
  f.setPayment({}); assert.equal((await f.service.complete(reference)).submitted, true);
  await f.service.complete(reference); assert.equal(f.applications.size, 1);
});
test('scholarship payment requires matching email and approval, uses the course scholarship fee', async () => {
  const f = fixture();
  const application = { ...details, learningMethod: RECORDED_METHOD, applicationType: 'scholarship', cohortId: 'october-2026', status: 'Pending', scholarshipFeeAmount: 1 };
  f.applications.set('application1', application);
  const input = { type: 'scholarship', applicationId: 'application1', email: details.email };
  await assert.rejects(f.service.initialize(input, 'https://ovtechacademy.com'), /approved/);
  application.status = 'Approved';
  await assert.rejects(f.service.initialize({ ...input, email: 'wrong@example.com' }, 'https://ovtechacademy.com'), /match/);
  await f.service.initialize(input, 'https://ovtechacademy.com'); assert.equal(f.initialized().amount, 2000000);
});

const env = { PAYSTACK_SECRET_KEY: 'sk_test_mock_only', ENROLLMENT_SITE_URL: 'https://ovtechacademy.com' };
const request = (body, headers = {}) => new Request('https://ovtechacademy.com/api/payments', {
  method: 'POST', headers: { origin: 'https://ovtechacademy.com', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
test('HTTP handler is fail-closed without setup and rejects cross-site requests', async () => {
  assert.equal((await handlePaymentRequest(request({ action: 'initialize' }), {})).status, 503);
  assert.equal((await handlePaymentRequest(request({ action: 'initialize' }, { origin: 'https://attacker.example' }), env, fixture().service)).status, 403);
});
test('a payment reference alone cannot reveal details or finalize another registration', async () => {
  let called = false; const service = { verify: async () => { called = true; return {}; } };
  assert.equal((await handlePaymentRequest(request({ action: 'verify', reference }), env, service)).status, 403);
  assert.equal(called, false);
  const response = await handlePaymentRequest(request({ action: 'verify', reference }, { cookie: `ovtech_${reference}=${sessionToken(reference, env.PAYSTACK_SECRET_KEY)}` }), env, service);
  assert.equal(response.status, 200); assert.equal(called, true);
});
test('checkout sets an HttpOnly secure session cookie scoped to the payment API', async () => {
  const response = await handlePaymentRequest(request({ action: 'initialize', type: 'tuition', details }), env, fixture().service);
  assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax;.*Secure/);
  assert.match(response.headers.get('set-cookie'), /Path=\/api\/payments/);
});
test('webhooks require a valid signature and still verify directly with Paystack', async () => {
  let verified = 0; const service = { verify: async (ref) => { assert.equal(ref, reference); verified++; } };
  const body = JSON.stringify({ event: 'charge.success', data: { reference, status: 'success' } });
  const webhook = (signature) => new Request('https://ovtechacademy.com/api/paystack-webhook', { method: 'POST', headers: { 'x-paystack-signature': signature }, body });
  assert.equal((await handlePaystackWebhook(webhook('forged'), env, service)).status, 401); assert.equal(verified, 0);
  const signature = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(body).digest('hex');
  assert.equal((await handlePaystackWebhook(webhook(signature), env, service)).status, 200); assert.equal(verified, 1);
});
test('the transaction must bind to the same course, order, and application type', () => {
  const order = { reference, amount: 300000, details, courseId: 'data-analytics', type: 'tuition' };
  assert.doesNotThrow(() => assertSuccessfulPayment(payment(order), order));
  assert.throws(() => assertSuccessfulPayment(payment(order, { metadata: { orderReference: reference, courseId: 'data-analytics', applicationType: 'scholarship' } }), order), /match/);
});
