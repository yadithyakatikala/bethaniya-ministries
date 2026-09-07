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
export const onSnapshot = jest.fn(() => jest.fn());
