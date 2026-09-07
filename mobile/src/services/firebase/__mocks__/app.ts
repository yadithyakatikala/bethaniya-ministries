/**
 * Manual Jest mock for ./app.ts (this module's own Firebase SDK
 * initialization). Explicitly opt in per test file with
 * `jest.mock('.../services/firebase/app')` -- unlike the node_modules
 * manual mocks under mobile/__mocks__/, mocks for project files are never
 * applied automatically.
 *
 * Mocking at this boundary (rather than every individual 'firebase/app',
 * 'firebase/firestore', 'firebase/storage' import) means tests never load
 * those SDK entry points at all, sidestepping the same
 * exports-condition/ESM-under-Jest issue documented in
 * mobile/__mocks__/firebase/auth.js -- app.ts is the only file in this repo
 * that imports them directly.
 */
export const usingFirebaseEmulators = true;
export const isEmulatorEnabled = jest.fn(() => true);
export const auth = {} as unknown;
export const db = {} as unknown;
export const storage = {} as unknown;
