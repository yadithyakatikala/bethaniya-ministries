import {
  CANCELLED_SIGN_IN_MESSAGE,
  isUserCancellation,
  toFriendlyAuthMessage,
} from '../authErrors';

describe('toFriendlyAuthMessage', () => {
  it('maps known Firebase Auth error codes to friendly messages', () => {
    expect(toFriendlyAuthMessage({ code: 'auth/invalid-verification-code' })).toBe(
      'That code doesn’t look right. Please check it and try again.'
    );
    expect(toFriendlyAuthMessage({ code: 'auth/code-expired' })).toBe(
      'This code has expired. Please request a new one.'
    );
    expect(toFriendlyAuthMessage({ code: 'auth/network-request-failed' })).toBe(
      'No network connection. Please check your internet connection and try again.'
    );
  });

  it('never exposes the raw error code or message for unknown errors', () => {
    const raw = {
      code: 'auth/some-internal-code-nobody-mapped',
      message: 'raw internal detail',
    };
    const friendly = toFriendlyAuthMessage(raw);
    expect(friendly).not.toContain('auth/some-internal-code-nobody-mapped');
    expect(friendly).not.toContain('raw internal detail');
  });

  it('falls back to the generic message for a plain Error or non-error value', () => {
    expect(toFriendlyAuthMessage(new Error('boom'))).toBe(
      'Something went wrong while signing in. Please try again.'
    );
    expect(toFriendlyAuthMessage('not an error object')).toBe(
      'Something went wrong while signing in. Please try again.'
    );
    expect(toFriendlyAuthMessage(undefined)).toBe(
      'Something went wrong while signing in. Please try again.'
    );
  });

  it('recognizes cancelled Google/Apple sign-in as a cancellation, not a failure', () => {
    expect(toFriendlyAuthMessage({ type: 'cancel' })).toBe(CANCELLED_SIGN_IN_MESSAGE);
    expect(toFriendlyAuthMessage({ type: 'dismiss' })).toBe(CANCELLED_SIGN_IN_MESSAGE);
    expect(toFriendlyAuthMessage({ code: 'ERR_REQUEST_CANCELED' })).toBe(
      CANCELLED_SIGN_IN_MESSAGE
    );
    expect(toFriendlyAuthMessage({ code: 'auth/popup-closed-by-user' })).toBe(
      CANCELLED_SIGN_IN_MESSAGE
    );
  });
});

describe('isUserCancellation', () => {
  it('is false for a real auth failure', () => {
    expect(isUserCancellation({ code: 'auth/invalid-verification-code' })).toBe(false);
    expect(isUserCancellation(new Error('network down'))).toBe(false);
    expect(isUserCancellation(null)).toBe(false);
  });
});
