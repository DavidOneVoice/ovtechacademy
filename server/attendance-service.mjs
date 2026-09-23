import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import { attendanceDate, eligibleForSession, isLiveAttendanceStudent, attendanceStats } from '../src/attendance/model.js';
import { recordCohortId, cohortLabel } from '../src/data/cohort.js';
import { normalizeProgrammeName } from '../src/data/programmes.js';
import { randomToken, randomCode, digest, equal, validPin, hashPin, verifyPin, grantToken, readGrant } from './attendance-security.mjs';
export class AttendanceError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
const invalid = () => new AttendanceError('We could not verify those details. Check your registered email and attendance PIN.', 403);
export function createAttendanceService({ db, secret, sendCode, now = () => Date.now() }) {
  const apps = db.collection('scholarshipApplications');
  const sessions = db.collection('attendanceSessions');
  const credentials = db.collection('attendanceCredentials');
  const challenges = db.collection('attendanceChallenges');
  const limits = db.collection('attendanceRateLimits');
  async function throttle(key, maximum, milliseconds) {
    const ref = limits.doc(digest(key, secret));
    const permitted = await db.runTransaction(async (tx) => {
      const saved = (await tx.get(ref)).data();
      const active = saved && saved.until > now();
      if (active && saved.count >= maximum) return false;
      tx.set(ref, { count: active ? saved.count + 1 : 1, until: active ? saved.until : now() + milliseconds }); return true;
    });
    if (!permitted) throw new AttendanceError('Too many attempts. Please wait 15 minutes before trying again.', 429);
  }
  async function sessionData(id) {
    if (!validId(id)) throw new AttendanceError('Invalid attendance link.', 404);
    const data = (await sessions.doc(id).get()).data();
    if (!data) throw new AttendanceError('This attendance link was not found.', 404);
    if (data.dateKey !== attendanceDate(new Date(now()))) throw new AttendanceError('This link has expired. Ask your instructor for today’s attendance link.', 410);
    return data;
  }
  async function findStudent(email, studentId, session) {
    const address = String(email || '').trim().toLowerCase();
    if (!address || address.length > 254) return null;
    // The lookup stays on the server. No class roster or contact list is sent to browsers.
    const snapshot = validId(studentId) ? [await apps.doc(studentId).get()] : (await apps.where('status', '==', 'Enrolled').get()).docs;
    const candidates = snapshot.filter((doc) => doc.exists).map((doc) => ({ ...doc.data(), id: doc.id })).filter((student) => String(student.email || '').trim().toLowerCase() === address && (session ? eligibleForSession(student, session) : isLiveAttendanceStudent(student)));
    if (candidates.length !== 1) return null;
    const profile = (await db.collection('certificateProfile').doc(candidates[0].id).get()).data();
    return String(profile?.status || '').toLowerCase() === 'approved' ? null : candidates[0];
  }
  return {
    async session(id) {
      const session = await sessionData(id);
      return { track: normalizeProgrammeName(session.track), cohort: cohortLabel(recordCohortId(session)), dateKey: session.dateKey };
    },
    async requestPin({ email, studentId, sessionId }, ip) {
      await throttle(`email-ip:${ip}`, 60, 900000);
      await throttle(`email:${String(email).trim().toLowerCase()}`, 3, 900000);
      const session = sessionId ? await sessionData(sessionId) : null;
      const student = await findStudent(email, studentId, session);
      const challenge = randomToken();
      if (student) {
        const code = randomCode();
        await challenges.doc(challenge).create({ studentId: student.id, code: digest(`${challenge}:${code}`, secret), expires: now() + 600000, attempts: 0 });
        try { await sendCode(student.email, student.fullName, code); }
        catch { await challenges.doc(challenge).delete(); throw new AttendanceError('The verification email could not be sent. Contact admissions for help setting up your attendance PIN.', 503); }
      }
      return { challenge, message: 'If these details match an enrolled live-class student, a verification code has been sent to the registered email. It expires in 10 minutes.' };
    },
    async setPin({ challenge, code, pin }, ip) {
      await throttle(`setup-ip:${ip}`, 120, 900000);
      if (!/^[a-f0-9]{64}$/.test(challenge || '') || !/^\d{6}$/.test(code || '')) throw new AttendanceError('Enter the six-digit code from your email.');
      if (!validPin(pin)) throw new AttendanceError('Choose 6–10 digits. Avoid repeated digits or simple sequences.');
      const encoded = await hashPin(pin);
      const accepted = await db.runTransaction(async (tx) => {
        const ref = challenges.doc(challenge); const entry = (await tx.get(ref)).data();
        if (!entry || entry.used || entry.expires <= now() || entry.attempts >= 5) return false;
        if (!equal(entry.code, digest(`${challenge}:${code}`, secret))) { tx.update(ref, { attempts: entry.attempts + 1 }); return false; }
        tx.set(credentials.doc(entry.studentId), { ...encoded, version: randomToken(), updatedAt: FieldValue.serverTimestamp() });
        tx.update(ref, { used: true, code: FieldValue.delete() }); return true;
      });
      if (!accepted) throw new AttendanceError('That code is incorrect, expired, or already used. Request a new code.', 403);
      return { message: 'Attendance PIN saved. Keep it private. You can now verify your details on the attendance page.' };
    },
    async verify({ sessionId, email, pin }, ip) {
      await throttle(`verify-ip:${ip}`, 120, 900000);
      await throttle(`verify-email:${String(email).trim().toLowerCase()}`, 8, 900000);
      const session = await sessionData(sessionId);
      const student = await findStudent(email, null, session);
      const credential = student && (await credentials.doc(student.id).get()).data();
      if (!await verifyPin(pin, credential)) throw invalid();
      const existing = (await sessions.doc(sessionId).collection('records').doc(student.id).get()).exists;
      return { grant: grantToken({ studentId: student.id, sessionId, version: credential.version }, secret, now()), student: { fullName: student.fullName, track: normalizeProgrammeName(session.track), cohort: cohortLabel(recordCohortId(student)), ...attendanceStats(student, session.track) }, alreadyMarked: existing };
    },
    async mark({ grant: token }, ip) {
      await throttle(`mark-ip:${ip}`, 50, 900000);
      const grant = readGrant(token, secret, now());
      if (!grant || !validId(grant.studentId) || !validId(grant.sessionId)) throw invalid();
      const result = await db.runTransaction(async (tx) => {
        const studentRef = apps.doc(grant.studentId), sessionRef = sessions.doc(grant.sessionId), recordRef = sessionRef.collection('records').doc(grant.studentId);
        const [studentSnap, sessionSnap, credentialSnap, recordSnap, profileSnap] = await Promise.all([tx.get(studentRef), tx.get(sessionRef), tx.get(credentials.doc(grant.studentId)), tx.get(recordRef), tx.get(db.collection('certificateProfile').doc(grant.studentId))]);
        const student = studentSnap.data(), session = sessionSnap.data();
        if (!student || !session || String(profileSnap.data()?.status || '').toLowerCase() === 'approved' || !eligibleForSession(student, session) || credentialSnap.data()?.version !== grant.version) throw invalid();
        if (session.dateKey !== attendanceDate(new Date(now()))) throw new AttendanceError('This attendance link has expired.', 410);
        if (recordSnap.exists) return { alreadyMarked: true };
        const originalTrack = Object.keys(student.attendance || {}).find((key) => normalizeProgrammeName(key) === normalizeProgrammeName(session.track)) || normalizeProgrammeName(session.track);
        tx.create(recordRef, { studentId: grant.studentId, track: normalizeProgrammeName(session.track), cohortId: recordCohortId(student), sessionId: grant.sessionId, dateKey: session.dateKey, markedAt: FieldValue.serverTimestamp(), verification: 'attendance-pin-v1' });
        tx.update(studentRef, new FieldPath('attendance', originalTrack, 'attendedDays'), FieldValue.increment(1), 'attendanceMarkedSessions', FieldValue.arrayUnion(grant.sessionId), 'lastAttendanceMarkedAt', FieldValue.serverTimestamp());
        return { alreadyMarked: false };
      });
      return { ...result, message: result.alreadyMarked ? 'Your attendance was already recorded for this class.' : 'Your attendance has been recorded successfully.' };
    },
  };
}
