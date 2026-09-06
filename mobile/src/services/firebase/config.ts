/**
 * Firebase configuration for the mobile app.
 *
 * Values are read from EXPO_PUBLIC_* environment variables (see .env.example).
 * These are NOT secrets — Firebase web/client config values are safe to ship in a client
 * binary. Actual access control is enforced by Firestore/Storage security rules and
 * Firebase Auth, never by hiding this config. See /SECURITY.md.
 *
 * Env vars are referenced statically (process.env.EXPO_PUBLIC_X, never via a dynamic
 * key) because Metro/Expo replaces EXPO_PUBLIC_* references at build time and cannot
 * inline a dynamically-computed lookup (enforced by the expo/no-dynamic-env-var lint rule).
 *
 * Day 1 note: this file defines the config shape and warns on missing values instead of
 * throwing, since no real Firebase project exists yet. Day 2 will tighten this once
 * .env.local is required for local development.
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
    apiKey: warnIfMissing(
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY
    ),
    authDomain: warnIfMissing(
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
    ),
    projectId: warnIfMissing(
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
    ),
    storageBucket: warnIfMissing(
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
    ),
    messagingSenderId: warnIfMissing(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    ),
    appId: warnIfMissing(
      'EXPO_PUBLIC_FIREBASE_APP_ID',
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID
    ),
  };
}

export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
