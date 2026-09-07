/**
 * Manual Jest mock for 'firebase/storage' -- same root-level, auto-applied
 * pattern as ./firestore.js and ./auth.js (see auth.js's header comment
 * for why this pattern exists). Day 9's ProfileScreen is the first mobile
 * module to import 'firebase/storage' directly (to upload a profile
 * photo to the existing users/{userId}/profile/{fileName} Storage path).
 */
export const ref = jest.fn((_storage, path) => ({ path }));
export const uploadBytes = jest.fn();
export const getDownloadURL = jest.fn();
