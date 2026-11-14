import { createHash, randomInt } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { cohortLabel, DEFAULT_COHORTS, recordCohortId } from '../src/data/cohort.js';
import { ANSWER_LETTERS, FINAL_ASSESSMENT, isFinalAssessmentStudent } from '../src/lms/finalAssessment.js';

export class FinalAssessmentError extends Error {
  constructor(message, status = 400, code = 'invalid_assessment_request') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
const key = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const course = FINAL_ASSESSMENT.course;
const total = FINAL_ASSESSMENT.total;
const durationMs = FINAL_ASSESSMENT.minutes * 60_000;
const notAvailable = () => new FinalAssessmentError('This final assessment is unavailable for your enrollment.', 403, 'assessment_unavailable');
const changedAttempt = () => new FinalAssessmentError('Your assessment status has changed. Reload this page to continue.', 409, 'assessment_changed');

export function validateQuestionBank(input) {
  const questions = input?.questions;
  if (!Array.isArray(questions) || questions.length !== total) {
    throw new FinalAssessmentError(`The file must contain exactly ${total} questions.`);
  }
  const prompts = new Set();
  const normalized = (text) => text.toLowerCase().replace(/\s+/g, ' ');
  return questions.map((question, index) => {
    const prompt = typeof question?.prompt === 'string' ? question.prompt.trim() : '';
    const options = Array.isArray(question?.options)
      ? question.options.map((option) => typeof option === 'string' ? option.trim() : '') : [];
    const correct = ANSWER_LETTERS.indexOf(question?.correct);
    if (!prompt || prompt.length > 650 || prompts.has(normalized(prompt)) ||
      options.length !== ANSWER_LETTERS.length || options.some((option) => !option || option.length > 330) ||
      new Set(options.map(normalized)).size !== options.length || correct < 0) {
      throw new FinalAssessmentError(`Check question ${index + 1}. Each question needs a unique prompt, four distinct options and one correct letter (A–D).`);
    }
    prompts.add(normalized(prompt));
    return { prompt, options, correct };
  });
}

export function questionBankFingerprint(questions) {
  return createHash('sha256').update(JSON.stringify(questions)).digest('hex');
}

function shuffled(values) {
  const result = [...values];
  for (let end = result.length - 1; end > 0; end -= 1) {
    const other = randomInt(end + 1);
    [result[end], result[other]] = [result[other], result[end]];
  }
  return result;
}

function readAnswers(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([number, choice]) =>
    !/^(?:[1-9][0-9]?|100)$/.test(number) || !Number.isInteger(choice) || choice < 0 || choice >= ANSWER_LETTERS.length)) {
    throw new FinalAssessmentError('Select one of the four options for each answer.');
  }
  return value;
}

function attemptSummary(attempt) {
  return {
    id: attempt.id,
    number: attempt.number,
    status: attempt.status,
    startedAt: attempt.startedAt,
    ...(attempt.status === 'in_progress'
      ? { deadline: attempt.deadline }
      : { score: attempt.score, total, answered: attempt.answered, submittedAt: attempt.submittedAt, submission: attempt.submission }),
  };
}

export function createFinalAssessmentService({ db, now = Date.now }) {
  const publications = db.collection('vaAssessmentPublications');
  const banks = db.collection('vaAssessmentBanks');
  const entries = db.collection('vaAssessmentEntries');
  const claims = db.collection('vaAssessmentClaims');
  const attempts = db.collection('vaAssessmentAttempts');
  const enrollments = db.collection('scholarshipApplications');
  const defaultBank = db.collection('vaAssessmentConfiguration').doc('questionBank');

  function enrollment(student) {
    const cohortId = recordCohortId(student);
    if (!isFinalAssessmentStudent(student) || !validId(cohortId)) return null;
    const name = String(student.fullName || student.name || student.studentName || 'Student');
    return { studentId: student.id, cohortId, name, course };
  }

  function identityFor(student, credential) {
    const email = String(credential?.data()?.recoveryEmail || '').trim().toLowerCase();
    if (!credential?.exists || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return claims.doc(key(student.cohortId, email));
  }

  async function bankFor(cohortId, tx) {
    const ref = banks.doc(cohortId);
    const saved = tx ? await tx.get(ref) : await ref.get();
    const questions = saved.data()?.questions;
    if (!Array.isArray(questions) || questions.length !== total) {
      throw new FinalAssessmentError('The question bank is temporarily unavailable. Contact the academy if the issue continues.', 503, 'assessment_bank_unavailable');
    }
    return questions;
  }

  function complete(tx, ref, attempt, entryRef, questions, answers, timestamp) {
    const expired = timestamp >= attempt.deadline;
    const score = attempt.order.reduce((points, item, index) =>
      points + Number(item.options[answers[index + 1]] === questions[item.question].correct), 0);
    const submitted = {
      ...attempt,
      answers,
      score,
      answered: Object.keys(answers).length,
      status: 'submitted',
      submittedAt: expired ? attempt.deadline : timestamp,
      submission: expired ? 'time_expired' : 'manual',
    };
    tx.update(ref, { answers, score, answered: submitted.answered, status: submitted.status,
      submittedAt: submitted.submittedAt, submission: submitted.submission, dueAt: FieldValue.delete() });
    const latest = attemptSummary(submitted);
    tx.update(entryRef, { latest, lastResult: latest });
    return submitted;
  }

  async function expireAttempt(id) {
    const ref = attempts.doc(id);
    return db.runTransaction(async (tx) => {
      const attempt = (await tx.get(ref)).data();
      const timestamp = now();
      if (attempt?.status !== 'in_progress' || timestamp < attempt.deadline) return attempt;
      const questions = await bankFor(attempt.cohortId, tx);
      return complete(tx, ref, attempt, entries.doc(attempt.entryId), questions, attempt.answers, timestamp);
    });
  }

  async function studentState(auth, includeQuestions) {
    const student = enrollment(auth.student);
    if (!student) return { stage: 'unavailable' };
    const entryRef = entries.doc(key(student.cohortId, student.studentId));
    const claimRef = identityFor(student, auth.credential);
    const [publication, entrySnapshot, owner] = await Promise.all([
      publications.doc(student.cohortId).get(), claimRef ? entryRef.get() : null, claimRef?.get(),
    ]);
    if (!publication.exists) return { stage: 'unavailable' };
    const details = { ...student, cohort: publication.data().cohortLabel, total, minutes: FINAL_ASSESSMENT.minutes };
    if (!claimRef) return { stage: 'verify_pin', details };
    const entry = entrySnapshot.data();
    if (!entry && owner?.data()?.studentId && owner.data().studentId !== student.studentId) {
      return { stage: 'different_enrollment', details };
    }
    if (!entry) return { stage: 'ready', details };
    let latest = entry.latest;
    let lastResult = entry.lastResult;
    if (latest.status === 'in_progress' && (includeQuestions || now() >= latest.deadline)) {
      const attempt = now() >= latest.deadline
        ? await expireAttempt(latest.id) : (await attempts.doc(latest.id).get()).data();
      if (!attempt) throw changedAttempt();
      latest = attemptSummary(attempt);
      if (latest.status === 'in_progress' && includeQuestions) {
        const bank = await bankFor(student.cohortId);
        const questions = attempt.order.map(({ question, options }) => ({
          prompt: bank[question].prompt,
          options: options.map((option) => bank[question].options[option]),
        }));
        return { stage: latest.status, details, latest, lastResult, questions, answers: attempt.answers, serverNow: now() };
      }
      if (latest.status !== 'in_progress') lastResult = latest;
    }
    return { stage: latest.status, details, latest, lastResult };
  }

  async function start(input, withSession) {
    await db.runTransaction(async (tx) => {
      const auth = await withSession(tx);
      const student = enrollment(auth.student);
      if (!student || student.studentId !== input.studentId || student.cohortId !== input.cohortId) throw notAvailable();
      const claimRef = identityFor(student, auth.credential);
      if (!claimRef) throw new FinalAssessmentError('Create a student PIN in My profile and sign in again to start.', 403, 'assessment_pin_required');
      const entryRef = entries.doc(key(student.cohortId, student.studentId));
      const [publication, stored, owner] = await Promise.all([
        tx.get(publications.doc(student.cohortId)), tx.get(entryRef), tx.get(claimRef),
      ]);
      if (!publication.exists) throw notAvailable();
      const entry = stored.data();
      if (owner.exists && owner.data().studentId !== student.studentId) {
        throw new FinalAssessmentError('Open the enrollment where you first started this assessment.', 409, 'assessment_enrollment_claimed');
      }
      if (entry && (entry.latest.status !== 'rejected' || input.previousAttemptId !== entry.latest.id)) return;
      if (!entry && input.previousAttemptId != null) throw changedAttempt();
      await bankFor(student.cohortId, tx);
      const number = (entry?.latest.number || 0) + 1;
      const ref = attempts.doc(key(entryRef.id, number));
      const startedAt = now();
      const deadline = startedAt + durationMs;
      const newAttempt = {
        id: ref.id, entryId: entryRef.id, studentId: student.studentId, cohortId: student.cohortId,
        number, status: 'in_progress', startedAt, deadline, dueAt: deadline, answers: {},
        order: shuffled(Array.from({ length: total }, (_, index) => index))
          .map((question) => ({ question, options: shuffled([0, 1, 2, 3]) })),
      };
      if (!owner.exists) tx.create(claimRef, { studentId: student.studentId });
      tx.create(ref, newAttempt);
      tx.set(entryRef, { ...student, latest: attemptSummary(newAttempt), lastResult: entry?.lastResult || null });
    });
  }

  async function recordAnswers(input, withSession, submit) {
    const answers = readAnswers(input.answers);
    if (!validId(input.attemptId)) throw changedAttempt();
    return db.runTransaction(async (tx) => {
      const auth = await withSession(tx);
      const student = enrollment(auth.student);
      if (!student || !identityFor(student, auth.credential)) throw notAvailable();
      const entryRef = entries.doc(key(student.cohortId, student.studentId));
      const ref = attempts.doc(input.attemptId);
      const [entry, saved] = await Promise.all([tx.get(entryRef), tx.get(ref)]);
      const attempt = saved.data();
      if (!attempt || attempt.entryId !== entryRef.id || entry.data()?.latest.id !== attempt.id) throw changedAttempt();
      if (attempt.status !== 'in_progress') return { latest: attemptSummary(attempt) };
      const timestamp = now();
      if (submit && input.atDeadline === true && timestamp < attempt.deadline) {
        return { latest: attemptSummary(attempt), serverNow: timestamp };
      }
      if (submit || timestamp >= attempt.deadline) {
        const bank = await bankFor(attempt.cohortId, tx);
        const submitted = complete(tx, ref, attempt, entryRef, bank,
          timestamp >= attempt.deadline ? attempt.answers : { ...attempt.answers, ...answers }, timestamp);
        return { latest: attemptSummary(submitted) };
      }
      tx.update(ref, { answers: { ...attempt.answers, ...answers } });
      return { latest: attemptSummary(attempt) };
    });
  }

  return {
    studentState,
    start,
    save: (input, withSession) => recordAnswers(input, withSession, false),
    submit: (input, withSession) => recordAnswers(input, withSession, true),

    async finalizeOverdue(limit = 60) {
      const overdue = await attempts.where('dueAt', '<=', now()).limit(limit).get();
      for (let offset = 0; offset < overdue.docs.length; offset += 12) {
        const results = await Promise.allSettled(overdue.docs.slice(offset, offset + 12).map(({ id }) => expireAttempt(id)));
        for (const result of results) if (result.status === 'rejected') console.error('Final assessment expiry could not be recorded.', result.reason?.code || 'unknown_error');
      }
      return overdue.docs.length;
    },

    async installBank({ bank }, expectedDigest, cohort) {
      const questions = validateQuestionBank(bank);
      if (questionBankFingerprint(questions) !== expectedDigest) throw new FinalAssessmentError('The questions did not match the expected bank.', 400, 'assessment_bank_invalid');
      return db.runTransaction(async (tx) => {
        const publicationRef = publications.doc(cohort.id);
        const bankRef = banks.doc(cohort.id);
        const [storedDefault, storedPublication, storedBank] = await Promise.all([
          tx.get(defaultBank), tx.get(publicationRef), tx.get(bankRef),
        ]);
        if (storedDefault.exists && storedDefault.data().digest !== expectedDigest) {
          throw new FinalAssessmentError('A different default question bank already exists.', 409, 'assessment_bank_exists');
        }
        if (!storedDefault.exists) tx.create(defaultBank, { questions, digest: expectedDigest });
        if (storedPublication.exists) {
          const published = storedBank.data()?.questions;
          return { publication: storedPublication.data(), questionCount: published?.length || 0,
            matchesSyllabusBank: Array.isArray(published) && questionBankFingerprint(published) === expectedDigest };
        }
        const publication = { cohortId: cohort.id, cohortLabel: cohort.label, publishedAt: now(), publishedBy: 'initial-deployment' };
        tx.create(bankRef, { questions });
        tx.create(publicationRef, publication);
        return { publication, questionCount: questions.length, matchesSyllabusBank: true };
      });
    },

    async publish({ cohortId }, admin) {
      if (!validId(cohortId)) throw notAvailable();
      const catalogue = (await db.collection('cohorts').doc(cohortId).get()).data();
      if (!catalogue && !DEFAULT_COHORTS.some((item) => item.id === cohortId)) throw notAvailable();
      const publication = { cohortId, cohortLabel: catalogue?.label || cohortLabel(cohortId), publishedAt: now(), publishedBy: admin };
      const ref = publications.doc(cohortId);
      const result = await db.runTransaction(async (tx) => {
        const [current, source] = await Promise.all([tx.get(ref), tx.get(defaultBank)]);
        if (current.exists) return current.data();
        const questions = source.data()?.questions;
        if (!Array.isArray(questions) || questions.length !== total) {
          throw new FinalAssessmentError('The Virtual Assistant question bank is temporarily unavailable.', 503, 'assessment_bank_unavailable');
        }
        tx.create(banks.doc(cohortId), { questions });
        tx.create(ref, publication);
        return publication;
      });
      return { publication: result };
    },

    async overview({ cohortId }) {
      if (!validId(cohortId)) throw notAvailable();
      const publication = (await publications.doc(cohortId).get()).data() || null;
      if (!publication) return { publication, students: [] };
      const results = await entries.where('cohortId', '==', cohortId).get();
      const students = await Promise.all(results.docs.map(async (document) => {
        const entry = document.data();
        if (entry.latest.status !== 'in_progress' || now() < entry.latest.deadline) return entry;
        const attempt = await expireAttempt(entry.latest.id);
        const summary = attemptSummary(attempt);
        return { ...entry, latest: summary, lastResult: summary };
      }));
      return { publication, students: students.sort((a, b) => a.name.localeCompare(b.name)) };
    },

    async studentResult({ studentId }) {
      if (!validId(studentId)) throw notAvailable();
      const enrollmentSnapshot = await enrollments.doc(studentId).get();
      const student = enrollment({ ...enrollmentSnapshot.data(), id: studentId });
      if (!student) return { stage: 'unavailable' };
      const [publication, saved] = await Promise.all([
        publications.doc(student.cohortId).get(), entries.doc(key(student.cohortId, studentId)).get(),
      ]);
      if (!publication.exists) return { stage: 'unavailable' };
      const entry = saved.data();
      if (!entry) return { stage: 'ready' };
      if (entry.latest.status === 'in_progress' && now() >= entry.latest.deadline) {
        const attempt = await expireAttempt(entry.latest.id);
        const summary = attemptSummary(attempt);
        return { stage: summary.status, latest: summary, lastResult: summary };
      }
      return { stage: entry.latest.status, latest: entry.latest, lastResult: entry.lastResult };
    },

    async review({ studentId, attemptId, decision }, admin) {
      if (!validId(studentId) || !validId(attemptId) || !['approved', 'rejected'].includes(decision)) throw changedAttempt();
      return db.runTransaction(async (tx) => {
        const ref = attempts.doc(attemptId);
        const attempt = (await tx.get(ref)).data();
        if (attempt?.studentId !== studentId) throw changedAttempt();
        const entryRef = entries.doc(attempt.entryId);
        const entry = (await tx.get(entryRef)).data();
        if (entry?.latest.id !== attemptId) throw changedAttempt();
        if (attempt.status === decision) return { stage: decision, latest: entry.latest, lastResult: entry.lastResult };
        if (attempt.status !== 'submitted') throw new FinalAssessmentError('Only results awaiting review can be approved or rejected.', 409, 'assessment_already_reviewed');
        const reviewed = { status: decision, reviewedAt: now(), reviewedBy: admin };
        const summary = attemptSummary({ ...attempt, ...reviewed });
        tx.update(ref, reviewed);
        tx.update(entryRef, { latest: summary, lastResult: summary });
        return { stage: decision, latest: summary, lastResult: summary };
      });
    },
  };
}
