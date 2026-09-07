/**
 * Maps Firebase Auth (and Google/Apple sign-in) errors to short,
 * user-friendly messages -- never the raw internal error message or code,
 * per the Day 2 directive's Phase 9 ("Do not expose raw internal errors
 * unnecessarily").
 *
 * Firebase Auth errors carry a `.code` like "auth/invalid-verification-code";
 * expo-auth-session and expo-apple-authentication report cancellation
 * differently (see toFriendlyAuthMessage's non-Firebase branches below).
 */

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-verification-code':
    'That code doesn’t look right. Please check it and try again.',
  'auth/code-expired': 'This code has expired. Please request a new one.',
  'auth/invalid-phone-number':
    'That doesn’t look like a valid phone number. Please check it and try again.',
  'auth/missing-phone-number': 'Please enter a phone number to continue.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'No network connection. Please check your internet connection and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/invalid-credential':
    'We couldn’t sign you in with that credential. Please try again.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/operation-not-allowed':
    'This sign-in method isn’t enabled yet. Please try a different option.',
  'auth/internal-error': 'Something went wrong. Please try again.',
};

const DEFAULT_MESSAGE = 'Something went wrong while signing in. Please try again.';

export const CANCELLED_SIGN_IN_MESSAGE = 'Sign-in was cancelled.';

/** Narrow shape covering both Firebase's FirebaseError and generic JS errors. */
interface MaybeCodedError {
  code?: unknown;
  message?: unknown;
}

/**
 * True for the specific "the user closed the Google/Apple sign-in sheet"
 * outcomes that expo-auth-session and expo-apple-authentication report --
 * these are normal, expected user actions, not failures.
 */
export function isUserCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as MaybeCodedError;

  // expo-auth-session: AuthSession.startAsync/promptAsync resolves (not
  // rejects) with { type: 'cancel' | 'dismiss' } -- callers pass that result
  // shape in here rather than an Error, so check for it explicitly too.
  if ('type' in err && (err as { type?: unknown }).type === 'cancel') return true;
  if ('type' in err && (err as { type?: unknown }).type === 'dismiss') return true;

  // expo-apple-authentication: rejects with a NativeModule error whose code
  // is 'ERR_REQUEST_CANCELED' when the user cancels the Apple sheet.
  if (err.code === 'ERR_REQUEST_CANCELED') return true;

  if (typeof err.code === 'string') {
    return (
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    );
  }
  return false;
}

/** Converts any sign-in error into a short, user-safe message. */
export function toFriendlyAuthMessage(error: unknown): string {
  if (isUserCancellation(error)) return CANCELLED_SIGN_IN_MESSAGE;

  if (error && typeof error === 'object') {
    const err = error as MaybeCodedError;
    if (typeof err.code === 'string' && FIREBASE_ERROR_MESSAGES[err.code]) {
      return FIREBASE_ERROR_MESSAGES[err.code];
    }
  }
  return DEFAULT_MESSAGE;
}
