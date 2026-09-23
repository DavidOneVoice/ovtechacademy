import { DEFAULT_COHORTS, LEGACY_COHORT } from '../src/data/cohort.js';
export const COHORT_MIGRATION = 'cohorts-july-october-2026-v1';
export async function migrateCohorts(db, now = () => new Date()) {
  const migrationRef = db.collection('academyMigrations').doc(COHORT_MIGRATION);
  const existing = (await migrationRef.get()).data();
  if (existing?.completedAt) return { ...existing.counts, alreadyComplete: true };
  // Fix the original membership before modifying records. A resumed build uses
  // this same list and will never scoop up later records from a new intake.
  if (!existing) {
    const [applications, sessions] = await Promise.all([db.collection('scholarshipApplications').get(), db.collection('attendanceSessions').get()]);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(migrationRef)).exists) return;
      tx.create(migrationRef, { startedAt: now(), applications: applications.docs.filter((doc) => !doc.data().cohortId).map((doc) => doc.id), sessions: sessions.docs.filter((doc) => !doc.data().cohortId).map((doc) => doc.id) });
    });
  }
  for (const cohort of DEFAULT_COHORTS) await db.runTransaction(async (tx) => {
    const ref = db.collection('cohorts').doc(cohort.id);
    if (!(await tx.get(ref)).exists) tx.create(ref, { ...cohort, createdAt: now() });
  });
  const saved = (await migrationRef.get()).data();
  const counts = { applications: 0, sessions: 0 };
  for (const [key, collection] of [['applications', 'scholarshipApplications'], ['sessions', 'attendanceSessions']]) {
    for (const id of saved[key]) {
      await db.runTransaction(async (tx) => {
        const ref = db.collection(collection).doc(id), backup = migrationRef.collection('originalCohortFields').doc(`${key}-${id}`);
        const [snapshot, original] = await Promise.all([tx.get(ref), tx.get(backup)]);
        if (!snapshot.exists || snapshot.data().cohortId) return;
        const data = snapshot.data();
        if (!original.exists) tx.create(backup, { collection, documentId: id, hadCohortId: Object.hasOwn(data, 'cohortId'), ...(Object.hasOwn(data, 'cohortId') ? { cohortId: data.cohortId } : {}), savedAt: now() });
        // No document moves; no contact, payment, portal, progress, or certificate fields change.
        tx.update(ref, { cohortId: LEGACY_COHORT.id });
      });
    }
    counts[key] = saved[key].length;
  }
  await migrationRef.update({ completedAt: now(), counts });
  return counts;
}
