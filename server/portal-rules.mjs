import { createHash } from 'node:crypto';

const marker = '// OVTECH_PORTAL_PIN_V1';
export const portalPrivateRules = `${marker}
    // Portal sessions and verification proofs are accessible only to the trusted server.
    match /portalSessions/{id} { allow read, write: if false; }
    match /portalChallenges/{id} { allow read, write: if false; }
    match /portalRateLimits/{id} { allow read, write: if false; }
    match /portalContactLocks/{id} { allow read, write: if false; }
`;
const reviewed = new Set([
  'a2fb39296b05c877eb0c5c11f1ff6c99ee9bc88bb609bc255fc93640299ef9ab',
  '135b31485494c3dfacd35c33c3b35ac3c99a52af3776c7e2a91d98bf4b0218c4',
]);
const fingerprint = (source) => createHash('sha256').update(source.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '')).digest('hex');
export function portalRules(source) {
  const fail = () => { throw new Error('Live portal rules differ from the reviewed layouts. No rules were changed.'); };
  const existing = source.includes(marker);
  if (existing && !source.includes(portalPrivateRules)) fail();
  const baseline = existing ? source.replace(portalPrivateRules, '') : source;
  if (!reviewed.has(fingerprint(baseline))) fail();
  if (existing) return source;
  const anchor = 'match /attendanceRateLimits/{id} { allow read, write: if false; }';
  if (!source.includes(anchor)) fail();
  return source.replace(anchor, `${anchor}\n    ${portalPrivateRules}`);
}
