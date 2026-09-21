import test from 'node:test';
import assert from 'node:assert/strict';
import courses, { ONE_TO_ONE_METHOD } from '../src/data/courses.js';
import { getCoursePricing } from '../src/data/pricing.js';
import { paymentPages, getPaymentPage } from '../src/data/paymentPages.js';
import { createHostedPaymentService } from './hosted-payments.mjs';
import { handlePaymentRequest, sessionToken } from './payment-http.mjs';

const reference = `ovt_${'a'.repeat(32)}`;
const now = Date.parse('2026-09-21T12:00:00Z');
const details = { fullName: 'Test Learner', email: 'learner@example.com', whatsapp: '+2348012345678', location: 'Test city', ageRange: '25 - 34', referral: 'Other', reason: 'I want to develop practical skills.', courseId: 'data-analytics', learningMethod: ONE_TO_ONE_METHOD };
function fixture() {
  const orders = new Map(), applications = new Map();
  let pageOverride = {}, paymentOverride = {}, counter = 0;
  let lastSlug;
  const store = {
    getOrder: async (id) => orders.get(id), getApplication: async (id) => applications.get(id),
    reserveOrder: async (order) => { orders.set(order.reference, order); return order; },
    markVerified: async (order, payment, application) => {
      const current = orders.get(order.reference);
      Object.assign(current, { status: current.status === 'submitted' ? 'submitted' : 'paid', transactionReference: payment.reference });
      applications.set(order.applicationId, { ...application, paymentVerified: true });
      return current;
    },
    finalize: async (id) => { orders.get(id).status = 'submitted'; },
  };
  const service = createHostedPaymentService({ store, now: () => now, makeReference: () => counter++ === 0 ? reference : `ovt_${String(counter).padStart(32, '0')}`, gateway: {
    page: async (slug) => { lastSlug = slug; return { id: 123, slug, currency: 'NGN', amount: 30000000, domain: 'live', active: true, fixed_amount: true, type: 'payment', ...pageOverride }; },
    verify: async (ref) => ({ id: 456, reference: ref, status: 'success', currency: 'NGN', amount: 30000000, domain: 'live', customer: { email: details.email }, paid_at: new Date(now + 60000).toISOString(), ...paymentOverride }),
  } });
  return { service, orders, applications, slug: () => lastSlug, setPage: (data) => { pageOverride = data; }, setPayment: (data) => { paymentOverride = data; } };
}

test('all 48 region/course/purpose combinations resolve to exactly the 19 supplied pages', () => {
  const seen = new Set();
  for (const country of ['NG', 'GB', 'GH', 'US']) for (const course of courses) for (const type of ['tuition', 'scholarship']) {
    const page = getPaymentPage(getCoursePricing(course.id, country), type);
    assert.ok(page, `${country}/${course.id}/${type}`); seen.add(page.url);
    assert.equal(new URL(page.url).origin, 'https://paystack.shop');
  }
  assert.equal(seen.size, 19); assert.equal(Object.keys(paymentPages).length, 19);
  assert.equal(getPaymentPage(getCoursePricing('virtual-assistance', 'GH'), 'scholarship').url, 'https://paystack.shop/pay/ovtech-scholarship-usd15');
  assert.equal(getPaymentPage(getCoursePricing('data-analytics', 'NG'), 'scholarship').url, 'https://paystack.shop/pay/ovtech-tuition');
  assert.equal(getPaymentPage(getCoursePricing('virtual-assistance', 'NG'), 'tuition').url, 'https://paystack.shop/pay/ovtech-ngr-tuition');
  assert.equal(getPaymentPage(getCoursePricing('data-analytics', 'GH'), 'tuition').url, 'https://paystack.shop/pay/ovtech-tuition-us250000');
});
test('USD30 and USD300 groups share a page across the two USD regions', () => {
  for (const [type, africanCourse, internationalCourse] of [['scholarship', 'web-development', 'virtual-assistance'], ['tuition', 'web-development', 'data-analytics']]) {
    assert.equal(getPaymentPage(getCoursePricing(africanCourse, 'GH'), type).url, getPaymentPage(getCoursePricing(internationalCourse, 'US'), type).url);
  }
});
test('hosted checkout uses trusted geography, keeps the GBP quote and reads NGN amount from Paystack', async () => {
  const f = fixture(); f.setPage({ amount: 60000000 });
  const result = await f.service.prepare({ type: 'tuition', details, countryCode: 'GB', amount: 1, paymentUrl: 'https://attacker.example' }, 'https://ovtechacademy.com', 'GB');
  assert.equal(result.fees.tuition, '£300'); assert.equal(result.amount, 600000); assert.equal(result.currency, 'NGN');
  assert.equal(f.slug(), 'ovtech-tuition-uk600000');
  assert.equal(f.applications.size, 0); assert.equal(f.orders.size, 1);
  assert.equal(f.orders.get(result.reference).applicationDetails.currency, 'GBP');
  await assert.rejects(f.service.prepare({ type: 'tuition', details, countryCode: 'NG' }, '', 'GB'), /location has changed/);
  await assert.rejects(f.service.prepare({ type: 'tuition', details }, '', null), /local fees/);
});
test('wrong Nigerian amount, inactive, variable, test-mode, recurring and non-NGN pages cannot start checkout', async () => {
  for (const bad of [{amount:2000000}, {amount:0}, {amount:3.5}, {active:false}, {published:false}, {fixed_amount:false}, {domain:'test'}, {currency:'USD'}, {type:'subscription'}, {slug:'wrong-page'}, {id:null}]) {
    const f = fixture(); f.setPage(bad);
    await assert.rejects(f.service.prepare({ type:'tuition', details }, '', 'NG'));
    assert.equal(f.orders.size, 0);
  }
});
test('scholarship requires approval and matching email, and keeps the application country', async () => {
  const f = fixture(); f.setPage({ amount: 2250000 });
  const app = { ...details, courseId: 'virtual-assistance', applicationType: 'scholarship', cohortId: 'october-2026', detectedCountryCode: 'GH', status: 'Pending' };
  f.applications.set('app1', app);
  const input = { type:'scholarship', applicationId:'app1', email:details.email };
  await assert.rejects(f.service.prepare(input, '', 'NG'), /approved/);
  app.status = 'Approved';
  await assert.rejects(f.service.prepare({...input,email:'wrong@example.com'}, '', 'NG'), /match/);
  const result = await f.service.prepare(input, '', 'NG');
  assert.equal(result.fees.scholarship, 'US$15'); assert.equal(result.fees.scholarshipPercent, '85%');
  assert.equal(result.paymentUrl, 'https://paystack.shop/pay/ovtech-scholarship-usd15');
  assert.equal(result.amount, 22500); assert.equal(result.fees.countryCode, 'GH');
  app.paymentVerified = true;
  await assert.rejects(f.service.prepare(input, '', 'NG'), /already paid/);
});
test('failed, wrong-amount, wrong-email, test-mode and old hosted receipts cannot verify or complete', async () => {
  for (const bad of [{status:'failed'}, {amount:1}, {currency:'USD'}, {customer:{email:'wrong@example.com'}}, {domain:'test'}, {paid_at:new Date(now-60000).toISOString()}, {paid_at:'invalid'}, {id:null}, {reference:'different-reference'}]) {
    const f = fixture(); await f.service.prepare({type:'tuition',details}, '', 'NG'); f.setPayment(bad);
    await assert.rejects(f.service.complete(reference, 'test-receipt-123'));
    assert.equal(f.orders.get(reference).status, 'pending'); assert.equal(f.applications.size, 0);
  }
});
test('valid hosted reference verifies first, final submission re-verifies and repeated submission is idempotent', async () => {
  const f = fixture(); await f.service.prepare({type:'tuition',details}, '', 'NG');
  const verified = await f.service.verify(reference, 'test-receipt-123');
  assert.equal(verified.verified, true); assert.equal(verified.submitted, false);
  f.setPayment({status:'failed'});
  await assert.rejects(f.service.complete(reference, 'test-receipt-123'));
  f.setPayment({}); assert.equal((await f.service.complete(reference, 'test-receipt-123')).submitted, true);
  assert.equal((await f.service.complete(reference, 'test-receipt-123')).submitted, true);
  assert.equal(f.applications.size, 1);
  await assert.rejects(f.service.complete(reference, 'a-second-receipt'), /different confirmed payment/);
});
test('invalid or missing references and missing orders cannot reveal registration details', async () => {
  const f = fixture();
  await assert.rejects(f.service.status('not-an-order'));
  await assert.rejects(f.service.status(reference));
  await f.service.prepare({type:'tuition',details}, '', 'NG');
  await assert.rejects(f.service.verify(reference, ''));
  await assert.rejects(f.service.verify(reference, '<script>bad</script>'));
});
test('hosted HTTP actions require the matching HttpOnly session, including after a new-tab return', async () => {
  const f = fixture(); const env = { PAYSTACK_SECRET_KEY:'mock-secret', ENROLLMENT_SITE_URL:'https://ovtechacademy.com' };
  const request = (body, cookie = '') => new Request('https://ovtechacademy.com/api/payments', {method:'POST',headers:{origin:'https://ovtechacademy.com','content-type':'application/json',cookie},body:JSON.stringify(body)});
  const prepare = await handlePaymentRequest(request({action:'prepare-hosted',type:'tuition',details}), env, {hosted:f.service}, 'NG');
  assert.equal(prepare.status, 200); assert.match(prepare.headers.get('set-cookie'), /HttpOnly; SameSite=Lax;.*Secure/);
  for (const action of ['status-hosted','verify-hosted','complete-hosted']) assert.equal((await handlePaymentRequest(request({action,reference,paymentReference:'test-receipt-123'}),env,{hosted:f.service})).status,403);
  const cookie = `ovtech_${reference}=${sessionToken(reference, env.PAYSTACK_SECRET_KEY)}`;
  const response = await handlePaymentRequest(request({action:'complete-hosted',reference,paymentReference:'test-receipt-123'},cookie),env,{hosted:f.service});
  assert.equal(response.status,200); assert.equal((await response.json()).submitted,true);
});
test('read-only readiness endpoint reports configuration without exposing credentials', async () => {
  const response = await handlePaymentRequest(new Request('https://ovtechacademy.com/api/payments'), {});
  assert.deepEqual(await response.json(), {flow:'hosted-pages-v1',hostedCheckoutEnabled:false});
});
