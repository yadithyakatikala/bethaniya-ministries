/**
 * Firebase Authentication actions for the mobile app.
 *
 * These are plain functions (not hooks) so they're trivially unit-testable
 * by mocking 'firebase/auth' -- the actual OAuth/UI flows that produce their
 * inputs (a Google id_token, an Apple identity token + nonce, a phone
 * ApplicationVerifier) live in the screens/hooks that call these, per
 * provider (see SignInScreen.tsx and useGoogleAuthRequest usage there).
 *
 * Every function here ends in a real firebase/auth call -- signInWithCredential,
 * signInWithPhoneNumber, or signOut -- against whatever `auth` is currently
 * wired to (the local Emulator Suite in development; see ./app.ts). None of
 * this fabricates a signed-in user: see createUserProfile.ts (Cloud Functions)
 * for what actually happens server-side on first sign-in.
 */
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './app';
import { getPhoneApplicationVerifier } from './emulatorRecaptchaVerifier';

/** Exchanges a Google id_token (from expo-auth-session) for a Firebase session. */
export async function signInWithGoogleIdToken(idToken: string): Promise<UserCredential> {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

/** Exchanges an Apple identity token + raw nonce (from expo-apple-authentication) for a Firebase session. */
export async function signInWithAppleIdentityToken(
  identityToken: string,
  rawNonce: string
): Promise<UserCredential> {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken, rawNonce });
  return signInWithCredential(auth, credential);
}

/**
 * Starts phone number sign-in by requesting an SMS (or, on the Auth Emulator,
 * an instant test code -- see emulatorRecaptchaVerifier.ts) be sent to
 * `phoneNumber` (E.164 format, e.g. "+15555550123"). Resolve the returned
 * ConfirmationResult with confirmPhoneCode() once the user enters the code.
 */
export async function startPhoneSignIn(phoneNumber: string): Promise<ConfirmationResult> {
  const verifier = getPhoneApplicationVerifier();
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

/** Completes phone sign-in with the code the user received. */
export async function confirmPhoneCode(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<UserCredential> {
  return confirmationResult.confirm(code);
}

/** Signs the current user out. */
export async function signOutUser(): Promise<void> {
  return signOut(auth);
}
