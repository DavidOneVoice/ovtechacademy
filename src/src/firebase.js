import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5GOMutv7v4ZHgi01_cnytcif1luFvu18",
  authDomain: "ovtechacad.firebaseapp.com",
  projectId: "ovtechacad",
  storageBucket: "ovtechacad.firebasestorage.app",
  messagingSenderId: "228669791106",
  appId: "1:228669791106:web:7151c4f6d83f1a0ce80d9b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
