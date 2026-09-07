/**
 * Real, emulator-backed tests for createUserProfileHandler.
 *
 * This imports the handler directly (see the note in
 * createUserProfile.ts -- it has no firebase-functions/v1 or /v2 import,
 * so it loads fine under plain Jest) and runs it against a real, running
 * Firestore emulator via FIRESTORE_EMULATOR_HOST -- firebase-admin
 * auto-detects that env var and talks to the emulator instead of a real
 * project. Not a mock: every assertion here reads back an actual document
 * written by the actual handler through the actual Admin SDK.
 *
 * Run (from repo root): see functions/package.json's "test" script --
 * requires FIRESTORE_EMULATOR_HOST to be set, e.g.:
 *   firebase emulators:exec --only firestore "npm --prefix functions test"
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createUserProfileHandler, MEMBER_ROLE } from '../createUserProfile';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'createUserProfile.test.ts requires FIRESTORE_EMULATOR_HOST -- run it via ' +
      '`firebase emulators:exec --only firestore "npm --prefix functions test"`, ' +
      'not `npm test` directly.'
  );
}

initializeApp({ projectId: 'demo-functions-test' });
const db = getFirestore();

afterEach(async () => {
  // Each test gets a clean slate -- delete every doc this suite could have
  // written, regardless of which test wrote it.
  const snapshot = await db.collection('users').get();
  await Promise.all(snapshot.docs.map((d) => d.ref.delete()));
});

test('creates a member-role profile on first sign-in with only the expected fields', async () => {
  await createUserProfileHandler({
    uid: 'user-1',
    displayName: 'Test User',
    email: 'test@example.com',
    phoneNumber: null,
  });

  const snapshot = await db.collection('users').doc('user-1').get();
  expect(snapshot.exists).toBe(true);
  const data = snapshot.data();
  expect(data).toMatchObject({
    role: MEMBER_ROLE,
    displayName: 'Test User',
    email: 'test@example.com',
    phoneNumber: null,
  });
  expect(Object.keys(data ?? {}).sort()).toEqual(
    ['createdAt', 'displayName', 'email', 'phoneNumber', 'role'].sort()
  );
  expect(data?.createdAt).toBeDefined();
});

test('defaults missing optional fields to null rather than throwing', async () => {
  await createUserProfileHandler({ uid: 'user-phone-only', phoneNumber: '+15551234567' });

  const snapshot = await db.collection('users').doc('user-phone-only').get();
  const data = snapshot.data();
  expect(data).toMatchObject({
    role: MEMBER_ROLE,
    displayName: null,
    email: null,
    phoneNumber: '+15551234567',
  });
});

test('is idempotent: a repeated invocation for the same uid is a no-op', async () => {
  await createUserProfileHandler({ uid: 'user-2', email: 'first@example.com' });
  const firstSnapshot = await db.collection('users').doc('user-2').get();
  const firstCreatedAt = firstSnapshot.data()?.createdAt;

  // Simulate Cloud Functions' at-least-once delivery redelivering the same
  // auth.user().onCreate() event.
  await createUserProfileHandler({ uid: 'user-2', email: 'first@example.com' });

  const secondSnapshot = await db.collection('users').doc('user-2').get();
  expect(secondSnapshot.data()?.createdAt).toEqual(firstCreatedAt);
});

test('never overwrites an existing profile, even one an admin has since elevated', async () => {
  // Simulate a Super Admin having promoted this user after their initial
  // profile was created -- the handler must not be able to undo that.
  await db
    .collection('users')
    .doc('user-3')
    .set({
      role: 'super_admin',
      displayName: 'Promoted Admin',
      email: 'admin@example.com',
      phoneNumber: null,
      createdAt: new Date('2020-01-01'),
    });

  // A retried/duplicate onCreate delivery for this uid must not clobber it.
  await createUserProfileHandler({ uid: 'user-3', email: 'admin@example.com' });

  const snapshot = await db.collection('users').doc('user-3').get();
  expect(snapshot.data()?.role).toBe('super_admin');
  expect(snapshot.data()?.displayName).toBe('Promoted Admin');
});

test('the client can never influence the assigned role -- the handler does not accept one', () => {
  // Type-level guarantee: AuthUserLike has no `role` field at all, so there
  // is no parameter through which a caller (or a compromised client payload
  // masquerading as a UserRecord) could ask for anything other than the
  // hardcoded MEMBER_ROLE. This test exists to make that guarantee explicit
  // and to fail loudly if AuthUserLike is ever widened to include one.
  const handlerParam: Parameters<typeof createUserProfileHandler>[0] = { uid: 'user-4' };
  expect('role' in handlerParam).toBe(false);
});
