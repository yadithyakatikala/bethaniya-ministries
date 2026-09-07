/**
 * Firebase SDK initialization for the admin dashboard, wired to the local
 * Firebase Emulator Suite for development.
 *
 * Day 1 deferred this deliberately (see the "Day 1 note" in ./config.ts).
 * Now that the app actually needs to talk to Auth/Firestore/Storage, this
 * module creates the real SDK instances.
 *
 * Local development uses the Firebase Emulator Suite exclusively (see
 * firebase.json's `emulators` block and ENVIRONMENT.md "Developing without
 * Blaze"): the dev Firebase project (bethaniya-ministries-dev-58588) stays
 * on the free Spark plan, and Cloud Storage / Cloud Functions on that
 * project require the Blaze plan, which is intentionally not attached.
 * Auth, Firestore, and Storage emulators run entirely on this machine and
 * never touch the real backend, regardless of the real project's billing
 * plan or whether .env.local has been filled in at all -- so this module
 * falls back to safe placeholder config values when real ones are absent,
 * matching Firebase's own documented "demo project" pattern for
 * emulator-only development (see
 * https://firebase.google.com/docs/emulator-suite -- any config value is
 * acceptable once every SDK instance is connected to a local emulator
 * before its first real use).
 *
 * Toggle: VITE_USE_FIREBASE_EMULATORS (default: "true"). Set to "false"
 * only once this app is meant to talk to a real Firebase backend, which
 * requires real values in .env.local and, for Storage/Functions, a
 * Blaze-upgraded project.
 */

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import {
  type FirebaseStorage,
  connectStorageEmulator,
  getStorage,
} from 'firebase/storage';
import {
  type Functions,
  connectFunctionsEmulator,
  getFunctions,
} from 'firebase/functions';

import { type FirebaseWebConfig, getFirebaseConfig } from './config';

const DEMO_CONFIG: FirebaseWebConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'demo-bethaniya-ministries',
  storageBucket: 'demo-bethaniya-ministries.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

export function isEmulatorEnabled(): boolean {
  return (import.meta.env.VITE_USE_FIREBASE_EMULATORS ?? 'true') !== 'false';
}

/**
 * Fills in any missing real config field with the safe demo value. Only
 * meaningful when useEmulators is true -- emulators never validate these
 * values against a real backend, so a partially/fully unfilled
 * .env.local doesn't block local development.
 */
export function resolveFirebaseConfig(useEmulators: boolean): FirebaseWebConfig {
  const real = getFirebaseConfig();
  if (!useEmulators) return real;
  return {
    apiKey: real.apiKey || DEMO_CONFIG.apiKey,
    authDomain: real.authDomain || DEMO_CONFIG.authDomain,
    projectId: real.projectId || DEMO_CONFIG.projectId,
    storageBucket: real.storageBucket || DEMO_CONFIG.storageBucket,
    messagingSenderId: real.messagingSenderId || DEMO_CONFIG.messagingSenderId,
    appId: real.appId || DEMO_CONFIG.appId,
  };
}

const useEmulators = isEmulatorEnabled();
const config = resolveFirebaseConfig(useEmulators);

// Firebase's app registry (getApps()) persists across Vite HMR module
// re-evaluation, so an already-existing app means this module is being
// re-run, not started fresh -- connecting an already-connected instance's
// emulators a second time throws, so only connect when the app is new.
const existingApp = getApps()[0];
export const firebaseApp: FirebaseApp = existingApp ?? initializeApp(config);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
// Day 4: needed to call the logAdminAction callable (Day 3) from real admin
// actions -- see services/firebase/auditLog.ts. Not used before Day 4.
export const functions: Functions = getFunctions(firebaseApp);

if (useEmulators && !existingApp) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export const usingFirebaseEmulators = useEmulators;
