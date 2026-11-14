import { academyDb } from './academy-db.mjs';
import { digest } from './attendance-security.mjs';
import { createAttendanceEmailSender } from './attendance-email.mjs';
import { assessmentAdminCookie, createAssessmentAdminAuth, readAssessmentAdminCookie } from './final-assessment-admin.mjs';
import { createFinalAssessmentService, FinalAssessmentError } from './final-assessment.mjs';

const maxBytes = 240_000;
const reply = (body, status = 200, headers = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers },
});

export async function handleFinalAssessmentAdmin(request, context, env = process.env, services) {
  try {
    if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) {
      return reply({ error: 'Open the academy website and try again.' }, 403);
    }
    if (Number(request.headers.get('content-length')) > maxBytes) return reply({ error: 'The assessment file is too large.' }, 413);
    const text = await request.text();
    if (Buffer.byteLength(text) > maxBytes) return reply({ error: 'The assessment file is too large.' }, 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid assessment request.' }, 400);
    const { action, ...input } = body;
    if (!['requestCode', 'verifyCode', 'logout', 'overview', 'studentResult', 'publish', 'review'].includes(action)) {
      return reply({ error: 'Unknown assessment request.' }, 400);
    }
    const token = readAssessmentAdminCookie(request);
    if (action === 'logout' && !token) return reply({ signedOut: true });
    const { auth, assessments } = services || (() => {
      const db = academyDb(env);
      return {
        auth: createAssessmentAdminAuth({ db,
          secret: digest('ovtech-assessment-admin-v1', JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).private_key),
          email: String(env.FINAL_ASSESSMENT_ADMIN_EMAIL || 'onevoicetech2023@gmail.com').trim().toLowerCase(),
          sendCode: createAttendanceEmailSender({ env }),
        }),
        assessments: createFinalAssessmentService({ db }),
      };
    })();
    if (action === 'requestCode') return reply(await auth.requestCode(input, context?.ip || 'unknown'));
    if (action === 'verifyCode') return reply({ verified: true }, 200, { 'Set-Cookie': assessmentAdminCookie(await auth.verifyCode(input)) });
    if (action === 'logout') {
      await auth.logout(token);
      return reply({ signedOut: true }, 200, { 'Set-Cookie': assessmentAdminCookie('', true) });
    }
    const admin = await auth.requireSession(token);
    return reply(await assessments[action](input, admin));
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Invalid assessment request.' }, 400);
    if (error instanceof FinalAssessmentError) {
      return reply({ error: error.message, code: error.code }, error.status,
        error.status === 401 ? { 'Set-Cookie': assessmentAdminCookie('', true) } : {});
    }
    return reply({ error: 'Final assessment administration is temporarily unavailable. Please try again.' }, 503);
  }
}
