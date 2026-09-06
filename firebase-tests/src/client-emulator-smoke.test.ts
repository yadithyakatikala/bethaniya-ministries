/**
 * Client-SDK connectivity smoke test for the local Firebase Emulator Suite.
 *
 * Unlike firestore.rules.test.ts / storage.rules.test.ts (which use
 * @firebase/rules-unit-testing to exercise the rules engine directly),
 * this test uses the plain `firebase` client SDK -- the exact same
 * initializeApp/connectAuthEmulator/connectFirestoreEmulator/
 * connectStorageEmulator calls that mobile/src/services/firebase/app.ts and
 * admin/src/services/firebase/app.ts make at runtime -- to prove the actual
 * app-facing local development workflow is runnable end to end: sign in via
 * the Auth emulator, then use that real session to read/write through the
 * Firestore and Storage emulators under the real, committed
 * firestore.rules / storage.rules (not a throwaway permissive ruleset).
 *
 * This intentionally does not re-test the RBAC matrix (firestore.rules.test.ts
 * and storage.rules.test.ts already cover that exhaustively) -- it only
 * proves the wiring: an Auth-emulator-issued token is honored by the
 * Firestore/Storage emulators, using operations real anonymous/member users
 * are actually allowed to do (create their own /users/{uid} profile doc,
 * upload their own profile photo).
 */
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';

// singleProjectMode (firebase.json) means the running emulator suite treats
// every request as belonging to the one active project regardless of the
// project id an SDK client requests -- but we use the repo's real project id
// here anyway so this test reads the same as production usage would.
const FIREBASE_CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'bethaniya-ministries-dev-58588',
  storageBucket: 'bethaniya-ministries-dev-58588.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

const app = initializeApp(FIREBASE_CONFIG, 'client-emulator-smoke-test');

let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

beforeAll(() => {
  auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
});

afterAll(async () => {
  await terminate(db);
  await deleteApp(app);
});

test('signs in anonymously via the Auth emulator', async () => {
  const credential = await signInAnonymously(auth);
  expect(credential.user.uid).toBeTruthy();
  expect(auth.currentUser?.uid).toBe(credential.user.uid);
});

test('creates and reads the signed-in user’s own /users/{uid} profile via the Firestore emulator', async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('expected an anonymous session from the previous test');

  const userDocRef = doc(db, 'users', uid);
  // Allowed by firestore.rules: `allow create: if isOwner(userId) &&
  // request.resource.data.role == 'member'`.
  await setDoc(userDocRef, { role: 'member', createdAt: Date.now() });

  const snapshot = await getDoc(userDocRef);
  expect(snapshot.exists()).toBe(true);
  expect(snapshot.data()?.role).toBe('member');
});

test('uploads and downloads the signed-in user’s own profile photo via the Storage emulator', async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('expected an anonymous session from the previous test');

  // Allowed by storage.rules: `match /users/{userId}/profile/{fileName) {
  // allow write: if isSignedIn() && request.auth.uid == userId && ... }` --
  // a 1x1 transparent PNG, well under the 5MB cap, with an image/* content type.
  const onePixelPng = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
    0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
    0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const photoRef = ref(storage, `users/${uid}/profile/avatar.png`);

  await uploadBytes(photoRef, onePixelPng, { contentType: 'image/png' });
  const downloaded = await getBytes(photoRef);

  expect(new Uint8Array(downloaded)).toEqual(onePixelPng);
});
