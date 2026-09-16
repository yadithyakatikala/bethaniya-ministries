/**
 * Maps Firebase Auth (and Google/Apple sign-in) errors to short,
 * user-friendly messages -- never the raw internal error message or code,
 * per the Day 2 directive's Phase 9 ("Do not expose raw internal errors
 * unnecessarily").
 *
 * Firebase Auth errors carry a `.code` like "auth/invalid-verification-code";
 * expo-auth-session and expo-apple-authentication report cancellation
 * differently (see toFriendlyAuthMessage's non-Firebase branches below).
 *
 * logAuthError() (added during the V1 production-readiness audit): the UI
 * message above is deliberately generic for every error not in the small
 * table below -- which, discovered while debugging the phone-auth reCAPTCHA
 * flow, meant every caller of toFriendlyAuthMessage() had no way to tell
 * *which* underlying failure actually happened without adding one-off
 * temporary console.log calls each time. This makes that permanent and
 * general: every sign-in failure now logs its real `.code`/`.message` via
 * console.warn (visible in `adb logcat`/Xcode console for BOTH debug and
 * release builds -- unlike gating on `__DEV__`, which is false in a release
 * build, exactly where on-device diagnosis is hardest and was needed most
 * during that investigation). This is safe to always log: Firebase error
 * codes/messages describe *what went wrong* (e.g. "auth/invalid-phone-
 * number"), never credentials, tokens, or personal data.
 */

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  // --- Email/Password (the primary V1 sign-in method) -------------------
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/missing-password': 'Please enter your password to continue.',
  'auth/email-already-in-use':
    'An account already exists with this email. Try signing in instead.',
  'auth/weak-password': 'Please choose a longer password (at least 6 characters).',
  // Firebase deliberately collapses "no such user" and "wrong password" into
  // auth/invalid-credential when email enumeration protection is enabled
  // (the default for new projects). The older, more specific codes are still
  // mapped below for projects with it disabled -- all three get the same
  // wording on purpose, so the app never reveals whether an address is
  // registered.
  'auth/invalid-login-credentials': 'That email or password isn’t right. Please try again.',
  'auth/user-not-found': 'That email or password isn’t right. Please try again.',
  'auth/wrong-password': 'That email or password isn’t right. Please try again.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  // --- Shared ------------------------------------------------------------
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'No network connection. Please check your internet connection and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  // Firebase returns this for a wrong email/password when email enumeration
  // protection is enabled (the default on new projects), which makes it the
  // dominant bad-credentials code for V1's primary sign-in method -- hence
  // the email wording rather than the OAuth-flavoured text it used to have.
  // It can also mean a malformed Google/Apple credential, which is rare and
  // still reads acceptably here.
  'auth/invalid-credential': 'That email or password isn’t right. Please try again.',
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

/**
 * Logs the real error behind a sign-in failure -- see this file's header
 * comment for why every caller of toFriendlyAuthMessage() should also call
 * this. `context` is a short label (e.g. "phone", "google", "apple",
 * "auth-subsystem") identifying which flow failed, since the UI message
 * alone often can't (many different failures collapse to the same generic
 * text). No-ops (does not log "user cancelled") for isUserCancellation()
 * cases -- those aren't failures worth diagnosing.
 */
export function logAuthError(context: string, error: unknown): void {
  if (isUserCancellation(error)) return;
  if (error && typeof error === 'object') {
    const err = error as MaybeCodedError;
    console.warn(`[auth:${context}]`, {
      code: typeof err.code === 'string' ? err.code : undefined,
      message: typeof err.message === 'string' ? err.message : undefined,
    });
    return;
  }
  console.warn(`[auth:${context}]`, { value: String(error) });
}
