/**
 * Day 1 smoke test: verifies the module wires up correctly.
 *
 * firebase-admin pulls in an ESM-only dependency (jose, via jwks-rsa) that
 * Jest's CommonJS transform can't load directly, so both firebase-admin/app
 * and firebase-functions/v2/https are mocked here rather than initialized for
 * real. Once real handler logic exists (Day 2+), test that logic directly
 * with these same mocks rather than removing them.
 */
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
}));
jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((handler: unknown) => handler),
}));

import * as functions from '../index';

describe('functions/index', () => {
  it('exports a healthCheck function', () => {
    expect(functions.healthCheck).toBeDefined();
  });

  it('exports the initialized admin app', () => {
    expect(functions.adminApp).toBeDefined();
  });
});
