import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
export function academyApp(env = process.env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Academy service configuration is unavailable.');
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (account.project_id !== 'ovtechacad') throw new Error('Unexpected academy project.');
  return getApps().find((app) => app.name === 'academy-admissions') || initializeApp({ credential: cert(account) }, 'academy-admissions');
}
export const academyDb = (env) => getFirestore(academyApp(env));
