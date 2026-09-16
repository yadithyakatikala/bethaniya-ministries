/**
 * Firebase Authentication actions for the admin dashboard.
 *
 * Email/Password is the only sign-in method implemented for admin/host
 * accounts -- per ENVIRONMENT.md, it's the one provider `firebase deploy
 * --only auth` fully covers with no additional Console configuration, and
 * admin/host accounts are created and issued credentials by a Super Admin
 * (there is no public admin self-signup flow), unlike the member mobile app.
 */
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './app';

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sends a password reset email via Firebase Auth -- the "Password reset
 * via email" item FINAL_ARCHITECTURE_SPECIFICATION.md's admin auth spec
 * requires (Section B, item 8), added during the V1 production-readiness
 * audit after it was found missing entirely. No Cloud Function/Blaze
 * involvement: this is a plain client-SDK call, so it works on the Spark
 * plan like signInWithEmail above.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

export async function signOutUser(): Promise<void> {
  return signOut(auth);
}
