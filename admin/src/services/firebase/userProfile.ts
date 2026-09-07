/**
 * Reads the caller's own /users/{uid} profile document to determine their
 * role for the admin dashboard's UI-level access boundary (see
 * routes/ProtectedRoute.tsx). This is a UX convenience only -- Firestore
 * security rules (see /firestore.rules, `callerRole()`/`hasRole()`) are the
 * actual, server-enforced authority for every read/write an admin screen
 * will make; this client-side check exists purely so a signed-in Member
 * sees a clear "you don't have access" message instead of a dashboard shell
 * full of permission-denied errors. See SECURITY.md.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from './app';
import type { UserRole } from '../../types';

export async function fetchOwnRole(uid: string): Promise<UserRole | null> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  const role = snapshot.data().role;
  return typeof role === 'string' ? (role as UserRole) : null;
}
