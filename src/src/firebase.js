import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB5GOMutv7v4ZHgi01_cnytcif1luFvu18",
  authDomain: "ovtechacad.firebaseapp.com",
  projectId: "ovtechacad",
  storageBucket: "ovtechacad.firebasestorage.app",
  messagingSenderId: "228669791106",
  appId: "1:228669791106:web:7151c4f6d83f1a0ce80d9b",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
<<<<<<< HEAD

=======
>>>>>>> 7acfd3498376dced41b0d1386738e5e68a9c6aa3
export const auth = null;
export const isFirebaseConfigured = true;
export const missingFirebaseEnvKeys = [];
