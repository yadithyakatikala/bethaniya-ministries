import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
        onPress={() => reportSignInError({ code: 'auth/invalid-verification-code' })}
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
        'That code doesn’t look right. Please check it and try again.'
      )
    );
    expect(getByTestId('status').props.children).toBe('unauthenticated');

    getByTestId('clear').props.onPress();
    await waitFor(() => expect(getByTestId('error').props.children).toBe('none'));
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
