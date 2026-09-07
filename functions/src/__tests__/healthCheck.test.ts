/**
 * Day 1 smoke test: verifies the module wires up correctly.
 *
 * firebase-admin pulls in an ESM-only dependency (jose, via jwks-rsa) that
 * Jest's CommonJS transform can't load directly, so firebase-admin/app,
 * firebase-functions/v2/https, and firebase-functions/v1 are all mocked
 * here rather than initialized for real (v1's auth-trigger providers pull
 * in the same firebase-admin/auth -> jwks-rsa -> jose chain as v2's https
 * providers do). createUserProfile's actual logic is NOT mocked away like
 * this -- see createUserProfile.test.ts, which imports the handler
 * directly (it has no firebase-functions/v1 or /v2 import at all) and runs
 * it against a real Firestore emulator.
 */
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
}));
jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((handler: unknown) => handler),
}));
jest.mock('firebase-functions/v1', () => ({
  auth: {
    user: jest.fn(() => ({
      onCreate: jest.fn((handler: unknown) => handler),
    })),
  },
}));

import * as functions from '../index';

describe('functions/index', () => {
  it('exports a healthCheck function', () => {
    expect(functions.healthCheck).toBeDefined();
  });

  it('exports the initialized admin app', () => {
    expect(functions.adminApp).toBeDefined();
  });

  it('exports the createUserProfile trigger', () => {
    expect(functions.createUserProfile).toBeDefined();
  });
});
