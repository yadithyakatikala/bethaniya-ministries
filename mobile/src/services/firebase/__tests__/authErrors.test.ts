import {
  CANCELLED_SIGN_IN_MESSAGE,
  isUserCancellation,
  logAuthError,
  toFriendlyAuthMessage,
} from '../authErrors';

describe('toFriendlyAuthMessage', () => {
  it('maps known Firebase Auth error codes to friendly messages', () => {
    expect(toFriendlyAuthMessage({ code: 'auth/invalid-email' })).toBe(
      'That doesn’t look like a valid email address.'
    );
    expect(toFriendlyAuthMessage({ code: 'auth/email-already-in-use' })).toBe(
      'An account already exists with this email. Try signing in instead.'
    );
    expect(toFriendlyAuthMessage({ code: 'auth/weak-password' })).toBe(
      'Please choose a longer password (at least 6 characters).'
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
    expect(isUserCancellation({ code: 'auth/invalid-credential' })).toBe(false);
    expect(isUserCancellation(new Error('network down'))).toBe(false);
    expect(isUserCancellation(null)).toBe(false);
  });
});

describe('logAuthError', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs the real code/message, tagged with the given context -- the diagnostic info toFriendlyAuthMessage deliberately hides from the user', () => {
    logAuthError('sign-in', { code: 'auth/invalid-credential', message: 'raw detail' });

    expect(warnSpy).toHaveBeenCalledWith(
      '[auth:sign-in]',
      expect.objectContaining({
        code: 'auth/invalid-credential',
        message: 'raw detail',
      })
    );
  });

  it('logs a plain Error via its message', () => {
    logAuthError('google', new Error('network down'));

    expect(warnSpy).toHaveBeenCalledWith(
      '[auth:google]',
      expect.objectContaining({ message: 'network down' })
    );
  });

  it('does not log a user cancellation -- that is not a failure worth diagnosing', () => {
    logAuthError('google', { type: 'cancel' });
    logAuthError('apple', { code: 'ERR_REQUEST_CANCELED' });

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
