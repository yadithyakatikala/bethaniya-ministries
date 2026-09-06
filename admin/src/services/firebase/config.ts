/**
 * Firebase configuration for the admin dashboard.
 *
 * Values come from VITE_* environment variables (see .env.example). These are not
 * secrets; access control is enforced by Firestore/Storage security rules and
 * Firebase Auth (see /SECURITY.md), not by hiding this config.
 *
 * Day 1: defines the config shape only. The Firebase SDK itself (initializeApp,
 * getAuth, getFirestore, ...) is wired up on Day 2 once real Firebase projects exist.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function warnIfMissing(name: string, value: string | undefined): string {
  if (!value) {
    console.warn(`[firebase/config] Missing environment variable: ${name}`);
    return '';
  }
  return value;
}

export function getFirebaseConfig(): FirebaseWebConfig {
  return {
    apiKey: warnIfMissing('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: warnIfMissing(
      'VITE_FIREBASE_AUTH_DOMAIN',
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    ),
    projectId: warnIfMissing(
      'VITE_FIREBASE_PROJECT_ID',
      import.meta.env.VITE_FIREBASE_PROJECT_ID
    ),
    storageBucket: warnIfMissing(
      'VITE_FIREBASE_STORAGE_BUCKET',
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    ),
    messagingSenderId: warnIfMissing(
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    ),
    appId: warnIfMissing('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
  };
}

export const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development';
