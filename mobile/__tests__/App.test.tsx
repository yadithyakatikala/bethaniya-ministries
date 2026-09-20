import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import App from '../App';
import { translate } from '../src/i18n';

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
    (onSnapshot as jest.Mock).mockReset();
  });

  /**
   * M6. A signed-in member now passes through OnboardingGate before
   * reaching the navigator, and the gate waits for the profile document
   * before deciding -- so a test that signs someone in also has to say
   * what their profile looks like, or the app correctly sits on the
   * loading screen forever. See src/features/onboarding/OnboardingGate.tsx.
   */
  function mockProfile(data: Record<string, unknown> | null) {
    (onSnapshot as jest.Mock).mockImplementation((ref, next) => {
      // ONLY the profile document. This renders the whole app, so every
      // other subscription on Home (announcements, church settings, the
      // daily verse) shares this mock -- handing them a user profile
      // makes them fail in ways that have nothing to do with the gate.
      // __mocks__/firebase/firestore.js's doc() carries the path.
      const path = (ref as { path?: string } | undefined)?.path ?? '';
      if (!path.startsWith('users/')) return jest.fn();
      next(
        data === null
          ? { exists: () => false }
          : { exists: () => true, id: 'user-1', data: () => data }
      );
      return jest.fn();
    });
  }

  /** A member who has already answered the questionnaire. */
  const COMPLETED_PROFILE = {
    role: 'member',
    displayName: 'Test User',
    gender: 'male',
    phoneNumber: '9876543210',
    profileCompletedAt: new Date('2026-01-01T00:00:00Z'),
  };

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
    mockProfile(COMPLETED_PROFILE);
    const { getByTestId, getByText } = await render(<App />);
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    // The greeting is localized now; the default language is Telugu (see
    // src/features/bible/languagePreference.ts's DEFAULT_LANGUAGE).
    expect(getByText(`${translate('en', 'home.welcome')}, Test User`)).toBeTruthy();
  });

  it('shows the onboarding questionnaire to a member who has never answered it', async () => {
    // M6, at the level the gate actually runs: signed in, but straight to
    // the form rather than to the app.
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-1', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    mockProfile({ role: 'member', displayName: null, phoneNumber: null });

    const { getByTestId, queryByTestId } = await render(<App />);
    await waitFor(() => expect(getByTestId('onboarding-screen')).toBeTruthy());
    expect(queryByTestId('home-screen')).toBeNull();
  });
});
