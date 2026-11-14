import { createHash, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { digest, equal, randomToken } from './attendance-security.mjs';
import { validPortalToken } from './portal-security.mjs';
import { ownerDigest } from './admin-setup-config.mjs';
import { FinalAssessmentError } from './final-assessment.mjs';

const derivePassword = promisify(scrypt);
const cookieName = '__Host-ovtech_admin';
const sessionLength = 8 * 60 * 60_000;
const windowLength = 15 * 60_000;
const passwordCost = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const ownerLogin = 'admin@ovtechacademy.com';
const signedOut = () => new FinalAssessmentError('Sign in to your admin dashboard to continue.', 401, 'admin_sign_in_required');
const badLogin = () => new FinalAssessmentError('The admin email or password is incorrect.', 401, 'admin_invalid_login');
const fingerprint = (value) => createHash('sha256').update(value).digest('hex');

export function adminCookie(token = '', clear = false) {
  return `${cookieName}=${token}; Path=/; Max-Age=${clear ? 0 : sessionLength / 1000}; HttpOnly; Secure; SameSite=Strict`;
}

export function readAdminCookie(request) {
  const entries = (request.headers.get('cookie') || '').split(';').map((item) => item.trim())
    .filter((item) => item.startsWith(`${cookieName}=`));
  const token = entries.length === 1 ? entries[0].slice(cookieName.length + 1) : '';
  return validPortalToken(token) ? token : '';
}

export function createAdminAuth({ db, secret, now = Date.now, ownerSetupDigest = ownerDigest }) {
  const auth = db.collection('academyAdminAuth');
  const owner = auth.doc('owner');
  const sessionRef = (token) => auth.doc(digest(`admin-session:${token}`, secret));

  async function limit(key, ip) {
    const ref = auth.doc(digest(`admin-tries:${key}:${ip}`, secret));
    await db.runTransaction(async (tx) => {
      const previous = (await tx.get(ref)).data();
      const time = now();
      const active = previous?.until > time;
      if (active && previous.count >= 8) throw new FinalAssessmentError('Too many sign-in attempts. Try again in 15 minutes.', 429, 'admin_rate_limit');
      tx.set(ref, { count: active ? previous.count + 1 : 1, until: active ? previous.until : time + windowLength });
    });
  }

  return {
    async login({ email, password }, ip) {
      if (typeof email !== 'string' || email.trim().toLowerCase() !== ownerLogin ||
        typeof password !== 'string' || !password || password.length > 256) throw badLogin();
      await limit('login', ip);
      const saved = (await owner.get()).data();
      if (!saved) throw new FinalAssessmentError('Set your admin password using the private setup link.', 409, 'admin_setup_required');
      const value = (await derivePassword(password, saved.salt, 64, passwordCost)).toString('hex');
      if (!equal(value, saved.hash)) throw badLogin();
      const token = randomToken();
      await sessionRef(token).create({ role: 'admin', expires: now() + sessionLength });
      return token;
    },

    async setup({ setupToken, password }, ip) {
      if (!validPortalToken(setupToken) || !equal(fingerprint(setupToken), ownerSetupDigest)) {
        await limit('setup', ip);
        throw new FinalAssessmentError('This admin setup link is invalid.', 403, 'admin_setup_invalid');
      }
      if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
        throw new FinalAssessmentError('Choose a new admin password of at least 12 characters.', 400, 'admin_password_invalid');
      }
      if ((await owner.get()).exists) throw new FinalAssessmentError('An admin password is already set. Sign in to continue.', 409, 'admin_setup_complete');
      const salt = randomBytes(16).toString('hex');
      const hash = (await derivePassword(password, salt, 64, passwordCost)).toString('hex');
      const token = randomToken();
      await db.runTransaction(async (tx) => {
        if ((await tx.get(owner)).exists) throw new FinalAssessmentError('An admin password is already set. Sign in to continue.', 409, 'admin_setup_complete');
        tx.create(owner, { salt, hash, createdAt: now() });
        tx.create(sessionRef(token), { role: 'admin', expires: now() + sessionLength });
      });
      return token;
    },

    async requireSession(token) {
      if (!validPortalToken(token)) throw signedOut();
      const session = (await sessionRef(token).get()).data();
      if (!session || session.role !== 'admin' || session.expires <= now()) throw signedOut();
      return ownerLogin;
    },

    async logout(token) {
      if (validPortalToken(token)) await sessionRef(token).delete();
    },
  };
}
