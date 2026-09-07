import { create } from 'zustand';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../services/firebase/app';
import { signInWithEmail, signOutUser } from '../services/firebase/authService';
import { toFriendlyAuthMessage } from '../services/firebase/authErrors';
import { fetchOwnRole } from '../services/firebase/userProfile';
import type { UserRole } from '../types';

/**
 * Admin/host authentication state, per FINAL_ARCHITECTURE_SPECIFICATION.md's
 * Day 2 plan. Zustand, not Redux (see appStore.ts's Day 1 note, which this
 * follows the same lightweight-state-management pattern as).
 *
 * `status` mirrors the mobile app's AuthContext state machine:
 *   - 'loading'          Firebase hasn't reported the initial auth state yet.
 *   - 'unauthenticated'  No signed-in user -- ProtectedRoute redirects to /login.
 *   - 'authenticated'    A real, current Firebase user exists. `role` is
 *                        fetched separately and may briefly be `null` right
 *                        after this flips true, while the /users/{uid} read
 *                        is in flight -- see ProtectedRoute.tsx.
 *   - 'error'            The Auth *subsystem* itself failed (onAuthStateChanged's
 *                        own error callback), not an ordinary failed login
 *                        attempt (which surfaces via `authErrorMessage` while
 *                        status stays 'unauthenticated' -- see signIn()).
 *
 * The onAuthStateChanged subscription itself is NOT wired up here at module
 * scope -- see subscribeToAuthChanges() below, called once from App.tsx's
 * top-level effect. Keeping the side effect tied to component lifecycle
 * (rather than firing exactly once, forever, the first time this module
 * happens to be imported) makes it re-runnable, which is what lets tests
 * mount App fresh and control each auth scenario independently.
 */
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

interface AuthStoreState {
  status: AuthStatus;
  user: User | null;
  /** The signed-in user's role, once fetched -- null while loading, when unauthenticated, or when no profile document exists yet. */
  role: UserRole | null;
  /** True once the role fetch for the current session has settled (success or failure) -- distinguishes "still loading" (role === null, roleLoaded === false) from "fetched, and there genuinely is no role" (role === null, roleLoaded === true), so ProtectedRoute never shows an infinite spinner. */
  roleLoaded: boolean;
  /** User-friendly message for the most recent failed login attempt or Auth subsystem error. Never a raw Firebase error. */
  authErrorMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: 'loading',
  user: null,
  role: null,
  roleLoaded: false,
  authErrorMessage: null,
  signIn: async (email: string, password: string) => {
    set({ authErrorMessage: null });
    try {
      await signInWithEmail(email, password);
      // subscribeToAuthChanges's listener below handles the resulting state transition.
    } catch (error) {
      set({ authErrorMessage: toFriendlyAuthMessage(error) });
      throw error;
    }
  },
  signOut: async () => {
    await signOutUser();
  },
  clearAuthError: () => set({ authErrorMessage: null }),
}));

/**
 * Subscribes to Firebase's auth state and keeps the store in sync. Returns
 * the unsubscribe function -- call this once from a top-level effect (see
 * App.tsx) and return it as the effect's cleanup.
 */
export function subscribeToAuthChanges(): () => void {
  return onAuthStateChanged(
    auth,
    (user) => {
      if (!user) {
        useAuthStore.setState({
          status: 'unauthenticated',
          user: null,
          role: null,
          roleLoaded: false,
        });
        return;
      }
      useAuthStore.setState({
        status: 'authenticated',
        user,
        role: null,
        roleLoaded: false,
      });
      fetchOwnRole(user.uid)
        .then((role) => useAuthStore.setState({ role, roleLoaded: true }))
        .catch((error) =>
          useAuthStore.setState({
            authErrorMessage: toFriendlyAuthMessage(error),
            roleLoaded: true,
          })
        );
    },
    (error) => {
      useAuthStore.setState({
        status: 'error',
        authErrorMessage: toFriendlyAuthMessage(error),
      });
    }
  );
}
