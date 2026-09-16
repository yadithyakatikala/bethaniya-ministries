/**
 * Manual Jest mock for 'firebase/storage' -- same root-level, auto-applied
 * pattern as ./firestore.js and ./auth.js (see auth.js's header comment
 * for why this pattern exists). Day 9's ProfileScreen is the first mobile
 * module to import 'firebase/storage' directly (to upload a profile
 * photo to the existing users/{userId}/profile/{fileName} Storage path).
 */
// Module-initialization functions, needed so src/services/firebase/app.ts
// can itself be imported under Jest -- see ./app.js's header comment.
export const getStorage = jest.fn(() => ({}));
export const connectStorageEmulator = jest.fn();

export const ref = jest.fn((_storage, path) => ({ path }));
export const uploadBytes = jest.fn();
export const getDownloadURL = jest.fn();
