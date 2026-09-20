import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../services/firebase/app';
import { signOutUser } from '../services/firebase/authService';
import { logAuthError, toFriendlyAuthMessage } from '../services/firebase/authErrors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LAST_ACTIVE_STORAGE_KEY,
  ensureOwnProfileExists,
  recordSignInActivity,
} from '../services/firebase/userProfile';

/**
 * App-wide authentication state, per FINAL_ARCHITECTURE_SPECIFICATION.md's
 * Day 2 plan. React Context + local state only -- no Redux.
 *
 * `status` distinguishes four cases the app must render correctly for:
 *   - 'loading'         Firebase hasn't reported the initial auth state yet
 *                        (every app open briefly starts here).
 *   - 'unauthenticated'  No signed-in user. This is also where a *failed*
 *                        sign-in attempt (bad OTP, cancelled Google/Apple
 *                        sheet, network error, ...) surfaces: the user stays
 *                        on the sign-in screen with `authErrorMessage` set,
 *                        rather than being sent to a dead-end error screen --
 *                        see reportSignInError().
 *   - 'authenticated'    A real, current firebase/auth User exists.
 *   - 'error'            The Auth *subsystem* itself failed (onAuthStateChanged's
 *                        own error callback) -- distinct from an ordinary
 *                        failed sign-in attempt, since there's no sign-in UI
 *                        to safely fall back to when this happens.
 */
export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** User-friendly message for the most recent failed sign-in attempt (see 'unauthenticated' above), or the subsystem error message when status === 'error'. Never a raw Firebase error. */
  authErrorMessage: string | null;
  /** Records a failed sign-in attempt so the sign-in screen can show it; does not change `status`. */
  reportSignInError: (error: unknown) => void;
  /** Clears authErrorMessage, e.g. when the user starts a new sign-in attempt. */
  clearAuthError: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setStatus(nextUser ? 'authenticated' : 'unauthenticated');
        // Sequenced, not fired in parallel: recordSignInActivity()
        // updates the profile document, so it has to run after the
        // document is known to exist or its updateDoc hits not-found on
        // a brand-new account. Both swallow their own failures -- neither
        // is allowed to be the reason somebody cannot open the app.
        if (nextUser) {
          void ensureOwnProfileExists(nextUser).then(() =>
            recordSignInActivity(nextUser, {
              readLastRecord: () => AsyncStorage.getItem(LAST_ACTIVE_STORAGE_KEY),
              writeLastRecord: (record) =>
                AsyncStorage.setItem(LAST_ACTIVE_STORAGE_KEY, record),
            })
          );
        }
      },
      (error) => {
        setStatus('error');
        logAuthError('auth-subsystem', error);
        setAuthErrorMessage(toFriendlyAuthMessage(error));
      }
    );
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      authErrorMessage,
      reportSignInError: (error: unknown) => {
        logAuthError('sign-in', error);
        setAuthErrorMessage(toFriendlyAuthMessage(error));
      },
      clearAuthError: () => setAuthErrorMessage(null),
      signOut: async () => {
        await signOutUser();
      },
    }),
    [status, user, authErrorMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
