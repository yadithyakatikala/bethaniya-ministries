import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import App from '../App';

jest.mock('../src/services/firebase/app');
jest.mock('../src/features/auth/useGoogleSignIn');

/**
 * Day 2 replaces the Day 1 static-placeholder smoke test with real coverage
 * of AuthGate's three render states (loading / unauthenticated /
 * authenticated), driven through the actual AuthProvider + onAuthStateChanged
 * wiring -- only the underlying Firebase SDK call is mocked (see
 * mobile/__mocks__/firebase/auth.js and src/services/firebase/__mocks__/app.ts),
 * so this is a real test of AuthContext + App's rendering logic, not of
 * Firebase itself.
 */
describe('App', () => {
  const mockedOnAuthStateChanged = onAuthStateChanged as jest.Mock;

  afterEach(() => {
    mockedOnAuthStateChanged.mockReset();
  });

  it('shows the loading screen before Firebase reports the initial auth state', async () => {
    mockedOnAuthStateChanged.mockImplementation(() => jest.fn());
    const { getByTestId } = await render(<App />);
    expect(getByTestId('auth-loading-screen')).toBeTruthy();
  });

  it('shows the sign-in screen once Firebase reports no signed-in user', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const { getByTestId } = await render(<App />);
    await waitFor(() => expect(getByTestId('sign-in-screen')).toBeTruthy());
  });

  it('shows the home screen once Firebase reports a signed-in user', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-1', displayName: 'Test User', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId, getByText } = await render(<App />);
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    expect(getByText('Welcome, Test User')).toBeTruthy();
  });
});
