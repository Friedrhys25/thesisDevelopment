// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔐 Firebase configuration using environment variables
// Never hardcode API keys! Use .env.local for local development
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
    console.error("Please create a .env.local file with your Firebase configuration.");
    console.error("Copy .env.example to .env.local and fill in your values.");
  }
}

// 🔧 Initialize Firebase - Prevent duplicate app initialization
// This check prevents "Firebase App already exists" error during hot reload
let app;
try {
  // Check if Firebase app is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    // Use existing app
    app = getApp();
    console.log("✅ Firebase app already initialized");
  } else {
    // Initialize new app
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase app initialized successfully");
  }
} catch (error: any) {
  console.error("❌ Firebase initialization error:", error.message);
  // Fallback: try to get existing app
  try {
    app = getApp();
  } catch {
    // If all else fails, initialize fresh
    app = initializeApp(firebaseConfig);
  }
}

// Export Firebase services
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const firestore = getFirestore(app);

export default app;
