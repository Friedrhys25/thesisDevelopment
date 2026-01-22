// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCClZL4LQep_2AiJGLAsnq818DePxn9YT4",
  authDomain: "talk2kap-8c526.firebaseapp.com",
  databaseURL: "https://talk2kap-8c526-default-rtdb.firebaseio.com",
  projectId: "talk2kap-8c526",
  storageBucket: "talk2kap-8c526.appspot.com", // ✅ must end with .appspot.com
  messagingSenderId: "608373284626",
  appId: "1:608373284626:web:9a24fc3e0b6aa2d6f5ddcb",
  measurementId: "G-4NGNTZQ24M",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const firestore = getFirestore(app);

export default app;
