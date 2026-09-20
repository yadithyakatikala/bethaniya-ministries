/**
 * Manual Jest mock for 'firebase/firestore' -- see
 * mobile/__mocks__/firebase/auth.js's header comment for why this pattern
 * (a root-level manual mock, applied automatically to every test with no
 * jest.mock() call needed) exists: firebase/firestore carries the same
 * package.json "exports"-map/ESM resolution risk under Jest that
 * firebase/auth does. mobile/src/services/firebase/announcements.ts
 * (Day 4) is the first mobile module to import 'firebase/firestore'
 * directly -- every prior module only reached it indirectly via ./app.ts,
 * which every test already mocks away wholesale (jest.mock('../app')).
 */
class MockTimestamp {
  constructor(seconds) {
    this.seconds = seconds;
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  static now() {
    return new MockTimestamp(Math.floor(Date.now() / 1000));
  }
  static fromDate(date) {
    return new MockTimestamp(Math.floor(date.getTime() / 1000));
  }
}

export const Timestamp = MockTimestamp;

// Module-initialization functions, needed so src/services/firebase/app.ts
// can itself be imported under Jest (see __tests__/app.test.ts and
// ./app.js's header comment) -- every other test mocks app.ts wholesale
// via jest.mock('../app') and so never reached these.
export const getFirestore = jest.fn(() => ({}));
export const connectFirestoreEmulator = jest.fn();

export const collection = jest.fn();
export const query = jest.fn((...args) => args[0]);
export const where = jest.fn();
export const orderBy = jest.fn();
export const limit = jest.fn();
// M6: the media feed is the first paginated query in this app -- every
// earlier collection read fetches one page and stops. See
// src/services/firebase/media.ts.
export const startAfter = jest.fn();
export const onSnapshot = jest.fn(() => jest.fn());

// Day 9: mobile/src/services/firebase/userProfile.ts is the first mobile
// module to read/write a single document (rather than a collection
// query) and the first to write at all -- doc()/updateDoc() added here
// for it, same jest.fn() shape as every export above.
export const doc = jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') }));
export const getDoc = jest.fn();

// M5: mobile/src/services/firebase/votd.ts is the first mobile module to
// read a whole collection ONCE rather than subscribe to it -- the verse
// pool is fetched at most once a day per device (see that file's
// read-cost note), so it uses getDocs() where every earlier collection
// read used onSnapshot().
export const getDocs = jest.fn();
export const setDoc = jest.fn();
export const updateDoc = jest.fn();
export const serverTimestamp = jest.fn(() => new MockTimestamp(0));

// New V1 features (Prayers/Plans -- see services/firebase/prayers.ts,
// services/firebase/plans.ts): the first mobile modules that create or
// delete documents client-side (every prior write-capable module only
// ever updated an existing one).
export const addDoc = jest.fn();
export const deleteDoc = jest.fn();

// M7: the shared prayer wall writes THREE documents atomically -- the
// request, its private author record, and the member's own index entry
// -- because a request whose author record failed to write is one nobody
// could ever edit or delete. See src/services/firebase/prayerRequests.ts.
//
// The default hands back a fresh recorder per call, so a test can read
// what was staged and in what order. Tests override it the same way they
// override runTransaction below.
export const writeBatch = jest.fn(() => ({
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn(async () => undefined),
}));

// userProfile.ts's ensureOwnProfileExists(): the first mobile module to use
// a transaction (get-then-set, matching functions/src/createUserProfile.ts's
// own idempotency strategy). Default resolves the updateFunction against a
// fake transaction whose get() reports "doesn't exist" -- tests override via
// (runTransaction as jest.Mock).mockImplementation(...), same pattern as
// onSnapshot above, to simulate the "already exists" branch.
export const runTransaction = jest.fn((_db, updateFunction) =>
  updateFunction({
    get: jest.fn(async () => ({ exists: () => false })),
    set: jest.fn(),
  })
);
