/**
 * Firebase SDK initialization for the mobile app, wired to the local
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
 * Toggle: EXPO_PUBLIC_USE_FIREBASE_EMULATORS. Set to "false" only once this
 * app is meant to talk to a real Firebase backend, which requires real
 * values in .env.local and, for Storage/Functions, a Blaze-upgraded project.
 *
 * DEFAULT WHEN THE TOGGLE IS ABSENT -- this is build-type dependent, and
 * deliberately so (changed after a real-device failure; see below):
 *   - dev build   (__DEV__ true)  -> emulators ON, as before
 *   - RELEASE build (__DEV__ false) -> emulators OFF (real backend)
 *
 * Why: this used to default to "true" unconditionally. That is a
 * fail-open-to-development default, and it produced a silent, total
 * production outage that took several rounds of device testing to find.
 * If a release APK is built without .env.production's values actually
 * reaching the bundle (a very easy mistake -- Expo picks the env file by
 * build mode, and nothing fails loudly when it doesn't), then:
 *   isEmulatorEnabled() returned true -> resolveFirebaseConfig() silently
 *   substituted DEMO_CONFIG (projectId "demo-bethaniya-ministries",
 *   authDomain "localhost") -> every SDK instance was pointed at
 *   10.0.2.2/localhost, which does not exist on a real user's phone.
 * The visible result was sign-in failing with a generic error on every
 * device, and -- because SignInScreen only mounts the production reCAPTCHA
 * verifier when NOT in emulator mode -- no reCAPTCHA UI appearing at all,
 * which looked exactly like a broken verifier rather than a broken build
 * configuration. A release build must never silently talk to localhost.
 *
 * An explicit EXPO_PUBLIC_USE_FIREBASE_EMULATORS value always wins, in
 * either direction, so a release build can still be pointed at emulators
 * on purpose (and assertProductionConfigSane() below shouts about it when
 * that happens, since it is almost never intended).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
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

import { type FirebaseWebConfig, getFirebaseConfig } from './config';

const DEMO_CONFIG: FirebaseWebConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'demo-bethaniya-ministries',
  storageBucket: 'demo-bethaniya-ministries.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

/** True in a Metro dev build, false in a release bundle. Injected by Metro
 * at bundle time, NOT read from any .env file -- which is exactly why it's
 * the right signal here: it still tells the truth in the very situation
 * this guards against (a release build whose env values didn't load).
 * Read defensively so plain-Node contexts (Jest, scripts) don't throw. */
export function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

export function isEmulatorEnabled(): boolean {
  const explicit = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
  // An explicit value always wins, in either direction.
  if (explicit === 'false') return false;
  if (explicit === 'true') return true;
  // Absent/unrecognized: emulators in a dev build, real backend in a
  // release build -- see this module's header comment for why the old
  // unconditional "true" default caused a silent production outage.
  return isDevBuild();
}

/**
 * Shouts (console.error, so it lands in `adb logcat`/Xcode console for
 * release builds too) if a release build is in a configuration that cannot
 * possibly work against a real backend. Diagnostic only -- deliberately
 * does not throw, since a hard crash at import time would be a worse
 * failure mode than a loud log plus the app's normal error handling.
 */
export function assertProductionConfigSane(
  useEmulators: boolean,
  resolved: FirebaseWebConfig
): void {
  if (isDevBuild()) return;
  if (useEmulators) {
    console.error(
      '[firebase/app] RELEASE BUILD IS USING FIREBASE EMULATORS. It will try to ' +
        'reach a local emulator host that does not exist on a real device, and ' +
        'every Firebase call (including sign-in) will fail. Set ' +
        'EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false, and make sure the env file ' +
        'actually reached this build.'
    );
    return;
  }
  if (resolved.projectId === DEMO_CONFIG.projectId || !resolved.projectId) {
    console.error(
      '[firebase/app] RELEASE BUILD HAS NO REAL FIREBASE PROJECT CONFIG ' +
        `(projectId: ${resolved.projectId || '<empty>'}). The env values did not ` +
        'reach this bundle -- see .env.example and ENVIRONMENT.md.'
    );
  }
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

/**
 * Android emulators can't reach the host machine via "localhost" --
 * 10.0.2.2 is the documented alias for the host loopback interface. iOS
 * simulator and web both resolve "localhost" correctly. Override with
 * EXPO_PUBLIC_FIREBASE_EMULATOR_HOST for a real device on the same
 * network (use your machine's LAN IP in that case).
 */
export function emulatorHost(): string {
  const override = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  if (override) return override;
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

const useEmulators = isEmulatorEnabled();
const config = resolveFirebaseConfig(useEmulators);
assertProductionConfigSane(useEmulators, config);

// Firebase's app registry (getApps()) persists across Metro Fast Refresh
// module re-evaluation, so an already-existing app means this module is
// being re-run, not started fresh -- connecting an already-connected
// instance's emulators a second time throws, so only connect when the app
// is new.
const existingApp = getApps()[0];
export const firebaseApp: FirebaseApp = existingApp ?? initializeApp(config);

// initializeAuth may only be called once per app -- Fast Refresh re-runs this
// module without tearing down the previous Auth instance, so fall back to
// getAuth() if it's already initialized (the standard Expo/Firebase pattern).
export let auth: Auth;
try {
  auth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(firebaseApp);
}

// Firestore's persistentLocalCache() (initializeFirestore's IndexedDB-backed
// offline cache option) was investigated for this module and deliberately
// NOT enabled: the SDK's own React Native build (dist/index.rn.js) still
// re-exports enableIndexedDbPersistence/clearIndexedDbPersistence from the
// same shared implementation chunk the web build uses, with no React
// Native-specific storage backend or indexedDB-availability guard found in
// that bundle -- and React Native's JS engine (Hermes/JSC) has no global
// `indexedDB` by default. A synchronous try/catch around
// initializeFirestore() itself (as used for initializeAuth above) would
// NOT protect against a failure that only surfaces later, asynchronously,
// on the first real read/write deep inside the SDK's persistence layer --
// which could crash every Firestore-backed screen in the app instead of
// just silently missing an offline-cache nice-to-have. Enabling this
// safely requires real-device/simulator verification, which this
// environment cannot provide (see README.md's "Day 12" real-device-testing
// gap) -- so this stays a documented, investigated-but-deferred item
// rather than a blind guess. See PRODUCTION_READINESS.md's offline
// section.
export const db: Firestore = getFirestore(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

if (useEmulators && !existingApp) {
  const host = emulatorHost();
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
}

export const usingFirebaseEmulators = useEmulators;
