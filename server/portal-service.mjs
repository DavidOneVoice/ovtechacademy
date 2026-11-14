import { FieldValue } from 'firebase-admin/firestore';
import { digest, equal, hashPin, randomCode, randomToken, validPin, verifyPin } from './attendance-security.mjs';
import { newPortalToken, portalSessionKey, PORTAL_SESSION_TTL_MS, validPortalToken } from './portal-security.mjs';
import { getStudentLogin, isPaidOrEnrolled, normalizePhone, STUDENT_EMAIL_FIELDS, STUDENT_PHONE_FIELDS } from '../src/lms/enrollment.js';
import { normalizeProgrammeName } from '../src/data/programmes.js';
import { recordCohortId } from '../src/data/cohort.js';
import { validateWhatsAppNumber } from '../src/data/phoneNumbers.js';
import { createFinalAssessmentService } from './final-assessment.mjs';

export class PortalError extends Error {
  constructor(message, status = 400, code = 'invalid_request') { super(message); this.status = status; this.code = code; }
}
const invalidLogin = () => new PortalError('We could not verify those sign-in details. Check your registered email or phone number and PIN.', 403, 'invalid_login');
const invalidSession = () => new PortalError('Please sign in again to continue.', 401, 'sign_in_required');
const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
const emailValue = (value) => String(value || '').trim().toLowerCase();
const validEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const emailMatches = (student, value) => STUDENT_EMAIL_FIELDS.some((field) => student[field] && emailValue(student[field]) === value);
const phoneMatches = (student, value) => STUDENT_PHONE_FIELDS.some((field) => student[field] && normalizePhone(student[field]) === value);
function contactIdentifier(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.includes('@')) return validEmail(text) ? { type: 'email', value: emailValue(text) } : null;
  return text.length <= 40 && /^\+?[0-9\s().-]+$/.test(text) && /^[0-9]{7,24}$/.test(normalizePhone(text))
    ? { type: 'phone', value: normalizePhone(text) } : null;
}
const contactMatches = (student, identifier) => identifier && (identifier.type === 'email'
  ? emailMatches(student, identifier.value) : phoneMatches(student, identifier.value));
const credentialVersion = (snapshot) => snapshot.exists ? snapshot.data()?.version : 'legacy';
const healthyCredential = (snapshot) => snapshot.exists && typeof snapshot.data()?.version === 'string' && Boolean(snapshot.data().version)
  && typeof snapshot.data()?.salt === 'string' && /^[a-f0-9]{32}$/.test(snapshot.data().salt)
  && typeof snapshot.data()?.hash === 'string' && /^[a-f0-9]{128}$/.test(snapshot.data().hash);
const serializeStudentValue = (value) => {
  if (value && typeof value.toDate === 'function' && typeof value.seconds === 'number') return { seconds: value.seconds, nanoseconds: value.nanoseconds || 0 };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeStudentValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeStudentValue(entry)]));
  return value;
};
const safeStudent = (student) => serializeStudentValue(Object.fromEntries(Object.entries(student)
  .filter(([key]) => !['pin', 'attendancePin', 'pinHash', 'password', 'passwordHash'].includes(key))));

export function createPortalService({ db, secret, sendCode, now = () => Date.now() }) {
  const apps = db.collection('scholarshipApplications');
  const credentials = db.collection('attendanceCredentials');
  const sessions = db.collection('portalSessions');
  const challenges = db.collection('portalChallenges');
  const limits = db.collection('portalRateLimits');
  const contactLocks = db.collection('portalContactLocks');
  const clock = () => Number(now());
  const finalAssessment = createFinalAssessmentService({ db, now: clock });
  const contactProof = (student) => digest(JSON.stringify([
    STUDENT_EMAIL_FIELDS.map((field) => [field, emailValue(student[field])]),
    STUDENT_PHONE_FIELDS.map((field) => [field, normalizePhone(student[field])]),
  ]), secret);
  const credentialProof = (snapshot) => digest(JSON.stringify(snapshot.exists ? [true, snapshot.data()?.version || '', snapshot.data()?.hash || '', snapshot.data()?.salt || '', emailValue(snapshot.data()?.recoveryEmail)] : [false]), secret);

  async function throttle(key, maximum, milliseconds = 900000) {
    const ref = limits.doc(digest(`portal-rate:${key}`, secret));
    const allowed = await db.runTransaction(async (tx) => {
      const previous = (await tx.get(ref)).data();
      const active = previous && previous.until > clock();
      if (active && previous.count >= maximum) return false;
      tx.set(ref, { count: active ? previous.count + 1 : 1, until: active ? previous.until : clock() + milliseconds });
      return true;
    });
    if (!allowed) throw new PortalError('Too many attempts. Please wait 15 minutes before trying again.', 429, 'rate_limited');
  }
  async function loadStudent(id, tx) {
    if (!validId(id)) return null;
    const ref = apps.doc(id);
    const snapshot = tx ? await tx.get(ref) : await ref.get();
    return snapshot.exists ? { ...snapshot.data(), id } : null;
  }
  async function matchingStudents(identifier) {
    const snapshot = await apps.get();
    return snapshot.docs.map((document) => ({ ...document.data(), id: document.id }))
      .filter((student) => isPaidOrEnrolled(student) && contactMatches(student, identifier))
      .sort((first, second) => first.id.localeCompare(second.id));
  }
  function sessionMatches(session, student, credential) {
    if (!session || session.revoked || session.expires <= clock() || !student || !isPaidOrEnrolled(student) || session.studentId !== student.id) return false;
    return credential.exists
      ? session.mode === 'pin' && healthyCredential(credential) && session.version === credentialVersion(credential)
      : session.mode === 'legacy' && session.version === 'legacy';
  }
  async function requireSession(token, tx) {
    if (!validPortalToken(token)) throw invalidSession();
    const key = portalSessionKey(token, secret);
    const sessionRef = sessions.doc(key);
    const saved = tx ? await tx.get(sessionRef) : await sessionRef.get();
    const session = saved.data();
    if (!session || !validId(session.studentId)) throw invalidSession();
    const credentialRef = credentials.doc(session.studentId);
    const [student, credential] = await Promise.all([
      loadStudent(session.studentId, tx), tx ? tx.get(credentialRef) : credentialRef.get(),
    ]);
    if (!sessionMatches(session, student, credential)) throw invalidSession();
    return { key, session, student, credential };
  }
  const studentResponse = (student, credential) => ({ student: safeStudent(student), pinRequired: credential.exists });
  async function assertNoContactCollision(student, proposed) {
    const previous = getStudentLogin(student);
    const changedEmail = Object.hasOwn(proposed, 'email') && emailValue(proposed.email) !== emailValue(previous.email);
    const changedPhone = Object.hasOwn(proposed, 'whatsapp') && normalizePhone(proposed.whatsapp) !== normalizePhone(previous.whatsapp);
    if (!changedEmail && !changedPhone) return;
    const snapshot = await apps.get();
    if (snapshot.docs.some((document) => document.id !== student.id && (
      (changedEmail && emailMatches(document.data(), emailValue(proposed.email))) ||
      (changedPhone && phoneMatches(document.data(), normalizePhone(proposed.whatsapp)))
    ))) throw new PortalError('That email or phone number is already registered to another application. Contact admissions to update your details safely.', 409, 'contact_in_use');
  }
  async function readContactClaims(tx, student, patch) {
    const previous = getStudentLogin(student);
    const changed = [
      Object.hasOwn(patch, 'email') && patch.email !== emailValue(previous.email) ? { type: 'email', value: patch.email } : null,
      Object.hasOwn(patch, 'whatsapp') && normalizePhone(patch.whatsapp) !== normalizePhone(previous.whatsapp) ? { type: 'phone', value: normalizePhone(patch.whatsapp) } : null,
    ].filter(Boolean);
    const claims = [];
    for (const contact of changed) {
      const ref = contactLocks.doc(digest(`portal-contact:${contact.type}:${contact.value}`, secret));
      const snapshot = await tx.get(ref), claim = snapshot.data();
      if (claim?.studentId && claim.studentId !== student.id) {
        if (!validId(claim.studentId)) throw new PortalError('These contact details need an admissions review.', 503, 'contact_unavailable');
        const owner = await tx.get(apps.doc(claim.studentId));
        if (owner.exists && contactMatches(owner.data(), contact)) throw new PortalError('That email or phone number is already registered to another application. Contact admissions to update your details safely.', 409, 'contact_in_use');
      }
      claims.push({ ref, value: { studentId: student.id, type: contact.type, updatedAt: FieldValue.serverTimestamp() } });
    }
    return claims;
  }
  function profilePatch(student, input) {
    const allowed = ['fullName', 'email', 'phoneCountry', 'phoneNationalNumber', 'whatsapp', 'pin'];
    if (!input || Object.keys(input).some((field) => !allowed.includes(field))) throw new PortalError('Only your name, email and phone number can be edited here.');
    const patch = {};
    if (Object.hasOwn(input, 'fullName')) {
      const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
      if (fullName.length < 2 || fullName.length > 150) throw new PortalError('Enter your full name.');
      patch.fullName = fullName;
      for (const field of ['name', 'studentName']) if (Object.hasOwn(student, field)) patch[field] = fullName;
    }
    if (Object.hasOwn(input, 'email')) {
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!validEmail(email)) throw new PortalError('Enter a valid email address.');
      patch.email = email;
      for (const field of STUDENT_EMAIL_FIELDS) if (Object.hasOwn(student, field)) patch[field] = email;
    }
    if (['phoneCountry', 'phoneNationalNumber', 'whatsapp'].some((field) => Object.hasOwn(input, field))) {
      let phone;
      try { phone = validateWhatsAppNumber({ phoneCountry: input.phoneCountry, whatsapp: input.phoneNationalNumber ?? input.whatsapp }); }
      catch (error) { throw new PortalError(error.message); }
      Object.assign(patch, phone);
      for (const field of STUDENT_PHONE_FIELDS) if (Object.hasOwn(student, field)) patch[field] = phone.whatsapp;
    }
    if (!Object.keys(patch).length) throw new PortalError('Enter a name, email or phone update.');
    return patch;
  }
  async function saveProfile(auth, patch) {
    const studentRef = apps.doc(auth.student.id);
    return db.runTransaction(async (tx) => {
      const [saved, session, credential] = await Promise.all([tx.get(studentRef), tx.get(sessions.doc(auth.key)), tx.get(credentials.doc(auth.student.id))]);
      const student = saved.exists ? { ...saved.data(), id: saved.id } : null;
      if (!sessionMatches(session.data(), student, credential) || contactProof(student) !== contactProof(auth.student)) throw invalidSession();
      const claims = await readContactClaims(tx, student, patch);
      for (const claim of claims) tx.set(claim.ref, claim.value);
      tx.update(studentRef, patch);
      return studentResponse({ ...student, ...patch }, credential);
    });
  }
  async function sendChallenge(ref, email, name, code, purpose) {
    try { await sendCode(email, name, code, purpose); }
    catch { await ref.delete(); throw new PortalError('The verification email could not be sent. Please try again later or contact admissions.', 503, 'email_unavailable'); }
  }

  return {
    async lookup({ identifier }, ip) {
      await throttle(`lookup-ip:${ip}`, 60);
      const parsed = contactIdentifier(identifier);
      if (!parsed) throw new PortalError('Enter your registered email address or complete phone number.');
      await throttle(`lookup-contact:${parsed.type}:${parsed.value}`, 30);
      const matches = await matchingStudents(parsed);
      const enrollments = await Promise.all(matches.map(async (student) => ({ id: student.id,
        track: normalizeProgrammeName(student.track || student.course || student.courseName || student.program),
        cohortId: recordCohortId(student), pinRequired: (await credentials.doc(student.id).get()).exists })));
      return { enrollments };
    },
    async login({ identifier, studentId, pin }, ip) {
      await throttle(`login-ip:${ip}`, 60);
      const parsed = contactIdentifier(identifier);
      const student = parsed && await loadStudent(studentId);
      if (!student || !isPaidOrEnrolled(student) || !contactMatches(student, parsed)) throw invalidLogin();
      await throttle(`pin-account:${student.id}`, 8);
      const credential = await credentials.doc(student.id).get();
      if (credential.exists && !pin) throw new PortalError('Enter your PIN to sign in to this enrollment.', 403, 'PIN_REQUIRED');
      if (credential.exists && !healthyCredential(credential)) throw new PortalError('Your PIN details need an admissions review. Please use verified email recovery or contact admissions.', 503, 'pin_unavailable');
      if (credential.exists && !await verifyPin(pin, credential.data())) throw invalidLogin();
      const token = newPortalToken();
      const key = portalSessionKey(token, secret);
      const session = { studentId: student.id, mode: credential.exists ? 'pin' : 'legacy', version: credentialVersion(credential), createdAt: clock(), expires: clock() + PORTAL_SESSION_TTL_MS };
      const authenticated = await db.runTransaction(async (tx) => {
        const [fresh, currentCredential] = await Promise.all([tx.get(apps.doc(student.id)), tx.get(credentials.doc(student.id))]);
        const current = fresh.exists ? { ...fresh.data(), id: fresh.id } : null;
        if (!current || !isPaidOrEnrolled(current) || !contactMatches(current, parsed) || credentialProof(currentCredential) !== credentialProof(credential)) throw invalidLogin();
        tx.create(sessions.doc(key), session);
        return studentResponse(current, currentCredential);
      });
      return { ...authenticated, sessionToken: token };
    },
    async restore(token) {
      const auth = await requireSession(token);
      return studentResponse(auth.student, auth.credential);
    },
    async assessmentStatus({ includeQuestions }, token) {
      return finalAssessment.studentState(await requireSession(token), includeQuestions === true);
    },
    async assessmentStart(input, token) {
      await finalAssessment.start(input, (tx) => requireSession(token, tx));
      return finalAssessment.studentState(await requireSession(token), true);
    },
    assessmentSave(input, token) {
      return finalAssessment.save(input, (tx) => requireSession(token, tx));
    },
    assessmentSubmit(input, token) {
      return finalAssessment.submit(input, (tx) => requireSession(token, tx));
    },
    async logout(token) {
      if (validPortalToken(token)) await sessions.doc(portalSessionKey(token, secret)).delete();
      return { message: 'You have been signed out.' };
    },
    async updateProfile(input, token, ip) {
      await throttle(`profile-ip:${ip}`, 60);
      const auth = await requireSession(token);
      const patch = profilePatch(auth.student, input);
      const previous = getStudentLogin(auth.student);
      const proposedEmail = Object.hasOwn(patch, 'email') ? patch.email : emailValue(previous.email);
      const emailChanged = proposedEmail !== emailValue(previous.email);
      const phoneChanged = Object.hasOwn(patch, 'whatsapp') && normalizePhone(previous.whatsapp) !== normalizePhone(patch.whatsapp);
      const recoveryEmail = emailValue(auth.credential.data()?.recoveryEmail);
      const recoveryRepair = auth.credential.exists && Object.hasOwn(patch, 'email') && !validEmail(recoveryEmail);
      const contactChanged = emailChanged || phoneChanged || recoveryRepair;
      await assertNoContactCollision(auth.student, patch);
      if (!auth.credential.exists || !contactChanged) return { ...await saveProfile(auth, patch), message: 'Your profile has been updated.' };
      await throttle(`pin-account:${auth.student.id}`, 8);
      if (!input.pin) throw new PortalError('Enter your current PIN to verify your contact changes.', 403, 'PIN_REQUIRED');
      if (!await verifyPin(input.pin, auth.credential.data())) throw invalidLogin();
      const deliveryEmail = emailChanged || recoveryRepair ? proposedEmail : recoveryEmail;
      if (!validEmail(deliveryEmail)) throw new PortalError('Verify your current PIN and a new email address to establish your recovery email, or contact admissions.', 503, 'recovery_unavailable');
      await throttle(`profile-code-account:${auth.student.id}`, 3);
      const challenge = randomToken(), code = randomCode(), ref = challenges.doc(challenge);
      await ref.create({ purpose: 'profile', studentId: auth.student.id, sessionKey: auth.key,
        contactProof: contactProof(auth.student), credentialProof: credentialProof(auth.credential),
        patch, recoveryEmail: deliveryEmail, code: digest(`portal-profile:${challenge}:${code}`, secret), expires: clock() + 600000, attempts: 0 });
      await sendChallenge(ref, deliveryEmail, patch.fullName || auth.student.fullName || auth.student.name || '', code, 'profile');
      return { challenge, email: deliveryEmail, verificationRequired: true, message: 'Enter the six-digit verification code sent to this email to save your contact details.' };
    },
    async verifyProfile({ challenge, code }, token, ip) {
      await throttle(`profile-verify-ip:${ip}`, 120);
      const auth = await requireSession(token);
      if (!validPortalToken(challenge) || !/^\d{6}$/.test(code || '')) throw new PortalError('Enter the six-digit code from your email.');
      const challengeRef = challenges.doc(challenge);
      const entry = (await challengeRef.get()).data();
      if (entry?.purpose !== 'profile' || entry.studentId !== auth.student.id || entry.sessionKey !== auth.key) throw new PortalError('That verification code is incorrect, expired, or already used.', 403, 'invalid_code');
      await assertNoContactCollision(auth.student, entry.patch);
      const sessionToken = newPortalToken(), newSessionKey = portalSessionKey(sessionToken, secret);
      const result = await db.runTransaction(async (tx) => {
        const [saved, currentStudent, currentCredential, currentSession] = await Promise.all([tx.get(challengeRef), tx.get(apps.doc(auth.student.id)), tx.get(credentials.doc(auth.student.id)), tx.get(sessions.doc(auth.key))]);
        const pending = saved.data(), student = currentStudent.exists ? { ...currentStudent.data(), id: currentStudent.id } : null;
        if (!pending || pending.purpose !== 'profile' || pending.studentId !== auth.student.id || pending.sessionKey !== auth.key || pending.used || pending.expires <= clock() || pending.attempts >= 5 || !sessionMatches(currentSession.data(), student, currentCredential) || pending.contactProof !== contactProof(student) || pending.credentialProof !== credentialProof(currentCredential)) return null;
        if (!equal(pending.code, digest(`portal-profile:${challenge}:${code}`, secret))) { tx.update(challengeRef, { attempts: pending.attempts + 1 }); return null; }
        const claims = await readContactClaims(tx, student, pending.patch);
        const version = randomToken();
        for (const claim of claims) tx.set(claim.ref, claim.value);
        tx.update(apps.doc(student.id), pending.patch);
        tx.update(credentials.doc(student.id), { version, recoveryEmail: pending.recoveryEmail, updatedAt: FieldValue.serverTimestamp() });
        tx.update(sessions.doc(auth.key), { revoked: true });
        tx.create(sessions.doc(newSessionKey), { studentId: student.id, mode: 'pin', version, createdAt: clock(), expires: clock() + PORTAL_SESSION_TTL_MS });
        tx.update(challengeRef, { used: true, code: FieldValue.delete(), patch: FieldValue.delete() });
        return studentResponse({ ...student, ...pending.patch }, currentCredential);
      });
      if (!result) throw new PortalError('That verification code is incorrect, expired, or already used. Request a new code.', 403, 'invalid_code');
      return { ...result, sessionToken, message: 'Your profile has been updated.' };
    },
    async requestPin({ studentId, email } = {}, token, ip) {
      await throttle(`pin-email-ip:${ip}`, 60);
      let student;
      if (validPortalToken(token)) student = (await requireSession(token)).student;
      else student = await loadStudent(studentId);
      const primaryEmail = student ? emailValue(getStudentLogin(student).email) : '';
      const candidateEmail = emailValue(email);
      await throttle(`pin-email-contact:${candidateEmail || primaryEmail}`, 3);
      const challenge = randomToken();
      const credential = student && await credentials.doc(student.id).get();
      const recoveryEmail = credential?.exists ? emailValue(credential.data()?.recoveryEmail) : primaryEmail;
      if (!student || !isPaidOrEnrolled(student) || (candidateEmail && candidateEmail !== primaryEmail && candidateEmail !== recoveryEmail) || (!validPortalToken(token) && !candidateEmail)) return { challenge, message: 'If these details match your enrollment, a verification code has been sent to your registered email. It expires in 10 minutes.' };
      if (!validEmail(recoveryEmail)) throw new PortalError('Your PIN recovery details need an admissions review. If you know your PIN, sign in and verify a new email in your profile.', 503, 'recovery_unavailable');
      await throttle(`pin-email-account:${student.id}`, 3);
      const code = randomCode(), ref = challenges.doc(challenge);
      await ref.create({ purpose: 'pin', studentId: student.id, email: recoveryEmail,
        contactProof: contactProof(student), credentialProof: credentialProof(credential),
        code: digest(`portal-pin:${challenge}:${code}`, secret), expires: clock() + 600000, attempts: 0 });
      await sendChallenge(ref, recoveryEmail, student.fullName || student.name || '', code, 'portal');
      return { challenge, message: 'If these details match your enrollment, a verification code has been sent to your registered email. It expires in 10 minutes.' };
    },
    async setPin({ challenge, code, pin }, ip) {
      await throttle(`pin-setup-ip:${ip}`, 120);
      if (!validPortalToken(challenge) || !/^\d{6}$/.test(code || '')) throw new PortalError('Enter the six-digit code from your email.');
      if (!validPin(pin)) throw new PortalError('Choose 6–10 digits. Avoid repeated digits or simple sequences.');
      const ref = challenges.doc(challenge), before = (await ref.get()).data();
      if (!before || before.purpose !== 'pin' || !validId(before.studentId)) throw new PortalError('That code is incorrect, expired, or already used.', 403, 'invalid_code');
      const encoded = await hashPin(pin);
      const accepted = await db.runTransaction(async (tx) => {
        const [saved, currentStudent, credential] = await Promise.all([tx.get(ref), tx.get(apps.doc(before.studentId)), tx.get(credentials.doc(before.studentId))]);
        const pending = saved.data(), student = currentStudent.exists ? { ...currentStudent.data(), id: currentStudent.id } : null;
        const recoveryEmail = credential.exists ? emailValue(credential.data()?.recoveryEmail) : emailValue(getStudentLogin(student || {}).email);
        if (!pending || pending.purpose !== 'pin' || pending.studentId !== before.studentId || pending.used || pending.expires <= clock() || pending.attempts >= 5 || !student || !isPaidOrEnrolled(student) || pending.contactProof !== contactProof(student) || pending.email !== recoveryEmail || pending.credentialProof !== credentialProof(credential)) return false;
        if (!equal(pending.code, digest(`portal-pin:${challenge}:${code}`, secret))) { tx.update(ref, { attempts: pending.attempts + 1 }); return false; }
        tx.set(credentials.doc(student.id), { ...encoded, recoveryEmail: pending.email, version: randomToken(), updatedAt: FieldValue.serverTimestamp() });
        tx.update(ref, { used: true, code: FieldValue.delete() });
        return true;
      });
      if (!accepted) throw new PortalError('That code is incorrect, expired, or already used. Request a new code.', 403, 'invalid_code');
      return { message: 'Your PIN has been saved. Sign in again using your registered email or phone number and this PIN.' };
    },
  };
}
