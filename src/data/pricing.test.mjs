import test from 'node:test';
import assert from 'node:assert/strict';
import courses from './courses.js';
import { getCoursePricing, getPricingRegion, applicationPricingFields } from './pricing.js';
import { createVisitorCountryStore } from '../services/visitorCountry.js';
import visitorCountry from '../../netlify/functions/visitor-country.mjs';

const expected = {
  NG: ['NGN', [300000, 20000, '93.33%'], [500000, 20000, '96%'], [500000, 20000, '96%'], [150000, 15000, '90%'], [400000, 20000, '95%'], [400000, 20000, '95%']],
  GB: ['GBP', [300, 20, '93.33%'], [300, 40, '86.67%'], [300, 40, '86.67%'], [100, 15, '85%'], [300, 40, '86.67%'], [300, 40, '86.67%']],
  GH: ['USD', [250, 25, '90%'], [300, 30, '90%'], [300, 30, '90%'], [100, 15, '85%'], [300, 30, '90%'], [300, 30, '90%']],
  US: ['USD', [300, 30, '90%'], [400, 50, '87.5%'], [400, 50, '87.5%'], [100, 30, '70%'], [400, 50, '87.5%'], [400, 50, '87.5%']],
};
for (const [countryCode, [currency, ...prices]] of Object.entries(expected)) {
  test(`${countryCode}: all six tuition/scholarship fees and support percentages match the approved prices`, () => {
    courses.forEach((course, i) => {
      const fees = getCoursePricing(course.id, countryCode);
      assert.equal(fees.currency, currency);
      assert.deepEqual([fees.tuitionAmount, fees.scholarshipAmount, fees.scholarshipPercent], prices[i]);
      assert.equal(Number.parseFloat(fees.studentPaysPercent) + Number.parseFloat(fees.scholarshipPercent), 100);
      if (countryCode !== 'NG') assert.doesNotMatch(`${fees.tuition} ${fees.scholarship}`, /₦|NGN|Nigeria/);
      const record = applicationPricingFields(fees);
      assert.equal(record.tuitionAmount, prices[i][0]);
      assert.equal(record.scholarshipFeeAmount, prices[i][1]);
      assert.equal(record.currency, currency);
      assert.equal(record.detectedCountryCode, countryCode);
      assert.equal(record.scholarshipFee, fees.scholarship);
    });
  });
}
test('Nigeria, UK, other Africa, and the rest of the world use distinct price regions', () => {
  assert.equal(getPricingRegion('ng'), 'NG');
  assert.equal(getPricingRegion(' uk '), 'GB');
  assert.equal(getPricingRegion('GB'), 'GB');
  for (const code of 'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW'.split(' ')) assert.equal(getPricingRegion(code), 'AFRICA', code);
  for (const code of ['US', 'CA', 'AU', 'IN', 'DE', 'FR', 'IE']) assert.equal(getPricingRegion(code), 'DEFAULT', code);
  for (const code of [undefined, null, '', 'ZZ', 'XX', 'not-a-country']) {
    assert.equal(getPricingRegion(code), null);
    assert.equal(getCoursePricing('data-analytics', code), null);
  }
  assert.equal(getCoursePricing('unknown-course', 'GB'), null);
});
test('country lookup is shared and never exposes Nigerian fees while an overseas lookup is pending', async () => {
  let resolve; let calls = 0;
  const store = createVisitorCountryStore(() => { calls++; return new Promise((done) => { resolve = done; }); });
  const seen = [store.getSnapshot()];
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));
  const a = store.load(); const b = store.load();
  assert.equal(a, b);
  assert.equal(store.getSnapshot().countryCode, null);
  await Promise.resolve();
  resolve(Response.json({ countryCode: 'GB' }));
  await a; await store.load();
  assert.equal(calls, 1);
  assert.deepEqual(seen.map((state) => state.countryCode), [null, null, 'GB']);
  assert.equal(getCoursePricing('data-analytics', store.getSnapshot().countryCode).tuition, '£300');
  unsubscribe();
});
test('failed or invalid location lookup stays neutral and can be retried', async () => {
  for (const response of [() => { throw new Error('offline'); }, () => Response.json({countryCode: null}), () => new Response('', {status:503})]) {
    let fail = true;
    const store = createVisitorCountryStore(() => fail ? response() : Response.json({ countryCode: 'ZA' }));
    await store.load();
    assert.deepEqual(store.getSnapshot(), { status: 'error', countryCode: null });
    fail = false; await store.load();
    assert.deepEqual(store.getSnapshot(), { status: 'ready', countryCode: 'ZA' });
  }
});
test('country endpoint uses platform geolocation only and cannot cache one visitor’s country for another', async () => {
  const request = new Request('https://ovtechacademy.com/api/visitor-country?country=NG', {headers: {'x-country-code': 'NG'}});
  for (const code of ['NG', 'GB', 'GH', 'ZA', 'US']) {
    const response = visitorCountry(request, {geo: {country: {code}}});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {countryCode: code});
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('netlify-cdn-cache-control'), 'no-store');
  }
  const missing = visitorCountry(request, {});
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), {countryCode: null});
});
