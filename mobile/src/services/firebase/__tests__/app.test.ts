/**
 * Tests for the emulator-vs-production toggle in ../app.ts.
 *
 * This module had NO test coverage until a real-device failure traced back
 * to exactly the logic below: `isEmulatorEnabled()` used to return `true`
 * whenever EXPO_PUBLIC_USE_FIREBASE_EMULATORS was absent, in every build
 * type. A release APK whose .env.production values didn't reach the bundle
 * therefore ran in emulator mode against 10.0.2.2/localhost -- unreachable
 * from a real phone -- so every sign-in failed with a generic error, and no
 * reCAPTCHA UI ever appeared (SignInScreen only mounts the production
 * verifier when NOT in emulator mode). These tests pin the corrected
 * behavior so that default can never silently come back.
 */

/** ../app.ts reads the toggle at import time, so each case re-imports it
 * with a different env/build combination via jest.resetModules(). */
function loadAppModule(env: {
  toggle?: string;
  devBuild: boolean;
}): typeof import('../app') {
  jest.resetModules();
  if (env.toggle === undefined) {
    delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
  } else {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = env.toggle;
  }
  (globalThis as { __DEV__?: boolean }).__DEV__ = env.devBuild;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after resetModules() to re-read the env
  return require('../app');
}

describe('isEmulatorEnabled', () => {
  const originalToggle = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    if (originalToggle === undefined) {
      delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
    } else {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = originalToggle;
    }
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.resetModules();
  });

  it('honours an explicit "false" in a dev build', () => {
    expect(loadAppModule({ toggle: 'false', devBuild: true }).isEmulatorEnabled()).toBe(
      false
    );
  });

  it('honours an explicit "true" in a release build (deliberate emulator use)', () => {
    expect(loadAppModule({ toggle: 'true', devBuild: false }).isEmulatorEnabled()).toBe(
      true
    );
  });

  it('defaults to emulators in a dev build when the toggle is absent', () => {
    expect(loadAppModule({ toggle: undefined, devBuild: true }).isEmulatorEnabled()).toBe(
      true
    );
  });

  it('defaults to the REAL backend in a release build when the toggle is absent -- a release build must never silently talk to localhost', () => {
    // Regression test for the production outage described in this file's
    // header: this case used to return `true`.
    expect(loadAppModule({ toggle: undefined, devBuild: false }).isEmulatorEnabled()).toBe(
      false
    );
  });

  it('treats an unrecognized value the same as absent (build-type dependent)', () => {
    expect(loadAppModule({ toggle: 'yes', devBuild: false }).isEmulatorEnabled()).toBe(
      false
    );
    expect(loadAppModule({ toggle: 'yes', devBuild: true }).isEmulatorEnabled()).toBe(true);
  });
});

/**
 * Session persistence -- what makes a signed-in member stay signed in
 * across app restarts.
 *
 * React Native has no browser storage, so firebase/auth falls back to
 * IN-MEMORY persistence unless it is explicitly handed
 * getReactNativePersistence(AsyncStorage). Losing that argument would not
 * break another test, fail typecheck or lint, or show up anywhere in the
 * UI -- it would simply sign every user out each time they closed the app.
 * That is exactly the shape of the emulator-default bug this file was
 * created for, so it gets the same treatment: pinned by test.
 */
describe('auth session persistence', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.resetModules();
  });

  it('initializes Auth with AsyncStorage-backed React Native persistence', () => {
    const app = loadAppModule({ toggle: 'false', devBuild: false });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must read the same module instance the loaded app.ts used
    const firebaseAuth = require('firebase/auth');

    expect(firebaseAuth.getReactNativePersistence).toHaveBeenCalled();
    expect(firebaseAuth.initializeAuth).toHaveBeenCalledWith(
      app.firebaseApp,
      expect.objectContaining({ persistence: expect.anything() })
    );
    // The persistence handed over must be the one built from AsyncStorage,
    // not merely some value of the right shape.
    const [, options] = firebaseAuth.initializeAuth.mock.calls[0];
    expect(options.persistence).toBe(
      firebaseAuth.getReactNativePersistence.mock.results[0].value
    );
  });

  it('passes the AsyncStorage module itself to getReactNativePersistence', () => {
    loadAppModule({ toggle: 'false', devBuild: false });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseAuth = require('firebase/auth');
    // The community Jest mock is CommonJS (module.exports = {...}), so it
    // has no `.default` -- app.ts's default import resolves to the module
    // object itself via esModuleInterop. Handle both shapes so this keeps
    // asserting the real thing if the mock ever gains a default export.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorageModule = require('@react-native-async-storage/async-storage');
    const AsyncStorage = asyncStorageModule.default ?? asyncStorageModule;

    expect(firebaseAuth.getReactNativePersistence).toHaveBeenCalledWith(AsyncStorage);
  });

  it('falls back to getAuth() when Auth is already initialized (Metro Fast Refresh re-runs this module)', () => {
    // Deliberately does NOT use loadAppModule(): that calls
    // jest.resetModules() itself, which would discard the firebase/auth
    // instance the mock below is installed on, leaving app.ts to import a
    // fresh, un-stubbed one. Reset first, then stub, then import.
    jest.resetModules();
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = 'false';
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseAuth = require('firebase/auth');
    firebaseAuth.initializeAuth.mockImplementationOnce(() => {
      throw new Error('already-initialized');
    });

    // Must not throw: a Fast Refresh re-run has to keep working, not crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const app = require('../app');

    expect(firebaseAuth.getAuth).toHaveBeenCalled();
    expect(app.auth).toBeDefined();
  });
});

describe('assertProductionConfigSane', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.resetModules();
  });

  const realConfig = {
    apiKey: 'real-key',
    authDomain: 'bethaniyaministries-production.firebaseapp.com',
    projectId: 'bethaniyaministries-production',
    storageBucket: 'bethaniyaministries-production.appspot.com',
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:abcdef',
  };

  /** ../app.ts calls assertProductionConfigSane() itself at import time
   * (with whatever env this test process actually has), so clear the spy
   * after loading to isolate the explicit call under test from that
   * import-time one. */
  function loadAndClear(env: { toggle?: string; devBuild: boolean }) {
    const app = loadAppModule(env);
    errorSpy.mockClear();
    return app;
  }

  it('shouts when a release build is using emulators', () => {
    const app = loadAndClear({ toggle: 'true', devBuild: false });
    app.assertProductionConfigSane(true, realConfig);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('RELEASE BUILD IS USING FIREBASE EMULATORS')
    );
  });

  it('shouts when a release build has only the demo project config (env never reached the bundle)', () => {
    const app = loadAndClear({ toggle: 'false', devBuild: false });
    app.assertProductionConfigSane(false, {
      ...realConfig,
      projectId: 'demo-bethaniya-ministries',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('NO REAL FIREBASE PROJECT CONFIG')
    );
  });

  it('stays quiet for a correctly configured release build', () => {
    const app = loadAndClear({ toggle: 'false', devBuild: false });
    app.assertProductionConfigSane(false, realConfig);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('stays quiet in a dev build, where emulators are the norm', () => {
    const app = loadAndClear({ toggle: 'true', devBuild: true });
    app.assertProductionConfigSane(true, realConfig);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
