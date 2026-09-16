import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { runTransaction } from 'firebase/firestore';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../services/firebase/app');

/**
 * Direct unit tests of the auth state machine itself -- loading /
 * unauthenticated / authenticated / error, plus sign-out and the
 * sign-in-error reporting path used by SignInScreen. App.test.tsx covers the
 * same states at the App-rendering level; these tests assert on the context
 * value directly.
 */
function Probe() {
  const {
    status,
    user,
    authErrorMessage,
    reportSignInError,
    clearAuthError,
    signOut: doSignOut,
  } = useAuth();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="uid">{user?.uid ?? 'none'}</Text>
      <Text testID="error">{authErrorMessage ?? 'none'}</Text>
      <Text
        testID="report"
        onPress={() => reportSignInError({ code: 'auth/invalid-credential' })}
      >
        report
      </Text>
      <Text testID="clear" onPress={() => clearAuthError()}>
        clear
      </Text>
      <Text testID="signout" onPress={() => void doSignOut()}>
        signout
      </Text>
    </>
  );
}

describe('AuthContext', () => {
  const mockedOnAuthStateChanged = onAuthStateChanged as jest.Mock;
  const mockedSignOut = signOut as jest.Mock;

  afterEach(() => {
    mockedOnAuthStateChanged.mockReset();
    mockedSignOut.mockReset();
    (runTransaction as jest.Mock).mockClear();
  });

  it('starts in the loading state until Firebase reports the initial auth state', async () => {
    mockedOnAuthStateChanged.mockImplementation(() => jest.fn());
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(getByTestId('status').props.children).toBe('loading');
  });

  it('transitions to unauthenticated when there is no user', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('unauthenticated')
    );
  });

  it('transitions to authenticated with the reported user when one exists', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-42' });
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('authenticated')
    );
    expect(getByTestId('uid').props.children).toBe('user-42');
  });

  it('transitions to the error state when the Auth subsystem itself reports an error', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, _onNext, onError) => {
      onError({ code: 'auth/internal-error' });
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('status').props.children).toBe('error'));
    expect(getByTestId('error').props.children).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('reports a friendly message for a failed sign-in attempt without changing status', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('unauthenticated')
    );

    getByTestId('report').props.onPress();
    await waitFor(() =>
      expect(getByTestId('error').props.children).toBe(
        'That email or password isn’t right. Please try again.'
      )
    );
    expect(getByTestId('status').props.children).toBe('unauthenticated');

    getByTestId('clear').props.onPress();
    await waitFor(() => expect(getByTestId('error').props.children).toBe('none'));
  });

  it('ensures the signed-in user has a /users/{uid} profile document (Cloud Functions cannot be relied on to create it -- see userProfile.ts)', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-42', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('authenticated')
    );
    await waitFor(() => expect(runTransaction).toHaveBeenCalled());
  });

  it('does not attempt to create a profile document when there is no signed-in user', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('unauthenticated')
    );
    expect(runTransaction).not.toHaveBeenCalled();
  });

  // --- Session lifecycle / persistence ---------------------------------
  // The AsyncStorage-backed persistence that makes a session survive an app
  // restart is pinned in services/firebase/__tests__/app.test.ts. These
  // cover what this provider itself owns: restoring a persisted session on
  // mount, releasing the listener, and reacting to sign-out.

  it('restores a persisted session on mount without any sign-in call', async () => {
    // This is what an app relaunch looks like from here: the very first
    // onAuthStateChanged callback already carries a user, recovered from
    // AsyncStorage by firebase/auth. Nothing calls a sign-in method.
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'returning-member', email: 'member@example.com' });
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('authenticated')
    );
    expect(getByTestId('uid').props.children).toBe('returning-member');
    // A restored session must not surface a stale error banner.
    expect(getByTestId('error').props.children).toBe('none');
  });

  it('unsubscribes from the auth listener when the provider unmounts', async () => {
    // A leaked listener keeps calling setState on an unmounted tree.
    const unsubscribe = jest.fn();
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-1' });
      return unsubscribe;
    });
    const { unmount, getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('authenticated')
    );

    await unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('returns to unauthenticated when the listener reports the session ended', async () => {
    // Covers both explicit sign-out and a server-side session revocation:
    // either way Firebase re-invokes the listener with null.
    let emit: ((user: unknown) => void) | undefined;
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      emit = onNext;
      onNext({ uid: 'user-1' });
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('authenticated')
    );

    await waitFor(() => expect(emit).toBeDefined());
    emit!(null);

    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('unauthenticated')
    );
    expect(getByTestId('uid').props.children).toBe('none');
  });

  it('re-attempts profile creation on a later session for the same user', async () => {
    // ensureOwnProfileExists() swallows failures by design and relies on
    // the next sign-in/app-open to retry -- so it must run on every
    // authenticated callback, not only the first ever.
    let emit: ((user: unknown) => void) | undefined;
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      emit = onNext;
      onNext({ uid: 'user-42', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(runTransaction).toHaveBeenCalledTimes(1));

    emit!(null);
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('unauthenticated')
    );
    emit!({ uid: 'user-42', displayName: null, email: null, phoneNumber: null });

    await waitFor(() => expect(runTransaction).toHaveBeenCalledTimes(2));
  });

  it('calls firebase/auth signOut when signOut is invoked', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-1' });
      return jest.fn();
    });
    mockedSignOut.mockResolvedValue(undefined);
    const { getByTestId } = await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('authenticated')
    );

    getByTestId('signout').props.onPress();
    await waitFor(() => expect(mockedSignOut).toHaveBeenCalled());
  });
});
