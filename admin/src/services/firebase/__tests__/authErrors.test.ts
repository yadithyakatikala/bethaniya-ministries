import { describe, expect, it } from 'vitest';
import { toFriendlyAuthMessage, UNAUTHORIZED_ADMIN_MESSAGE } from '../authErrors';

describe('toFriendlyAuthMessage', () => {
  it('maps known Firebase Auth error codes to friendly messages', () => {
    expect(toFriendlyAuthMessage({ code: 'auth/invalid-credential' })).toBe(
      'No account found with that email and password.'
    );
    expect(toFriendlyAuthMessage({ code: 'auth/user-disabled' })).toBe(
      'This account has been disabled. Please contact a Super Admin.'
    );
  });

  it('never exposes the raw error code for an unmapped error', () => {
    const friendly = toFriendlyAuthMessage({ code: 'auth/some-internal-detail' });
    expect(friendly).not.toContain('auth/some-internal-detail');
  });

  it('falls back to the generic message for a non-Firebase error', () => {
    expect(toFriendlyAuthMessage(new Error('boom'))).toBe(
      'Something went wrong while signing in. Please try again.'
    );
  });

  it('exports a distinct unauthorized-admin message', () => {
    expect(UNAUTHORIZED_ADMIN_MESSAGE).toMatch(/doesn.t have access/);
  });
});
