/**
 * Creating a member's profile, end to end: a REAL sign-in, the phone's REAL
 * profile code, and the committed firestore.rules.
 *
 * The services under test are the application's own source files, loaded
 * unchanged:
 *
 *   mobile/src/services/firebase/authService.ts   how a member signs up / in
 *   mobile/src/services/firebase/userProfile.ts   what their profile is created
 *                                                 and updated with
 *
 * The rules accept a new profile's e-mail only when it is exactly the address
 * in the signed-in account's ID token. firestore.rules.test.ts proves that rule
 * with hand-made tokens; this file proves the assumption under it -- that the
 * Auth emulator's real token, for each provider the app offers, carries exactly
 * the address the client reads as `user.email` -- by letting the app do what
 * it does after every sign-in and checking the profile really exists.
 *
 * Needs the Auth and Firestore emulators (see README.md).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// The phone's `./app` module is replaced with getters, so each test hands the
// real service modules a fresh, signed-out SDK instance of its own.
const mockHandles: { auth: unknown; db: unknown } = { auth: null, db: null };

jest.mock('../../mobile/src/services/firebase/app', () => ({
  get auth() {
    return mockHandles.auth;
  },
  get db() {
    return mockHandles.db;
  },
}));

import {
  createAccountWithEmail,
  signInWithAppleIdentityToken,
  signInWithGoogleIdToken,
} from '../../mobile/src/services/firebase/authService';
import {
  completeOnboarding,
  ensureOwnProfileExists,
  updateOwnProfile,
} from '../../mobile/src/services/firebase/userProfile';

// Same project id as firestore.rules.test.ts (see the note there).
const PROJECT_ID = 'demo-no-project';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');
const PASSWORD = 'correct-horse-battery';

const CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: PROJECT_ID,
  appId: '1:000000000000:web:0000000000000000000000',
};

/** The phone's own copy of the Firebase SDK (the service modules import it). */
function mobileSdk() {
  const from = path.resolve(__dirname, '../../mobile/src/services/firebase');
  const load = (id: string) => require(require.resolve(id, { paths: [from] }));
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return {
    app: load('firebase/app') as any,
    auth: load('firebase/auth') as any,
    firestore: load('firebase/firestore') as any,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

let testEnv: RulesTestEnvironment;
let counter = 0;
const openApps: { delete: () => Promise<void>; terminate: () => Promise<void> }[] = [];
/** Unique per run, so accounts never collide with an earlier run's. */
const run = Date.now();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

/** A fresh SDK instance, wired to the emulators and handed to the phone's modules. */
function freshPhone() {
  const sdk = mobileSdk();
  counter += 1;
  const app = sdk.app.initializeApp(CONFIG, `profile-e2e-${counter}`);
  const auth = sdk.auth.getAuth(app);
  sdk.auth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = sdk.firestore.getFirestore(app);
  sdk.firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  openApps.push({
    delete: () => sdk.app.deleteApp(app),
    terminate: () => sdk.firestore.terminate(db),
  });
  mockHandles.auth = auth;
  mockHandles.db = db;
  return { sdk, auth, db };
}

afterEach(async () => {
  for (const app of openApps.splice(0)) {
    await app.terminate();
    await app.delete();
  }
});

/** The stored profile, read past the rules -- what the admin Users page would show. */
async function storedProfile(uid: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    data = (await ctx.firestore().doc(`users/${uid}`).get()).data();
  });
  return data;
}

/** The emulator's stand-in for a provider's ID token: unsigned JSON claims. */
const fakeIdToken = (claims: Record<string, unknown>) => JSON.stringify(claims);

describe("creating a member's profile after a real sign-in", () => {
  it('email/password sign-up: the profile records the account address and the server time', async () => {
    freshPhone();
    // Typed with capitals; Firebase Auth stores the address in lower case.
    const email = `Grace.Thomas.${run}@Example.org`;
    const { user } = await createAccountWithEmail(email, PASSWORD, 'Grace Thomas');
    await ensureOwnProfileExists(user);

    const profile = await storedProfile(user.uid);
    expect(profile).toBeDefined();
    expect(profile?.role).toBe('member');
    expect(profile?.email).toBe(email.toLowerCase());
    expect(profile?.email).toBe(user.email);
    expect(profile?.displayName).toBe('Grace Thomas');
    expect(typeof (profile?.createdAt as { toMillis?: unknown })?.toMillis).toBe(
      'function'
    );

    // ...and the ordinary self-updates the app makes afterwards still work.
    await expect(
      updateOwnProfile(user.uid, { themePreference: 'dark', bibleMode: 'bilingual' })
    ).resolves.toBeUndefined();
    await expect(
      completeOnboarding(user.uid, {
        fullName: 'Grace Thomas',
        phoneNumber: '+919876543210',
        gender: 'female',
        preferredLanguage: 'te',
      })
    ).resolves.toBeUndefined();
    await expect(updateOwnProfile(user.uid, { age: 34 })).resolves.toBeUndefined();
  });

  it('Google sign-in: the profile records the Google address', async () => {
    freshPhone();
    const email = `grace.google.${run}@example.org`;
    const { user } = await signInWithGoogleIdToken(
      fakeIdToken({ sub: `google-${run}`, email, email_verified: true, name: 'Grace G' })
    );
    await ensureOwnProfileExists(user);

    const profile = await storedProfile(user.uid);
    expect(profile?.email).toBe(email);
    expect(profile?.email).toBe(user.email);
  });

  it("Apple sign-in: the profile records Apple's private relay address", async () => {
    freshPhone();
    const relay = `relay${run}@privaterelay.appleid.com`;
    const { user } = await signInWithAppleIdentityToken(
      fakeIdToken({ sub: `apple-${run}`, email: relay, email_verified: true }),
      'raw-nonce'
    );
    await ensureOwnProfileExists(user);

    const profile = await storedProfile(user.uid);
    expect(profile?.email).toBe(relay);
  });

  it('Apple sign-in with the address withheld: the profile is still created, with no address', async () => {
    freshPhone();
    const { user } = await signInWithAppleIdentityToken(
      fakeIdToken({ sub: `apple-hidden-${run}` }),
      'raw-nonce'
    );
    expect(user.email).toBeNull();
    await ensureOwnProfileExists(user);

    const profile = await storedProfile(user.uid);
    expect(profile).toBeDefined();
    expect(profile?.email).toBeNull();
  });

  it('a sign-up name longer than the rules allow still gets a profile, with the name cut to fit', async () => {
    freshPhone();
    const { user } = await createAccountWithEmail(
      `long.name.${run}@example.org`,
      PASSWORD,
      'x'.repeat(300)
    );
    await ensureOwnProfileExists(user);

    const profile = await storedProfile(user.uid);
    expect(profile).toBeDefined();
    // Whatever Firebase Auth kept of the name, the profile holds at most 200.
    expect(String(profile?.displayName ?? '').length).toBeLessThanOrEqual(200);
    if (user.displayName) expect(profile?.displayName).toBe('x'.repeat(200));
  });

  it("a signed-in member cannot create their profile with somebody else's address", async () => {
    const { sdk, db } = freshPhone();
    const { user } = await createAccountWithEmail(
      `impostor.${run}@example.org`,
      PASSWORD
    );

    // The impostor skips the app and writes the document themselves.
    await expect(
      sdk.firestore.setDoc(sdk.firestore.doc(db, 'users', user.uid), {
        role: 'member',
        displayName: 'Pastor',
        email: 'pastor@church.org',
        phoneNumber: null,
        createdAt: sdk.firestore.serverTimestamp(),
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await storedProfile(user.uid)).toBeUndefined();

    // The app's own creation, for the same account, is accepted -- with the
    // account's real address.
    await ensureOwnProfileExists(user);
    expect((await storedProfile(user.uid))?.email).toBe(user.email);
  });
});
