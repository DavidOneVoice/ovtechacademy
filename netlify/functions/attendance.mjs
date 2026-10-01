import { academyDb } from '../../server/academy-db.mjs';
import { createAttendanceService, AttendanceError } from '../../server/attendance-service.mjs';
import { digest } from '../../server/attendance-security.mjs';
import { attendanceEmailReadiness, createAttendanceEmailSender } from '../../server/attendance-email.mjs';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
export async function handleAttendance(request, context, env = process.env, injectedService) {
  try {
    const origin = new URL(request.url).origin;
    // Read-only health information contains no addresses, codes, or credentials.
    if (request.method === 'GET') return reply({ pinEmailConfigured: attendanceEmailReadiness(env).configured });
    if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
    if (request.headers.get('origin') !== origin || !request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Open attendance on the academy website and try again.' }, 403);
    if (Number(request.headers.get('content-length')) > 5000) return reply({ error: 'Request too large.' }, 413);
    const text = await request.text(); if (text.length > 5000) return reply({ error: 'Request too large.' }, 413);
    const body = JSON.parse(text);
    const service = injectedService || createAttendanceService({
      db: academyDb(env), secret: digest('ovtech-attendance-v1', JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON).private_key),
      sendCode: createAttendanceEmailSender({ env }),
    });
    // Netlify's platform IP is used, never an arbitrary forwarded header.
    const ip = context?.ip || 'unknown';
    if (body.action === 'session') return reply(await service.session(body.sessionId));
    if (!['requestPin', 'setPin', 'verify', 'mark'].includes(body.action)) return reply({ error: 'Unknown attendance request.' }, 400);
    return reply(await service[body.action](body, ip));
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: 'Invalid attendance request.' }, 400);
    return reply({ error: error instanceof AttendanceError ? error.message : 'Attendance is temporarily unavailable. Please contact admissions.' }, error.status || 503);
  }
}
export default (request, context) => handleAttendance(request, context);
export const config = { path: '/api/attendance' };
