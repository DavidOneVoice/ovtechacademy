import { createHash } from 'node:crypto';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { academyApp, academyDb } from '../server/academy-db.mjs';
import { migrateCohorts } from '../server/cohort-migration.mjs';
import { attendanceRules } from '../server/attendance-rules.mjs';

if (process.env.CONTEXT !== 'production' || process.env.BRANCH !== 'master') {
  console.log('Database preparation skipped outside the production master deployment.');
} else {
  const app = academyApp(), db = academyDb(), rules = getSecurityRules(app);
  // Read the live rules, apply only the reviewed attendance changes, retain the
  // exact previous source in a private backup, and refuse unexpected layouts.
  const previous = await rules.getFirestoreRuleset();
  const source = previous.source[0]?.content;
  if (!source) throw new Error('Could not read current Firestore rules.');
  const normalized = source.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
  console.log('OVTECH_RULES_DIAGNOSTIC ' + JSON.stringify({
    sha256: createHash('sha256').update(source).digest('hex'),
    normalizedSha256: createHash('sha256').update(normalized).digest('hex'),
    functions: [...source.matchAll(/function\s+(\w+)/g)].map((match) => match[1]),
    matches: [...source.matchAll(/match\s+([^\n]+)\s*\{/g)].map((match) => match[1]),
    attendanceRules: source.slice(source.indexOf('match /attendanceSessions'), source.indexOf('match /attendanceSessions') + 600).replace(/'[^']*'|"[^"]*"/g, "'[literal]'"),
  }));
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
}
