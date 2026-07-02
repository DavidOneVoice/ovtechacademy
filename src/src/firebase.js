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

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyB5GOMutv7v4ZHgi01_cnytcif1luFvu18",
  authDomain: "ovtechacad.firebaseapp.com",
  projectId: "ovtechacad",
  storageBucket: "ovtechacad.firebasestorage.app",
  messagingSenderId: "228669791106",
  appId: "1:228669791106:web:7151c4f6d83f1a0ce80d9b",
};

const envFirebaseConfig = Object.fromEntries(
  firebaseEnvRequirements.map(({ configKey, value }) => [configKey, value]),
);

export const missingFirebaseEnvKeys = firebaseEnvRequirements
  .filter(({ value }) => !value)
  .map(({ envKey }) => envKey);

const hasCompleteEnvConfig = missingFirebaseEnvKeys.length === 0;
const firebaseConfig = hasCompleteEnvConfig
  ? envFirebaseConfig
  : fallbackFirebaseConfig;

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

if (!hasCompleteEnvConfig) {
  console.warn(
    `Missing Firebase environment configuration: ${missingFirebaseEnvKeys.join(", ")}. ` +
      "Using the checked-in OVTech Firebase config fallback so Firebase-backed features remain available.",
  );
}

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
