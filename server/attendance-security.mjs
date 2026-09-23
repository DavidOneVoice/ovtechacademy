import { randomBytes, randomInt, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const randomToken = () => randomBytes(32).toString('hex');
export const randomCode = () => String(randomInt(100000, 1000000));
export const digest = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const validPin = (pin) => /^\d{6,10}$/.test(pin || '') && !/^(\d)\1+$/.test(pin) && !'01234567890123456789'.includes(pin) && !'98765432109876543210'.includes(pin);
export async function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: (await scrypt(pin, salt, 64)).toString('hex') };
}
export async function verifyPin(pin, credential) {
  if (!/^\d{6,10}$/.test(pin || '') || !credential?.hash || !credential?.salt) return false;
  return equal((await scrypt(pin, credential.salt, 64)).toString('hex'), credential.hash);
}
export function grantToken(payload, secret, now = Date.now()) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, expires: now + 300000 })).toString('base64url');
  return `${encoded}.${digest(`attendance-grant:${encoded}`, secret)}`;
}
export function readGrant(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [encoded, signature, extra] = token.split('.');
  if (extra || !equal(signature, digest(`attendance-grant:${encoded}`, secret))) return null;
  try { const grant = JSON.parse(Buffer.from(encoded, 'base64url').toString()); return grant.expires > now ? grant : null; } catch { return null; }
}
