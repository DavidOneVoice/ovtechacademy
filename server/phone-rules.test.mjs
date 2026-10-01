import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';
import { attendanceRules } from './attendance-rules.mjs';
import { applicantPhoneRuleHelpers, scholarshipPhoneRules } from './phone-rules.mjs';

const helpers = applicantPhoneRuleHelpers();
const marker = '// OVTECH_NEW_APPLICANT_PHONE_V1';
const current = fs.readFileSync('firestore.rules', 'utf8');
const canonical = current.replace(helpers, '').replace('(validNewScholarship()) && validApplicantPhone()', 'validNewScholarship()');
const legacy = attendanceRules(fs.readFileSync('test-support/legacy-firestore.rules', 'utf8'));

test('canonical patch changes only new-application creation and adds its phone helpers', () => {
  const patched = scholarshipPhoneRules(canonical);
  assert.match(patched, /allow create: if \(validNewScholarship\(\)\) && validApplicantPhone\(\);/);
  const restored = patched.replace(helpers, '').replace('(validNewScholarship()) && validApplicantPhone()', 'validNewScholarship()');
  assert.equal(restored, canonical);
  assert.equal(scholarshipPhoneRules(patched), patched);
});

test('reviewed live legacy attendance layout retains every read/update/payment/portal clause', () => {
  for (const source of [legacy, legacy.replaceAll('\n', '\r\n')]) {
    const patched = scholarshipPhoneRules(source);
    const before = source.match(/allow create: if request\.resource\.data\.cohortId[^;]+;/)[0];
    const after = patched.match(/allow create: if \(request\.resource\.data\.cohortId[^;]+;/)[0];
    assert.match(after, /&& validApplicantPhone\(\);$/);
    assert.equal(patched.replace(helpers, '').replace(after, before), source);
    assert.equal(scholarshipPhoneRules(patched), patched);
  }
});

test('unknown or permissive creation layouts and forged markers fail closed', () => {
  for (const source of [
    canonical.replace('allow create: if validNewScholarship();', 'allow create: if true;'),
    canonical.replace('allow create: if validNewScholarship();', 'allow write: if true;'),
    canonical.replace('allow create: if validNewScholarship();', 'allow create, update: if validNewScholarship();'),
    canonical.replace('allow create: if validNewScholarship();', 'allow create: if validNewScholarship(); allow create: if true;'),
    canonical.replace('allow create: if validNewScholarship();', 'allow create: if validNewScholarship() || true;'),
    canonical.replace('match /scholarshipApplications/{documentId}', 'match /scholarshipApplications/{appId}'),
    canonical.replace('allow create: if validNewScholarship();', 'allow create: if validNewScholarship(); match /nested/{id} { allow create: if true; }'),
    `${marker}\n${canonical}`,
    scholarshipPhoneRules(canonical).replace('&& validApplicantPhone();', '|| validApplicantPhone();'),
    scholarshipPhoneRules(canonical).replace("d.phoneCallingCode != ''", 'true'),
    legacy.replace("request.resource.data.cohortId == 'october-2026'", "request.resource.data.cohortId == 'july-2026'"),
  ]) assert.throws(() => scholarshipPhoneRules(source), /differ from the reviewed layouts/);
});

test('the generated country/calling-code table covers all supported phone countries', () => {
  const table = JSON.parse(helpers.match(/return (\{[^\n]+\})\.get\(country, ''\);/)[1]);
  assert.deepEqual(Object.keys(table), getCountries());
  for (const country of getCountries()) assert.equal(table[country], `+${getCountryCallingCode(country)}`);
  assert.equal(table.NG, '+234');
  assert.equal(table.UG, '+256');
  assert.equal(table.IT, '+39');
  assert.equal(table.US, table.CA);
  assert.equal(Object.hasOwn(table, 'ZZ'), false);
});

// Exercise the predicate emitted into the real rules, translating only the
// small Rules string/map operations it uses. This checks the deployed predicate;
// it is not a substitute for Google's rules compiler or a Firestore emulator.
function emittedPhonePredicate() {
  const condition = helpers.match(/return d\.keys\(\)\.hasAll[\s\S]*?;/)[0]
    .replace(/^return /, '').replace(/;$/, '')
    .replace(/d\.keys\(\)\.hasAll\((\[[^\]]+\])\)/g, '$1.every((key) => Object.hasOwn(d, key))')
    .replace(/d\.(\w+) is string/g, '(typeof d.$1 === "string")')
    .replace(/d\.(\w+)\.matches\(('(?:[^'\\]|\\.)*')\)/g, 'new RegExp($2).test(d.$1)');
  return new Function('d', 'applicantPhoneCallingCode', `return ${condition};`)
    .bind(null);
}

test('the actual emitted predicate requires country metadata and canonical complete phone numbers', () => {
  const table = JSON.parse(helpers.match(/return (\{[^\n]+\})\.get\(country, ''\);/)[1]);
  const predicate = emittedPhonePredicate();
  const valid = (d) => predicate(d, (country) => table[country] || '');
  const ng = { phoneCountry: 'NG', phoneCallingCode: '+234', phoneNationalNumber: '8031234567', whatsapp: '+2348031234567' };
  const ug = { phoneCountry: 'UG', phoneCallingCode: '+256', phoneNationalNumber: '772123456', whatsapp: '+256772123456' };
  assert.equal(valid(ng), true);
  assert.equal(valid(ug), true);
  assert.equal(valid({ phoneCountry: 'IT', phoneCallingCode: '+39', phoneNationalNumber: '0212345678', whatsapp: '+390212345678' }), true);
  for (const key of Object.keys(ng)) {
    const missing = { ...ng }; delete missing[key];
    assert.equal(valid(missing), false);
  }
  for (const overrides of [
    { phoneCountry: '' }, { phoneCountry: 'ZZ' }, { phoneCountry: 'ng' },
    { phoneCallingCode: '+256' }, { phoneCallingCode: '234' },
    { phoneNationalNumber: '08031234567', whatsapp: '+23408031234567' },
    { phoneNationalNumber: '803123456', whatsapp: '+234803123456' },
    { phoneNationalNumber: '80312345670', whatsapp: '+23480312345670' },
    { phoneNationalNumber: 8031234567 }, { whatsapp: '08031234567' },
    { whatsapp: '+234 8031234567' }, { whatsapp: '+2348031234568' },
  ]) assert.equal(valid({ ...ng, ...overrides }), false);
  assert.equal(valid({ ...ug, phoneNationalNumber: '77212345', whatsapp: '+25677212345' }), false);
  assert.equal(valid({ ...ug, phoneNationalNumber: '077212345', whatsapp: '+256077212345' }), false);
  assert.equal(valid({ phoneCountry: 'US', phoneCallingCode: '+1', phoneNationalNumber: '123456789012345', whatsapp: '+1123456789012345' }), false);
});

test('production integration is master-only, backs up exact live source, and keeps existing migrations', () => {
  const prepare = fs.readFileSync('scripts/prepareProduction.mjs', 'utf8');
  assert.match(prepare, /process\.env\.CONTEXT !== 'production' \|\| process\.env\.BRANCH !== 'master'/);
  assert.match(prepare, /doc\('new-applicant-international-phone-rules-v1'\)/);
  assert.match(prepare, /source: phoneSource/);
  assert.ok(prepare.indexOf('source: phoneSource') < prepare.indexOf('releaseFirestoreRulesetFromSource(phoneUpdated)'));
  assert.match(prepare, /migrateCohorts\(db\)/);
  assert.match(prepare, /migrateDataAnalyticsDay39\(db\)/);
});
