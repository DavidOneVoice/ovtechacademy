import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseEnvRequirements = [
  {
    configKey: "apiKey",
    envKey: "VITE_FIREBASE_API_KEY",
    value: import.meta.env.VITE_FIREBASE_API_KEY,
  },
  {
    configKey: "authDomain",
    envKey: "VITE_FIREBASE_AUTH_DOMAIN",
    value: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  },
  {
    configKey: "projectId",
    envKey: "VITE_FIREBASE_PROJECT_ID",
    value: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  },
  {
    configKey: "storageBucket",
    envKey: "VITE_FIREBASE_STORAGE_BUCKET",
    value: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  },
  {
    configKey: "messagingSenderId",
    envKey: "VITE_FIREBASE_MESSAGING_SENDER_ID",
    value: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  },
  {
    configKey: "appId",
    envKey: "VITE_FIREBASE_APP_ID",
    value: import.meta.env.VITE_FIREBASE_APP_ID,
  },
];

const firebaseConfig = Object.fromEntries(
  firebaseEnvRequirements.map(({ configKey, value }) => [configKey, value]),
);

export const missingFirebaseEnvKeys = firebaseEnvRequirements
  .filter(({ value }) => !value)
  .map(({ envKey }) => envKey);

export const isFirebaseConfigured = missingFirebaseEnvKeys.length === 0;

if (!isFirebaseConfigured) {
  console.warn(
    `Missing Firebase environment configuration: ${missingFirebaseEnvKeys.join(", ")}. ` +
      "Firebase-backed features are disabled until these VITE_FIREBASE_* values are set to the active Firebase project and the app is rebuilt.",
  );
} else {
  console.info("Firebase config loaded", {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  });
}

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
