import { createHash } from 'node:crypto';
import { academyDb } from './academy-db.mjs';
import { digest, equal } from './attendance-security.mjs';
import { adminCookie, createAdminAuth, readAdminCookie } from './admin-auth.mjs';
import { bankDigest, bootstrapDigest } from './admin-setup-config.mjs';
import { COHORT } from '../src/data/cohort.js';
import { createFinalAssessmentService, FinalAssessmentError } from './final-assessment.mjs';

const maxBytes = 240_000;
const productionOrigin = 'https://ovtechacademy.com';
const reply = (body, status = 200, cookie) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(cookie ? { 'Set-Cookie': cookie } : {}) },
});

function isBankImport(authHeader, expectedDigest) {
  if (!/^Bearer [0-9a-f]{64}$/.test(authHeader || '')) return false;
  return equal(createHash('sha256').update(authHeader.slice(7)).digest('hex'), expectedDigest);
}

export async function handleFinalAssessmentAdmin(request, context, env = process.env, services) {
  try {
    if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
    const origin = new URL(request.url).origin;
    if (request.headers.get('origin') !== origin || !request.headers.get('content-type')?.startsWith('application/json')) {
      return reply({ error: 'Open the academy website and try again.' }, 403);
    }
    if (Number(request.headers.get('content-length')) > maxBytes) return reply({ error: 'The assessment request is too large.' }, 413);
    const text = await request.text();
    if (Buffer.byteLength(text) > maxBytes) return reply({ error: 'The assessment request is too large.' }, 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid assessment request.' }, 400);
    const { action, ...input } = body;
    if (!['login', 'setup', 'session', 'logout', 'overview', 'studentResult', 'publish', 'review', 'installBank'].includes(action)) {
      return reply({ error: 'Unknown assessment request.' }, 400);
    }
    const importing = action === 'installBank';
    if ((!services && origin !== productionOrigin && (importing || action === 'setup')) ||
        (importing && !isBankImport(request.headers.get('authorization'), services?.importDigest || bootstrapDigest))) {
      return reply({ error: 'Request unavailable.' }, 403);
    }
    const token = readAdminCookie(request);
    const ip = context?.ip || 'unknown';
    if (action === 'logout' && !token) return reply({ signedOut: true }, 200, adminCookie('', true));
    const { auth, assessments } = services || (() => {
      const db = academyDb(env);
      return {
        auth: createAdminAuth({ db, secret: digest('ovtech-admin-v1', JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).private_key) }),
        assessments: createFinalAssessmentService({ db }),
      };
    })();
    if (importing) {
      return reply(await assessments.installBank(input, services?.bankDigest || bankDigest, COHORT));
    }
    if (action === 'login' || action === 'setup') {
      const session = await auth[action](input, ip);
      return reply({ role: 'admin' }, 200, adminCookie(session));
    }
    if (action === 'logout') {
      await auth.logout(token);
      return reply({ signedOut: true }, 200, adminCookie('', true));
    }
    const admin = await auth.requireSession(token);
    if (action === 'session') return reply({ role: 'admin' });
    return reply(await assessments[action](input, admin));
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Invalid assessment request.' }, 400);
    if (error instanceof FinalAssessmentError) return reply({ error: error.message, code: error.code }, error.status,
      error.code === 'admin_sign_in_required' ? adminCookie('', true) : undefined);
    return reply({ error: 'Final assessment administration is temporarily unavailable. Please try again.' }, 503);
  }
}
