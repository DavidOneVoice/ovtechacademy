import { STUDENT_EMAIL_FIELDS } from '../src/lms/enrollment.js';

export const PORTAL_CREDENTIAL_MIGRATION = 'portal-pin-recovery-email-20261003-v1';
const statuses = ['bound', 'alreadyBound', 'skippedMissingCredential', 'skippedMissingApplication', 'skippedInvalidCredential'];
const validEmail = (value) => typeof value === 'string' && value.length <= 254
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
const healthyCredential = (credential) => typeof credential?.version === 'string' && Boolean(credential.version.trim())
  && typeof credential.salt === 'string' && /^[a-f0-9]{32}$/.test(credential.salt)
  && typeof credential.hash === 'string' && /^[a-f0-9]{128}$/.test(credential.hash);

function registeredEmail(student) {
  // Preserve the same primary-first ordering used by portal lookup. A malformed
  // nonblank primary address cannot silently fall back to a different mailbox.
  for (const field of STUDENT_EMAIL_FIELDS) {
    const value = student[field];
    if (value == null || (typeof value === 'string' && !value.trim())) continue;
    if (typeof value !== 'string') throw new Error('PIN recovery migration requires a valid registered email; no recovery address was changed.');
    const normalized = value.trim().toLowerCase();
    if (!validEmail(normalized)) throw new Error('PIN recovery migration requires a valid registered email; no recovery address was changed.');
    return normalized;
  }
  throw new Error('PIN recovery migration requires a registered email; no recovery address was changed.');
}

const validManifest = (saved) => saved?.version === 1 && Array.isArray(saved.credentialIds)
  && saved.credentialIds.every((id) => typeof id === 'string' && id && !id.includes('/'))
  && new Set(saved.credentialIds).size === saved.credentialIds.length;

// Existing PINs were created after proof of the registered email. Freeze that
// address in the server-private credential without rehashing/replacing any PIN.
// Future resets deliver to this private address, never an arbitrary public
// application edit. This migration does not establish admin authentication or
// change the legacy application's public-read rules.
export async function migratePortalCredentials(db, now = () => new Date()) {
  const marker = db.collection('academyMigrations').doc(PORTAL_CREDENTIAL_MIGRATION);
  const credentials = db.collection('attendanceCredentials');
  const applications = db.collection('scholarshipApplications');
  let saved = (await marker.get()).data();
  if (saved?.completedAt) return { ...saved.counts, alreadyComplete: true };
  if (!saved) {
    const snapshot = await credentials.get();
    // Never claim or overwrite an address that a newer setup/profile flow has
    // already established. Later credentials are outside this frozen inventory.
    const credentialIds = snapshot.docs.filter((document) => !Object.hasOwn(document.data(), 'recoveryEmail')).map((document) => document.id);
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(marker)).exists) tx.create(marker, { version: 1, startedAt: now(), credentialIds });
    });
    saved = (await marker.get()).data();
  }
  if (!validManifest(saved)) throw new Error('Unexpected PIN recovery migration manifest; no further credentials were changed.');
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const id of saved.credentialIds) {
    const credentialRef = credentials.doc(id);
    const applicationRef = applications.doc(id);
    const backup = marker.collection('originalCredentialFields').doc(id);
    const status = await db.runTransaction(async (tx) => {
      const [credentialSnapshot, applicationSnapshot, checkpoint] = await Promise.all([tx.get(credentialRef), tx.get(applicationRef), tx.get(backup)]);
      if (checkpoint.exists) {
        const previous = checkpoint.data();
        if (previous.documentId !== id || !previous.processedAt || !statuses.includes(previous.status)) throw new Error('Unexpected PIN recovery checkpoint; no further credentials were changed.');
        return previous.status;
      }
      const credential = credentialSnapshot.data();
      let status;
      if (!credentialSnapshot.exists) status = 'skippedMissingCredential';
      else if (Object.hasOwn(credential, 'recoveryEmail')) {
        if (!validEmail(String(credential.recoveryEmail || '').trim().toLowerCase())) throw new Error('An existing PIN recovery address needs review; no recovery address was changed.');
        status = 'alreadyBound';
      } else if (!healthyCredential(credential)) status = 'skippedInvalidCredential';
      else if (!applicationSnapshot.exists) status = 'skippedMissingApplication';
      else {
        const recoveryEmail = registeredEmail(applicationSnapshot.data());
        // The absent original field and completed checkpoint are written in the
        // same transaction as the new address. Concurrent PIN/profile changes
        // trigger a transaction re-read rather than an old credential overwrite.
        tx.create(backup, { documentId: id, status: 'bound', processedAt: now(), fields: ['recoveryEmail'], absentFields: ['recoveryEmail'], originalFields: {} });
        tx.update(credentialRef, { recoveryEmail });
        return 'bound';
      }
      tx.create(backup, { documentId: id, status, processedAt: now(), fields: [], absentFields: [], originalFields: {} });
      return status;
    });
    counts[status]++;
  }
  await marker.update({ completedAt: now(), counts });
  return counts;
}
