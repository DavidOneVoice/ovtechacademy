import { academyDb } from '../../server/academy-db.mjs';
import { DEFAULT_COHORTS, sortCohorts } from '../../src/data/cohort.js';
export default async function () {
  try {
    const snapshot = await academyDb().collection('cohorts').get();
    const saved = snapshot.docs.map((doc) => ({ id: doc.id, label: doc.data().label, ...(doc.data().startDate ? { startDate: doc.data().startDate } : {}) }));
    return Response.json({ cohorts: sortCohorts([...DEFAULT_COHORTS, ...saved]) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Cohort catalogue unavailable.' }, { status: 503 }); }
}
export const config = { path: '/api/cohorts' };
