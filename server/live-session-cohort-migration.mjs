import { LEGACY_COHORT } from '../src/data/cohort.js';
import { LEGACY_LIVE_RECORDING_IDS } from './legacy-live-recordings.mjs';

export const LIVE_SESSION_COHORT_MIGRATION = 'live-session-cohorts-20261020-v1';
const statuses = ['assigned', 'preserved', 'missing'];
const historicalIds = new Set(LEGACY_LIVE_RECORDING_IDS);
const validManifest = (saved) => saved?.version === 1 && Array.isArray(saved.documentIds)
  && saved.documentIds.length === historicalIds.size && new Set(saved.documentIds).size === historicalIds.size
  && saved.documentIds.every((id) => historicalIds.has(id));
const unassigned = (value) => value == null || (typeof value === 'string' && !value.trim());

// Only the reviewed historical IDs belong to this migration. No collection scan
// or recording date can scoop a newly uploaded October/future-cohort recording
// into July. Every assignment and its original field are checkpointed atomically
// under the server-private academyMigrations rules.
export async function migrateLiveSessionCohorts(db, now = () => new Date()) {
  const marker = db.collection('academyMigrations').doc(LIVE_SESSION_COHORT_MIGRATION);
  let saved = (await marker.get()).data();
  if (saved?.completedAt) return { ...saved.counts, alreadyComplete: true };
  if (!saved) {
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(marker)).exists) tx.create(marker, { version: 1, startedAt: now(), documentIds: [...LEGACY_LIVE_RECORDING_IDS] });
    });
    saved = (await marker.get()).data();
  }
  if (!validManifest(saved)) throw new Error('Unexpected live-recording cohort migration manifest; no further recordings were changed.');
  const recordings = db.collection('liveSessions');
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const id of saved.documentIds) {
    const ref = recordings.doc(id);
    const backup = marker.collection('originalCohortFields').doc(id);
    const status = await db.runTransaction(async (tx) => {
      const [current, checkpoint] = await Promise.all([tx.get(ref), tx.get(backup)]);
      if (checkpoint.exists) {
        const previous = checkpoint.data();
        if (previous.documentId !== id || !previous.processedAt || !statuses.includes(previous.status)) throw new Error('Unexpected live-recording cohort checkpoint; no further recordings were changed.');
        return previous.status;
      }
      if (!current.exists) {
        tx.create(backup, { documentId: id, documentExisted: false, hadCohortId: false, status: 'missing', processedAt: now() });
        return 'missing';
      }
      const data = current.data();
      const hadCohortId = Object.hasOwn(data, 'cohortId');
      const status = unassigned(data.cohortId) ? 'assigned' : 'preserved';
      tx.create(backup, { documentId: id, documentExisted: true, hadCohortId, ...(hadCohortId ? { cohortId: data.cohortId } : {}), status, processedAt: now() });
      // Updating only cohortId retains all recording contents, dates, attachments,
      // audience settings, timestamps and original document/watch links.
      if (status === 'assigned') tx.update(ref, { cohortId: LEGACY_COHORT.id });
      return status;
    });
    counts[status]++;
  }
  await marker.update({ completedAt: now(), counts });
  return counts;
}
