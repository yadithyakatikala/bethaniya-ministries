/**
 * Firebase Authentication actions for the admin dashboard.
 *
 * Email/Password is the only sign-in method implemented for admin/host
 * accounts -- per ENVIRONMENT.md, it's the one provider `firebase deploy
 * --only auth` fully covers with no additional Console configuration, and
 * admin/host accounts are created and issued credentials by a Super Admin
 * (there is no public admin self-signup flow), unlike the member mobile app.
 */
import { signInWithEmailAndPassword, signOut, type UserCredential } from 'firebase/auth';
import { auth } from './app';

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(): Promise<void> {
  return signOut(auth);
}
