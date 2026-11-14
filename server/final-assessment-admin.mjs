import { digest, equal, randomCode, randomToken } from './attendance-security.mjs';
import { validPortalToken } from './portal-security.mjs';
import { FinalAssessmentError } from './final-assessment.mjs';

const sessionLength = 8 * 60 * 60 * 1000;
const codeLength = 10 * 60 * 1000;
const rateWindow = 15 * 60 * 1000;
const cookieName = '__Host-ovtech_assessment_admin';
const adminRequired = () => new FinalAssessmentError('Verify your academy email to access final assessment results.', 401, 'assessment_admin_required');

export function assessmentAdminCookie(token = '', clear = false) {
  return `${cookieName}=${token}; Path=/; Max-Age=${clear ? 0 : sessionLength / 1000}; HttpOnly; Secure; SameSite=Strict`;
}

export function readAssessmentAdminCookie(request) {
  const matches = (request.headers.get('cookie') || '').split(';').map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${cookieName}=`));
  const token = matches.length === 1 ? matches[0].slice(cookieName.length + 1) : '';
  return validPortalToken(token) ? token : '';
}

export function createAssessmentAdminAuth({ db, secret, email, sendCode, now = Date.now }) {
  const collection = db.collection('vaAssessmentAdminAuth');
  const sessionRef = (token) => collection.doc(digest(`assessment-admin-session:${token}`, secret));
  const emailKey = digest(`assessment-admin-principal:${email}`, secret);

  async function throttle(ip) {
    const ipRef = collection.doc(digest(`assessment-admin-code-ip:${ip}`, secret));
    const emailRef = collection.doc(digest('assessment-admin-code-global', secret));
    await db.runTransaction(async (tx) => {
      const [ipLimit, emailLimit] = await Promise.all([tx.get(ipRef), tx.get(emailRef)]);
      const timestamp = now();
      const counters = [[ipRef, ipLimit.data(), 4], [emailRef, emailLimit.data(), 12]];
      for (const [ref, counter, max] of counters) {
        const active = counter?.until > timestamp;
        if (active && counter.count >= max) throw new FinalAssessmentError('Too many verification requests. Please try again in 15 minutes.', 429, 'assessment_admin_rate_limit');
        tx.set(ref, { count: active ? counter.count + 1 : 1, until: active ? counter.until : timestamp + rateWindow });
      }
    });
  }

  return {
    async requestCode({ email: submittedEmail }, ip) {
      const requested = typeof submittedEmail === 'string' ? submittedEmail.trim().toLowerCase() : '';
      if (requested !== email) throw new FinalAssessmentError('Enter the email authorised to manage final assessments.', 403, 'assessment_admin_email');
      await throttle(ip);
      const challenge = randomToken();
      const ref = collection.doc(challenge);
      const code = randomCode();
      await ref.create({ emailKey, code: digest(`assessment-admin-code:${challenge}:${code}`, secret), expires: now() + codeLength, attempts: 0 });
      try { await sendCode(email, 'OVTech Academy administrator', code, 'assessment-admin'); }
      catch {
        await ref.delete();
        throw new FinalAssessmentError('The verification email could not be sent. Please try again.', 503, 'assessment_admin_email_unavailable');
      }
      return { challenge };
    },

    async verifyCode({ challenge, code }) {
      if (!validPortalToken(challenge) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        throw new FinalAssessmentError('Enter the six-digit code from your email.');
      }
      const ref = collection.doc(challenge);
      const token = randomToken();
      const verified = await db.runTransaction(async (tx) => {
        const saved = (await tx.get(ref)).data();
        if (!saved || saved.emailKey !== emailKey || saved.expires <= now() || saved.attempts >= 5 || saved.used) return false;
        if (!equal(saved.code, digest(`assessment-admin-code:${challenge}:${code}`, secret))) {
          tx.update(ref, { attempts: saved.attempts + 1 });
          return false;
        }
        tx.update(ref, { used: true });
        tx.create(sessionRef(token), { emailKey, expires: now() + sessionLength });
        return true;
      });
      if (!verified) throw new FinalAssessmentError('That code is incorrect, expired or already used.', 403, 'assessment_admin_invalid_code');
      return token;
    },

    async requireSession(token) {
      if (!token) throw adminRequired();
      const session = (await sessionRef(token).get()).data();
      if (!session || session.emailKey !== emailKey || session.expires <= now()) throw adminRequired();
      return email;
    },

    async logout(token) {
      if (token) await sessionRef(token).delete();
    },
  };
}
