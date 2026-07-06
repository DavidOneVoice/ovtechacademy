import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");
export const serviceAccountPath = path.join(
  projectRoot,
  "serviceAccountKey.json",
);

let firebaseAdmin;

export const requireConfirmation = (scriptName) => {
  if (!process.argv.includes("--confirm")) {
    console.error(
      `${scriptName} is destructive and requires explicit confirmation.`,
    );
    console.error(
      `Run again with --confirm, for example: node scripts/${scriptName} --confirm`,
    );
    process.exit(1);
  }
};

export const initializeFirebaseAdmin = async () => {
  if (!existsSync(serviceAccountPath)) {
    console.error(
      `Firebase Admin service account not found: ${serviceAccountPath}`,
    );
    console.error(
      "Add a local serviceAccountKey.json file in the project root. This file is ignored by git.",
    );
    process.exit(1);
  }

  if (!firebaseAdmin) {
    const { default: admin } = await import("firebase-admin");
    firebaseAdmin = admin;
  }

  if (firebaseAdmin.apps.length === 0) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });
  }

  return firebaseAdmin;
};

export const getFirestore = async () => {
  const admin = await initializeFirebaseAdmin();
  return admin.firestore();
};
