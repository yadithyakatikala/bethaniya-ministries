/**
 * Maps Firebase Auth errors to short, user-friendly messages -- never the
 * raw internal error message/code, per the Day 2 directive's Phase 9
 * ("Do not expose raw internal errors unnecessarily"). Mirrors
 * mobile/src/services/firebase/authErrors.ts's approach, scoped to what the
 * admin dashboard's email/password login can actually produce.
 */

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/user-not-found': 'No account found with that email and password.',
  'auth/wrong-password': 'No account found with that email and password.',
  'auth/invalid-credential': 'No account found with that email and password.',
  'auth/user-disabled': 'This account has been disabled. Please contact a Super Admin.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'No network connection. Please check your internet connection and try again.',
  'auth/internal-error': 'Something went wrong. Please try again.',
};

const DEFAULT_MESSAGE = 'Something went wrong while signing in. Please try again.';

export const UNAUTHORIZED_ADMIN_MESSAGE =
  'Your account doesn’t have access to the admin dashboard. Contact a Super Admin if you believe this is a mistake.';

interface MaybeCodedError {
  code?: unknown;
}

export function toFriendlyAuthMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as MaybeCodedError;
    if (typeof err.code === 'string') {
      const mapped = FIREBASE_ERROR_MESSAGES[err.code];
      if (mapped) return mapped;
    }
  }
  return DEFAULT_MESSAGE;
}
