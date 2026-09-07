/**
 * Manual Jest mock for 'firebase/auth'.
 *
 * Why this exists: firebase/auth's package.json "exports" map has no
 * "react-native" condition of its own (only the nested @firebase/auth
 * package does) and its "default"/non-"node" entry point is a real ES
 * Module (dist/esm/index.esm.js). Depending on which export condition
 * jest-expo's resolver activates, requiring 'firebase/auth' directly in
 * Jest can resolve to that ESM file, which plain Jest's CommonJS transform
 * cannot parse ("Unexpected token 'export'") -- the same class of problem
 * documented in functions/src/createUserProfile.ts for the Cloud Functions
 * side of this codebase. Node-module manual mocks under __mocks__/ are
 * picked up automatically for every test (no jest.mock() call needed), so
 * this keeps every mobile auth test working against a predictable,
 * synchronous fake instead of fighting SDK module resolution.
 */
export const onAuthStateChanged = jest.fn(() => jest.fn());
export const initializeAuth = jest.fn(() => ({}));
export const getAuth = jest.fn(() => ({}));
export const getReactNativePersistence = jest.fn(() => ({}));
export const connectAuthEmulator = jest.fn();
export const GoogleAuthProvider = { credential: jest.fn((idToken) => ({ idToken })) };
export const OAuthProvider = jest.fn().mockImplementation((providerId) => ({
  providerId,
  credential: jest.fn((opts) => ({ ...opts, providerId })),
}));
export const signInWithCredential = jest.fn();
export const signInWithPhoneNumber = jest.fn();
export const signOut = jest.fn();
