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
export const collection = jest.fn();
export const query = jest.fn((...args) => args[0]);
export const where = jest.fn();
export const orderBy = jest.fn();
export const limit = jest.fn();
export const onSnapshot = jest.fn(() => jest.fn());

// Day 9: mobile/src/services/firebase/userProfile.ts is the first mobile
// module to read/write a single document (rather than a collection
// query) and the first to write at all -- doc()/updateDoc() added here
// for it, same jest.fn() shape as every export above.
export const doc = jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') }));
export const getDoc = jest.fn();
export const setDoc = jest.fn();
export const updateDoc = jest.fn();
export const serverTimestamp = jest.fn(() => new MockTimestamp(0));

// New V1 features (Prayers/Plans -- see services/firebase/prayers.ts,
// services/firebase/plans.ts): the first mobile modules that create or
// delete documents client-side (every prior write-capable module only
// ever updated an existing one).
export const addDoc = jest.fn();
export const deleteDoc = jest.fn();
