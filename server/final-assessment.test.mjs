import assert from 'node:assert/strict';
import test from 'node:test';
import { memoryFirestore } from '../test-support/firestore.mjs';
import { handleFinalAssessmentAdmin } from './final-assessment-admin-http.mjs';
import { createAssessmentAdminAuth } from './final-assessment-admin.mjs';
import { createFinalAssessmentService, validateQuestionBank } from './final-assessment.mjs';
import { handlePortal } from './portal-http.mjs';
import { portalSessionKey } from './portal-security.mjs';
import { createPortalService } from './portal-service.mjs';

const origin = 'https://academy.example';
const secret = 'test-assessment-secret';
const owner = 'owner@example.test';
const cohortId = 'october-2026';
const bank = { questions: Array.from({ length: 100 }, (_, index) => ({
  prompt: `Question ${index + 1}`, options: ['Correct answer', 'Option two', 'Option three', 'Option four'], correct: 'A',
})) };

function post(path, action, data = {}, cookie = '', requestOrigin = origin) {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ ...data, action }),
  });
}

function fixture() {
  let time = 1_800_000_000_000;
  const now = () => time;
  const { db, docs } = memoryFirestore();
  let code;
  const assessments = createFinalAssessmentService({ db, now });
  const portal = createPortalService({ db, secret, sendCode: async () => {}, now });
  const admin = createAssessmentAdminAuth({ db, secret, email: owner, now, sendCode: async (email, _name, value, purpose) => {
    assert.equal(email, owner);
    assert.equal(purpose, 'assessment-admin');
    code = value;
  } });

  function student(id, tokenNumber, { pin = true, track = 'Virtual Assistance', cohort = cohortId, email = `${id}@example.test` } = {}) {
    const token = tokenNumber.toString(16).padStart(64, '0');
    docs.set(`scholarshipApplications/${id}`, { fullName: id.toUpperCase(), track, cohortId: cohort, status: 'Enrolled', email });
    if (pin) docs.set(`attendanceCredentials/${id}`, { version: 'test', recoveryEmail: email, salt: 'c'.repeat(32), hash: 'd'.repeat(128) });
    docs.set(`portalSessions/${portalSessionKey(token, secret)}`, { studentId: id,
      mode: pin ? 'pin' : 'legacy', version: pin ? 'test' : 'legacy', expires: now() + 86_400_000 });
    return token;
  }

  return { assessments, portal, student, now, docs, readCode: () => code, advance: (ms) => { time += ms; },
    adminRequest: (action, input, cookie, requestOrigin) => handleFinalAssessmentAdmin(
      post('/api/final-assessment-admin', action, input, cookie, requestOrigin), { ip: 'test-ip' }, {}, { auth: admin, assessments }),
  };
}

test('publishes exactly 100 unique A–D questions to one cohort and delivers them only after an eligible, PIN-backed start', async () => {
  const { assessments, portal, student } = fixture();
  const token = student('ada', 1);
  const legacy = student('no-pin', 2, { pin: false });
  const otherCohort = student('july', 3, { cohort: 'july-2026' });
  const otherCourse = student('dev', 4, { track: 'Web Development' });
  assert.throws(() => validateQuestionBank({ questions: bank.questions.slice(1) }), /exactly 100/);
  assert.throws(() => validateQuestionBank({ questions: [...bank.questions.slice(1), bank.questions[1]] }), /unique prompt/);
  assert.equal((await portal.assessmentStatus({}, token)).stage, 'unavailable');
  await assessments.publish({ cohortId, bank }, owner);
  await assert.rejects(assessments.publish({ cohortId, bank }, owner), { code: 'assessment_already_published' });
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
  const { assessments, portal, student, docs } = fixture();
  const token = student('ada', 1);
  const duplicate = student('duplicate', 2, { email: 'ada@example.test' });
  const other = student('grace', 3);
  const july = student('ada-july', 4, { cohort: 'july-2026', email: 'ada@example.test' });
  await assessments.publish({ cohortId, bank }, owner);
  await assessments.publish({ cohortId: 'july-2026', bank }, owner);
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
  const { assessments, portal, student, now, advance, docs } = fixture();
  const first = student('ada', 1);
  const second = student('grace', 2);
  await assessments.publish({ cohortId, bank }, owner);
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

test('admin access requires a same-origin request, the authorised mailbox, and a one-time code', async () => {
  const { adminRequest, readCode, student, portal } = fixture();
  const token = student('ada', 1);
  assert.equal((await adminRequest('overview', { cohortId })).status, 401);
  assert.equal((await adminRequest('publish', { cohortId, bank }, `ovtech_portal=${token}`)).status, 401);
  assert.equal((await adminRequest('requestCode', { email: owner }, '', 'https://other.example')).status, 403);
  assert.equal((await adminRequest('requestCode', { email: 'other@example.test' })).status, 403);
  const { challenge } = await (await adminRequest('requestCode', { email: owner })).json();
  assert.equal((await adminRequest('verifyCode', { challenge, code: '000000' })).status, 403);
  const verified = await adminRequest('verifyCode', { challenge, code: readCode() });
  const cookieHeader = verified.headers.get('Set-Cookie');
  assert.match(cookieHeader, /HttpOnly; Secure; SameSite=Strict/);
  const cookie = cookieHeader.split(';')[0];
  assert.equal((await adminRequest('verifyCode', { challenge, code: readCode() })).status, 403);
  assert.equal((await adminRequest('publish', { cohortId, bank }, cookie)).status, 200);
  const { latest } = await portal.assessmentStart({ studentId: 'ada', cohortId }, token);
  await portal.assessmentSubmit({ attemptId: latest.id }, token);
  const overview = await (await adminRequest('overview', { cohortId }, cookie)).json();
  assert.equal(overview.students[0].latest.score, 0);
  assert.equal(overview.students[0].answers, undefined);
  assert.equal((await adminRequest('review', { studentId: 'ada', attemptId: latest.id, decision: 'approved' }, cookie)).status, 200);
  assert.match((await adminRequest('logout', {}, cookie)).headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await adminRequest('studentResult', { studentId: 'ada' }, cookie)).status, 401);
});
