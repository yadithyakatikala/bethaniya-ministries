/**
 * Firebase Authentication actions for the mobile app.
 *
 * These are plain functions (not hooks) so they're trivially unit-testable
 * by mocking 'firebase/auth' -- the actual OAuth/UI flows that produce their
 * inputs (a Google id_token, an Apple identity token + nonce) live in the
 * screens/hooks that call these, per provider (see SignInScreen.tsx and
 * useGoogleSignIn.ts).
 *
 * Every function here ends in a real firebase/auth call. None of this
 * fabricates a signed-in user. Profile documents are created client-side by
 * ./userProfile.ts's ensureOwnProfileExists() rather than by the
 * createUserProfile Cloud Function, which cannot be deployed on the Spark
 * plan -- see that module and PRODUCTION_READINESS.md.
 *
 * V1 SIGN-IN METHODS: Email/Password and Google. Both work on the free
 * Spark plan with no Cloud Functions involvement.
 *
 * PHONE OTP IS NOT PART OF V1 AND HAS BEEN REMOVED. Its implementation
 * (a WebView-hosted reCAPTCHA verifier, an emulator stub, the SDK verifier
 * contract type, and their tests) was deleted during the V1
 * production-readiness work rather than left as unreachable dead code, so
 * this module now has exactly two real sign-in paths. If phone sign-in is
 * ever revived, note the trap that cost the most time here:
 * signInWithPhoneNumber() declares the published `ApplicationVerifier`
 * interface but its implementation also calls an `@internal _reset()`
 * from a `finally` block, so a verifier satisfying only the published
 * interface turns every outcome -- success included -- into an
 * unattributable TypeError. See this file's history.
 */
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './app';

/** Signs in an existing member with email + password. */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Creates a new member account.
 *
 * Unlike the admin dashboard -- where accounts are issued by a Super Admin
 * and there is no self-signup (see admin/src/services/firebase/authService.ts)
 * -- members register themselves, so the mobile app needs a real account
 * creation path.
 *
 * Three steps, in this order and deliberately not parallel:
 *   1. createUserWithEmailAndPassword -- this also signs the user in, which
 *      is what makes steps 2 and 3 (and ensureOwnProfileExists, triggered by
 *      AuthContext's onAuthStateChanged) permitted at all.
 *   2. updateProfile, when a display name was given, so the rest of the app
 *      has something to show besides an email address.
 *   3. sendEmailVerification -- free on Spark (Firebase sends it, no Cloud
 *      Function). Verification is NOT enforced as a gate on signing in: this
 *      is a church community app, blocking access on an unread email would
 *      lock out members with no practical benefit, and Firestore rules
 *      already scope every write to the owning user. The verified state is
 *      surfaced in the UI (see ProfileScreen) rather than used as a wall.
 *
 * Steps 2 and 3 are best-effort: the account already exists and the user is
 * already signed in by then, so a failure there must not present itself as
 * "sign-up failed". Both are logged instead of thrown.
 */
export async function createAccountWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

  const trimmedName = displayName?.trim();
  if (trimmedName) {
    try {
      await updateProfile(credential.user, { displayName: trimmedName });
    } catch (error) {
      console.warn('[authService] could not set displayName on the new account:', error);
    }
  }

  try {
    await sendEmailVerification(credential.user);
  } catch (error) {
    console.warn('[authService] could not send the verification email:', error);
  }

  return credential;
}

/**
 * Re-sends the address-verification email for an already-signed-in user.
 * Used by ProfileScreen's "Resend verification email" action, since the
 * one sent at sign-up is easy to miss. Free on Spark -- Firebase sends it
 * directly, no Cloud Function. Firebase applies its own rate limiting and
 * reports it as auth/too-many-requests.
 */
export async function resendEmailVerification(user: User): Promise<void> {
  return sendEmailVerification(user);
}

/**
 * Sends a password reset email. Plain client-SDK call, so it works on the
 * Spark plan -- same as the admin dashboard's equivalent.
 *
 * Callers must not reveal whether the address had an account (see
 * SignInScreen's success copy): that would turn this into an account
 * enumeration oracle.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email.trim());
}

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

/** Signs the current user out. */
export async function signOutUser(): Promise<void> {
  return signOut(auth);
}
