import { getSecurityRules } from 'firebase-admin/security-rules';
import { academyApp, academyDb } from '../server/academy-db.mjs';
import { migrateCohorts } from '../server/cohort-migration.mjs';
import { attendanceRules } from '../server/attendance-rules.mjs';
import { migrateDataAnalyticsDay39 } from '../server/data-analytics-day39-migration.mjs';

if (process.env.CONTEXT !== 'production' || process.env.BRANCH !== 'master') {
  console.log('Database preparation skipped outside the production master deployment.');
} else {
  const app = academyApp(), db = academyDb(), rules = getSecurityRules(app);
  // Read the live rules, apply only the reviewed attendance changes, retain the
  // exact previous source in a private backup, and refuse unexpected layouts.
  const previous = await rules.getFirestoreRuleset();
  const source = previous.source[0]?.content;
  if (!source) throw new Error('Could not read current Firestore rules.');
  const updated = attendanceRules(source);
  if (updated !== source) {
    const backup = db.collection('academyMigrations').doc('attendance-pin-rules-v1');
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(backup)).exists) tx.create(backup, { ruleset: previous.name, source, savedAt: new Date() });
    });
    await rules.releaseFirestoreRulesetFromSource(updated);
    await backup.update({ deployedAt: new Date() });
    console.log('Attendance verification rules deployed; previous rules saved.');
  }
  const counts = await migrateCohorts(db);
  console.log(JSON.stringify({ cohortMigration: counts }));
  const curriculum = await migrateDataAnalyticsDay39(db);
  console.log(JSON.stringify({ dataAnalyticsDay39: curriculum }));
}
