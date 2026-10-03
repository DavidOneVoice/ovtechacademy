import { digest, randomToken } from './attendance-security.mjs';

export const PORTAL_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const PORTAL_COOKIE = 'ovtech_portal';
export const validPortalToken = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const portalSessionKey = (token, secret) => digest(`portal-session:${token}`, secret);
export const newPortalToken = randomToken;
export const portalCookie = (token = '', clear = false) => `${PORTAL_COOKIE}=${token}; Path=/api/portal; Max-Age=${clear ? 0 : PORTAL_SESSION_TTL_MS / 1000}; HttpOnly; Secure; SameSite=Strict`;
export function readPortalCookie(request) {
  const entries = String(request.headers.get('cookie') || '').split(';').map((entry) => entry.trim());
  const matching = entries.filter((entry) => entry.startsWith(`${PORTAL_COOKIE}=`));
  if (matching.length !== 1) return '';
  const token = matching[0].slice(PORTAL_COOKIE.length + 1);
  return validPortalToken(token) ? token : '';
}
