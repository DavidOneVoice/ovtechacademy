import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { attendanceRules } from './attendance-rules.mjs';
import { scholarshipPhoneRules } from './phone-rules.mjs';
import { portalRules, portalPrivateRules } from './portal-rules.mjs';

test('portal rules add only private server collections to both reviewed production layouts', () => {
  const canonical = fs.readFileSync('firestore.rules', 'utf8');
  const legacy = scholarshipPhoneRules(attendanceRules(fs.readFileSync('test-support/legacy-firestore.rules', 'utf8')));
  for (const source of [canonical, legacy]) {
    const baseline = source.replace(portalPrivateRules, '');
    const result = portalRules(baseline);
    assert.equal(result.replace(portalPrivateRules, '').replace(/\s+/g, ''), baseline.replace(/\s+/g, ''));
    assert.equal(portalRules(result), result);
    for (const collection of ['portalSessions', 'portalChallenges', 'portalRateLimits', 'portalContactLocks']) assert.ok(result.includes(`match /${collection}/{id} { allow read, write: if false; }`));
  }
});

test('forged markers, permissive rules and unreviewed changes refuse portal deployment', () => {
  const source = fs.readFileSync('firestore.rules', 'utf8').replace(portalPrivateRules, '');
  assert.throws(() => portalRules(source + '// OVTECH_PORTAL_PIN_V1'), /differ/);
  assert.throws(() => portalRules(source.replace('allow read, delete: if true;', 'allow read, write: if true;')), /differ/);
  assert.throws(() => portalRules('match /{all=**} { allow read, write: if true; }'), /differ/);
  const valid = portalRules(source);
  assert.throws(() => portalRules(valid.replace('match /portalSessions/{id} { allow read, write: if false; }', 'match /portalSessions/{id} { allow read, write: if true; }')), /differ/);
});
