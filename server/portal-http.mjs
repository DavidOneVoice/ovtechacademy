import { academyDb } from './academy-db.mjs';
import { digest } from './attendance-security.mjs';
import { createAttendanceEmailSender } from './attendance-email.mjs';
import { createPortalService, PortalError } from './portal-service.mjs';
import { portalCookie, readPortalCookie } from './portal-security.mjs';
import { FinalAssessmentError } from './final-assessment.mjs';

const reply = (body, status = 200, headers = {}) => Response.json(body, { status,
  headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers } });
export async function handlePortal(request, context, env = process.env, injectedService) {
  try {
    const origin = new URL(request.url).origin;
    if (request.method !== 'POST' && request.method !== 'GET') return reply({ error: 'Use POST.', code: 'invalid_request' }, 405);
    if (request.method === 'POST' && (request.headers.get('origin') !== origin || !request.headers.get('content-type')?.startsWith('application/json'))) return reply({ error: 'Open the student portal on the academy website and try again.', code: 'invalid_origin' }, 403);
    let body = { action: 'restore' };
    if (request.method === 'POST') {
      if (Number(request.headers.get('content-length')) > 5000) return reply({ error: 'Request too large.', code: 'invalid_request' }, 413);
      const text = await request.text();
      if (text.length > 5000) return reply({ error: 'Request too large.', code: 'invalid_request' }, 413);
      body = JSON.parse(text);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Invalid portal request.', code: 'invalid_request' }, 400);
    }
    const { action, ...input } = body;
    if (!['lookup', 'login', 'restore', 'logout', 'updateProfile', 'verifyProfile', 'requestPin', 'setPin',
      'assessmentStatus', 'assessmentStart', 'assessmentSave', 'assessmentSubmit'].includes(action)) return reply({ error: 'Unknown portal request.', code: 'invalid_request' }, 400);
    const service = injectedService || createPortalService({ db: academyDb(env),
      secret: digest('ovtech-portal-v1', JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).private_key),
      sendCode: createAttendanceEmailSender({ env }) });
    const token = readPortalCookie(request), ip = context?.ip || 'unknown';
    if (action === 'lookup') return reply(await service.lookup(input, ip));
    if (action === 'login') {
      const { sessionToken, ...result } = await service.login(input, ip);
      return reply(result, 200, { 'Set-Cookie': portalCookie(sessionToken) });
    }
    if (action === 'restore') return reply(await service.restore(token));
    if (action === 'logout') return reply(await service.logout(token), 200, { 'Set-Cookie': portalCookie('', true) });
    if (action === 'setPin') return reply(await service.setPin(input, ip), 200, { 'Set-Cookie': portalCookie('', true) });
    if (action === 'verifyProfile') {
      const { sessionToken, ...result } = await service.verifyProfile(input, token, ip);
      return reply(result, 200, sessionToken ? { 'Set-Cookie': portalCookie(sessionToken) } : {});
    }
    return reply(await service[action](input, token, ip));
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Invalid portal request.', code: 'invalid_request' }, 400);
    const known = error instanceof PortalError || error instanceof FinalAssessmentError;
    const status = known ? error.status : 503;
    return reply({ error: known ? error.message : 'The student portal is temporarily unavailable. Please try again later.', code: known ? error.code : 'unavailable' }, status,
      status === 401 ? { 'Set-Cookie': portalCookie('', true) } : {});
  }
}
