import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { handleFinalAssessmentAdmin } from './final-assessment-admin-http.mjs';
import { createAdminAuth } from './admin-auth.mjs';
import { createFinalAssessmentService, questionBankFingerprint, validateQuestionBank } from './final-assessment.mjs';
import { COHORT } from '../src/data/cohort.js';
import { handlePortal } from './portal-http.mjs';
import { portalSessionKey } from './portal-security.mjs';
import { createPortalService } from './portal-service.mjs';

const origin = 'https://academy.example';
const secret = 'test-assessment-secret';
const owner = 'admin@ovtechacademy.com';
const setupToken = 'f'.repeat(64);
const importToken = 'e'.repeat(64);
const password = 'a test-only password';
const digest = (value) => createHash('sha256').update(value).digest('hex');
const cohortId = COHORT.id;
const bank = { questions: Array.from({ length: 100 }, (_, index) => ({
  prompt: `Question ${index + 1}`, options: ['Correct answer', 'Option two', 'Option three', 'Option four'], correct: 'A',
})) };

const bankDigest = questionBankFingerprint(validateQuestionBank(bank));

function post(path, action, data = {}, cookie = '', requestOrigin = origin, authorization = '') {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Cookie: cookie, Authorization: authorization },
    body: JSON.stringify({ ...data, action }),
  });
}

function fixture() {
  let time = 1_800_000_000_000;
  const now = () => time;
  const { db, docs } = memoryFirestore();
  const assessments = createFinalAssessmentService({ db, now });
  const portal = createPortalService({ db, secret, sendCode: async () => {}, now });
  const auth = createAdminAuth({ db, secret, now, ownerSetupDigest: digest(setupToken) });

  function student(id, tokenNumber, { pin = true, track = 'Virtual Assistance', cohort = cohortId, email = `${id}@example.test` } = {}) {
    const token = tokenNumber.toString(16).padStart(64, '0');
    docs.set(`scholarshipApplications/${id}`, { fullName: id.toUpperCase(), track, cohortId: cohort, status: 'Enrolled', email });
    if (pin) docs.set(`attendanceCredentials/${id}`, { version: 'test', recoveryEmail: email, salt: 'c'.repeat(32), hash: 'd'.repeat(128) });
    docs.set(`portalSessions/${portalSessionKey(token, secret)}`, { studentId: id,
      mode: pin ? 'pin' : 'legacy', version: pin ? 'test' : 'legacy', expires: now() + 86_400_000 });
    return token;
  }

  return { assessments, portal, student, now, docs, advance: (ms) => { time += ms; },
    installBank: () => assessments.installBank({ bank }, bankDigest, COHORT),
    adminRequest: (action, input, cookie, requestOrigin, authorization) => handleFinalAssessmentAdmin(
      post('/api/final-assessment-admin', action, input, cookie, requestOrigin, authorization), { ip: 'test-ip' }, {}, { auth, assessments, importDigest: digest(importToken), bankDigest }),
  };
}

test('publishes exactly 100 unique A–D questions to one cohort and delivers them only after an eligible, PIN-backed start', async () => {
  const { assessments, portal, student, installBank } = fixture();
  const token = student('ada', 1);
  const legacy = student('no-pin', 2, { pin: false });
  const otherCohort = student('july', 3, { cohort: 'july-2026' });
  const otherCourse = student('dev', 4, { track: 'Web Development' });
  assert.throws(() => validateQuestionBank({ questions: bank.questions.slice(1) }), /exactly 100/);
  assert.throws(() => validateQuestionBank({ questions: [...bank.questions.slice(1), bank.questions[1]] }), /unique prompt/);
  assert.equal((await portal.assessmentStatus({}, token)).stage, 'unavailable');
  const installed = await installBank();
  assert.equal(installed.questionCount, 100);
  assert.equal(installed.matchesSyllabusBank, true);
  assert.deepEqual(await installBank(), installed);
  assert.deepEqual((await assessments.publish({ cohortId }, owner)).publication, installed.publication);
  assert.equal((await portal.assessmentStatus({}, legacy)).stage, 'verify_pin');
  await assert.rejects(portal.assessmentStart({ studentId: 'no-pin', cohortId }, legacy), { code: 'assessment_pin_required' });
  assert.equal((await portal.assessmentStatus({}, otherCohort)).stage, 'unavailable');
  assert.equal((await portal.assessmentStatus({}, otherCourse)).stage, 'unavailable');
  assert.equal((await portal.assessmentStatus({ includeQuestions: true }, token)).questions, undefined);
  const denied = await handlePortal(post('/api/portal', 'assessmentStart', { studentId: 'ada', cohortId }), {}, {}, portal);
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('Cache-Control'), /no-store/);
  await assert.rejects(portal.assessmentStart({ studentId: 'ada', cohortId: 'july-2026' }, token), { code: 'assessment_unavailable' });
  const started = await portal.assessmentStart({ studentId: 'ada', cohortId }, token);
  assert.equal(started.details.cohort, 'October 2026');
  assert.equal(started.questions.length, 100);
  assert.ok(started.questions.every((question) => Object.keys(question).join(',') === 'prompt,options'));
  assert.equal((await portal.assessmentStatus({}, token)).questions, undefined);
});

test('double starts resume the same attempt, saved answers survive refresh and approvals permanently lock the cohort', async () => {
  const { assessments, portal, student, docs, installBank } = fixture();
  const token = student('ada', 1);
  const duplicate = student('duplicate', 2, { email: 'ada@example.test' });
  const other = student('grace', 3);
  const july = student('ada-july', 4, { cohort: 'july-2026', email: 'ada@example.test' });
  await installBank();
  await assessments.publish({ cohortId: 'july-2026' }, owner);
  const input = { studentId: 'ada', cohortId, previousAttemptId: null };
  const [first, second] = await Promise.all([portal.assessmentStart(input, token), portal.assessmentStart(input, token)]);
  assert.equal(first.latest.id, second.latest.id);
  assert.equal(first.latest.deadline - first.latest.startedAt, 3_600_000);
  assert.equal((await portal.assessmentStatus({}, duplicate)).stage, 'different_enrollment');
  await assert.rejects(portal.assessmentStart({ studentId: 'duplicate', cohortId }, duplicate), { code: 'assessment_enrollment_claimed' });
  const attemptId = first.latest.id;
  const answer = first.questions[0].options.indexOf('Correct answer');
  await assert.rejects(portal.assessmentSave({ attemptId, answers: { 1: answer } }, other), { code: 'assessment_changed' });
  await assert.rejects(portal.assessmentSave({ attemptId, answers: { 101: 0 } }, token), /four options/);
  await portal.assessmentSave({ attemptId, answers: { 1: answer } }, token);
  const restored = await portal.assessmentStatus({ includeQuestions: true }, token);
  assert.deepEqual(restored.answers, { 1: answer });
  assert.deepEqual(restored.questions, first.questions);
  const secondAnswer = first.questions[1].options.indexOf('Correct answer');
  const submitted = await portal.assessmentSubmit({ attemptId, answers: { 2: secondAnswer } }, token);
  assert.equal(submitted.latest.score, 2);
  assert.equal(submitted.latest.answered, 2);
  assert.equal(submitted.latest.status, 'submitted');
  assert.equal((await portal.assessmentStart(input, token)).latest.id, attemptId);
  assert.equal((await portal.assessmentSave({ attemptId, answers: { 1: (answer + 1) % 4 } }, token)).latest.score, 2);
  const rejected = await assessments.review({ studentId: 'ada', attemptId, decision: 'rejected' }, owner);
  assert.equal(rejected.stage, 'rejected');
  assert.equal((await portal.assessmentStart(input, token)).stage, 'rejected');
  const retake = await portal.assessmentStart({ ...input, previousAttemptId: attemptId }, token);
  assert.equal(retake.latest.number, 2);
  assert.equal(retake.lastResult.score, 2);
  assert.equal((await assessments.studentResult({ studentId: 'ada' })).lastResult.score, 2);
  assert.deepEqual(retake.answers, {});
  await assert.rejects(portal.assessmentSubmit({ attemptId }, token), { code: 'assessment_changed' });
  await portal.assessmentSubmit({ attemptId: retake.latest.id }, token);
  const approved = await assessments.review({ studentId: 'ada', attemptId: retake.latest.id, decision: 'approved' }, owner);
  assert.equal(approved.stage, 'approved');
  assert.equal(approved.lastResult.score, 0);
  await assert.rejects(assessments.review({ studentId: 'ada', attemptId: retake.latest.id, decision: 'rejected' }, owner), { code: 'assessment_already_reviewed' });
  assert.equal((await portal.assessmentStart(input, token)).stage, 'approved');
  assert.equal(docs.get(`vaAssessmentAttempts/${attemptId}`).status, 'rejected');
  assert.equal((await portal.assessmentStart({ studentId: 'ada-july', cohortId: 'july-2026' }, july)).latest.number, 1);
});

test('the server deadline rejects late answers and schedules closed-tab attempts for grading', async () => {
  const { assessments, portal, student, now, advance, docs, installBank } = fixture();
  const first = student('ada', 1);
  const second = student('grace', 2);
  await installBank();
  const a = await portal.assessmentStart({ studentId: 'ada', cohortId }, first);
  const b = await portal.assessmentStart({ studentId: 'grace', cohortId }, second);
  const answer = a.questions[0].options.indexOf('Correct answer');
  await portal.assessmentSave({ attemptId: a.latest.id, answers: { 1: answer } }, first);
  advance(3_599_999);
  const premature = await portal.assessmentSubmit({ attemptId: a.latest.id, atDeadline: true }, first);
  assert.equal(premature.latest.status, 'in_progress');
  assert.equal(premature.serverNow, now());
  advance(1);
  const late = await portal.assessmentSave({ attemptId: a.latest.id, answers: { 2: a.questions[1].options.indexOf('Correct answer') } }, first);
  assert.equal(late.latest.score, 1);
  assert.equal(late.latest.submission, 'time_expired');
  assert.equal(late.latest.submittedAt, a.latest.deadline);
  assert.equal(await assessments.finalizeOverdue(), 1);
  assert.equal(docs.get(`vaAssessmentAttempts/${b.latest.id}`).score, 0);
  assert.equal(await assessments.finalizeOverdue(), 0);
  assert.equal((await portal.assessmentStatus({ includeQuestions: true }, second)).questions, undefined);
});

test('the standard admin login authorizes assessment actions without email verification', async () => {
  const { adminRequest, student, portal, docs, installBank, advance } = fixture();
  const token = student('ada', 1);
  assert.equal((await adminRequest('overview', { cohortId })).status, 401);
  assert.equal((await adminRequest('questionBank', { cohortId }, `ovtech_portal=${token}`)).status, 401);
  assert.equal((await adminRequest('publish', { cohortId, bank }, `ovtech_portal=${token}`)).status, 401);
  assert.equal((await adminRequest('requestCode', { email: owner })).status, 400);
  assert.equal((await adminRequest('setup', { setupToken, password }, '', 'https://other.example')).status, 403);
  assert.equal((await adminRequest('setup', { setupToken: 'c'.repeat(64), password })).status, 403);
  assert.equal((await adminRequest('login', { email: owner, password })).status, 409);
  const setup = await adminRequest('setup', { setupToken, password });
  assert.equal(setup.status, 200);
  const cookieHeader = setup.headers.get('Set-Cookie');
  assert.match(cookieHeader, /HttpOnly; Secure; SameSite=Strict/);
  const cookie = cookieHeader.split(';')[0];
  assert.equal((await adminRequest('session', {})).status, 401);
  assert.deepEqual(await (await adminRequest('session', {}, cookie)).json(), { role: 'admin' });
  assert.equal((await adminRequest('setup', { setupToken, password })).status, 409);
  assert.doesNotMatch(JSON.stringify(docs.get('academyAdminAuth/owner')), new RegExp(password));
  assert.equal((await adminRequest('login', { email: owner, password: 'wrong password' })).status, 401);
  assert.equal((await adminRequest('login', { email: 'adminassistant@ovtechacademy.com', password })).status, 401);
  assert.equal((await adminRequest('login', { email: owner, password })).status, 200);
  await installBank();
  const loaded = await (await adminRequest('questionBank', { cohortId }, cookie)).json();
  assert.deepEqual(loaded, bank);
  const nextCohortBank = await (await adminRequest('questionBank', { cohortId: 'july-2026' }, cookie)).json();
  assert.deepEqual(nextCohortBank, bank);
  assert.equal((await adminRequest('publish', { cohortId }, cookie)).status, 200);
  const { latest } = await portal.assessmentStart({ studentId: 'ada', cohortId }, token);
  await portal.assessmentSubmit({ attemptId: latest.id }, token);
  const overview = await (await adminRequest('overview', { cohortId }, cookie)).json();
  assert.equal(overview.students[0].latest.score, 0);
  assert.equal(overview.students[0].answers, undefined);
  assert.equal((await adminRequest('review', { studentId: 'ada', attemptId: latest.id, decision: 'approved' }, cookie)).status, 200);
  assert.match((await adminRequest('logout', {}, cookie)).headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await adminRequest('studentResult', { studentId: 'ada' }, cookie)).status, 401);
  const secondLogin = await adminRequest('login', { email: owner, password });
  advance(8 * 60 * 60_000);
  assert.equal((await adminRequest('overview', { cohortId }, secondLogin.headers.get('Set-Cookie').split(';')[0])).status, 401);
});

test('private import accepts only the expected bank and opens only the initial cohort', async () => {
  const { adminRequest, docs } = fixture();
  const authorization = `Bearer ${importToken}`;
  assert.equal((await adminRequest('installBank', { bank })).status, 403);
  const altered = { questions: bank.questions.map((question, index) => index ? question : { ...question, correct: 'B' }) };
  assert.equal((await adminRequest('installBank', { bank: altered }, '', origin, authorization)).status, 400);
  assert.equal(docs.size, 0);
  const result = await adminRequest('installBank', { bank, cohortId: 'july-2026' }, '', origin, authorization);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).publication.cohortId, cohortId);
  assert.equal(docs.has('vaAssessmentPublications/july-2026'), false);
  assert.equal(docs.get(`vaAssessmentBanks/${cohortId}`).questions.length, 100);
  assert.equal((await adminRequest('overview', { cohortId }, '', origin, authorization)).status, 401);
});

test('loading the default questions preserves an existing published cohort and its answer key', async () => {
  const { adminRequest, docs } = fixture();
  const publication = { cohortId, cohortLabel: COHORT.label, publishedAt: 5000, publishedBy: owner };
  const questions = validateQuestionBank(bank).map((question) => ({ ...question, correct: 2 }));
  docs.set(`vaAssessmentPublications/${cohortId}`, publication);
  docs.set(`vaAssessmentBanks/${cohortId}`, { questions });
  const result = await (await adminRequest('installBank', { bank }, '', origin, `Bearer ${importToken}`)).json();
  assert.deepEqual(result, { publication, questionCount: 100, matchesSyllabusBank: false });
  assert.deepEqual(docs.get(`vaAssessmentBanks/${cohortId}`).questions, questions);
  assert.equal(docs.get('vaAssessmentConfiguration/questionBank').digest, bankDigest);
});
