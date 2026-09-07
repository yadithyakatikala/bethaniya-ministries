import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { HomeScreen } from '../HomeScreen';

jest.mock('../../../services/firebase/app');

describe('HomeScreen', () => {
  const mockedOnAuthStateChanged = onAuthStateChanged as jest.Mock;
  const mockedSignOut = signOut as jest.Mock;

  afterEach(() => {
    mockedOnAuthStateChanged.mockReset();
    mockedSignOut.mockReset();
  });

  it('greets the signed-in user by display name', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({
        uid: 'u1',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: null,
      });
      return jest.fn();
    });
    const { getByText } = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(getByText('Welcome, Jane Doe')).toBeTruthy());
  });

  it('falls back to email, then phone number, when no display name is set', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u2', displayName: null, email: null, phoneNumber: '+15555550123' });
      return jest.fn();
    });
    const { getByText } = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(getByText('Welcome, +15555550123')).toBeTruthy());
  });

  it('calls Firebase sign-out when "Sign out" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u3', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    mockedSignOut.mockResolvedValue(undefined);
    const { getByTestId } = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('sign-out-button')).toBeTruthy());
    await fireEvent.press(getByTestId('sign-out-button'));
    await waitFor(() => expect(mockedSignOut).toHaveBeenCalled());
  });
});
