import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CANONICAL_PROGRAMMES, normalizeProgrammeName } from '../src/data/programmes.js';
import { canonicalAttendanceMap } from '../src/attendance/model.js';

export const PROGRAMME_IDENTITY_MIGRATION = 'canonical-programme-identity-20261003-v1';
const collections = ['scholarshipApplications', 'liveSessions', 'attendanceSessions'];
const scalarFields = ['track', 'course', 'courseName', 'program'];
const arrayFields = ['tracks', 'courses', 'enrolledCourses'];

const canonicalValue = (value) => {
  if (typeof value !== 'string') return value;
  const canonical = normalizeProgrammeName(value);
  return CANONICAL_PROGRAMMES.includes(canonical) ? canonical : value;
};

const canonicalValues = (values) => {
  if (!Array.isArray(values)) return values;
  const seen = new Set();
  return values.flatMap((value) => {
    const canonical = canonicalValue(value);
    if (typeof canonical !== 'string' || !CANONICAL_PROGRAMMES.includes(canonical)) return [value];
    if (seen.has(canonical)) return [];
    seen.add(canonical);
    return [canonical];
  });
};

export function programmeIdentityPatch(collection, data) {
  const patch = {};
  const fields = collection === 'scholarshipApplications' ? scalarFields : ['track'];
  for (const field of fields) {
    if (!Object.hasOwn(data, field)) continue;
    const value = canonicalValue(data[field]);
    if (!isDeepStrictEqual(value, data[field])) patch[field] = value;
  }
  if (collection === 'scholarshipApplications') {
    for (const field of arrayFields) {
      if (!Object.hasOwn(data, field)) continue;
      const value = canonicalValues(data[field]);
      if (!isDeepStrictEqual(value, data[field])) patch[field] = value;
    }
    if (Object.hasOwn(data, 'attendance')) {
      const attendance = canonicalAttendanceMap(data.attendance);
      if (!isDeepStrictEqual(attendance, data.attendance)) patch.attendance = attendance;
    }
  }
  return patch;
}

const checkpointId = (collection, id) => createHash('sha256').update(`${collection}/${id}`).digest('hex');
const validManifest = (saved) => saved?.version === 1 && collections.every((collection) =>
  Array.isArray(saved.documents?.[collection]) && saved.documents[collection].every((id) => typeof id === 'string' && id && !id.includes('/')));

// This is an Admin SDK migration. Original programme fields/counters are stored
// only under the private academyMigrations rules, together with each document's
// checkpoint. No session/record IDs, links, lesson IDs or payment facts change.
export async function migrateProgrammeIdentity(db, now = () => new Date()) {
  const marker = db.collection('academyMigrations').doc(PROGRAMME_IDENTITY_MIGRATION);
  let saved = (await marker.get()).data();
  if (saved?.completedAt) return { ...saved.counts, alreadyComplete: true };
  if (!saved) {
    const snapshots = await Promise.all(collections.map((collection) => db.collection(collection).get()));
    const documents = Object.fromEntries(collections.map((collection, index) => [collection, snapshots[index].docs.map((document) => document.id)]));
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(marker)).exists) tx.create(marker, { version: 1, startedAt: now(), documents });
    });
    saved = (await marker.get()).data();
  }
  if (!validManifest(saved)) throw new Error('Unexpected programme identity migration manifest; no further documents were changed.');
  const counts = Object.fromEntries(collections.map((collection) => [collection, { updated: 0, unchanged: 0, missing: 0 }]));
  for (const collection of collections) {
    for (const id of saved.documents[collection]) {
      const ref = db.collection(collection).doc(id);
      const backup = marker.collection('originalProgrammeFields').doc(checkpointId(collection, id));
      const status = await db.runTransaction(async (tx) => {
        const [current, checkpoint] = await Promise.all([tx.get(ref), tx.get(backup)]);
        if (checkpoint.exists) {
          const result = checkpoint.data();
          if (result.collection !== collection || result.documentId !== id || !result.processedAt || !['updated', 'unchanged', 'missing'].includes(result.status)) {
            throw new Error('Unexpected programme identity checkpoint; no further documents were changed.');
          }
          return result.status;
        }
        if (!current.exists) {
          tx.create(backup, { collection, documentId: id, status: 'missing', processedAt: now() });
          return 'missing';
        }
        const data = current.data();
        const patch = programmeIdentityPatch(collection, data);
        const fields = Object.keys(patch);
        const status = fields.length ? 'updated' : 'unchanged';
        // Re-read inside the transaction so attendance increments and admin
        // recording edits made since the inventory are included, never reset.
        const originalFields = Object.fromEntries(fields.map((field) => [field, data[field]]));
        tx.create(backup, { collection, documentId: id, status, processedAt: now(), fields, originalFields });
        if (fields.length) tx.update(ref, patch);
        return status;
      });
      counts[collection][status]++;
    }
  }
  await marker.update({ completedAt: now(), counts });
  return counts;
}
