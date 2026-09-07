import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { DailyVerseCard } from '../DailyVerseCard';

jest.mock('../../../services/firebase/app');

// DailyVerseCard now reads isDark from usePreferences() (Day 9), which
// needs the real provider stack. onAuthStateChanged is left at its
// default (never fires -- see mobile/__mocks__/firebase/auth.js), so
// AuthContext's status stays 'loading' / uid stays null throughout these
// tests, meaning PreferencesProvider never subscribes to a Firestore user
// profile -- the shared `onSnapshot` mock below is only ever driven by
// DailyVerseCard's own daily-verse subscription, exactly as before.
function renderCard() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <DailyVerseCard />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('DailyVerseCard', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state before the first snapshot arrives', async () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await renderCard();
    expect(getByTestId('daily-verse-loading')).toBeTruthy();
  });

  it('shows an empty state when no verse is set for today', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await renderCard();
    await waitFor(() => expect(getByTestId('daily-verse-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await renderCard();
    await waitFor(() => expect(getByTestId('daily-verse-error')).toBeTruthy());
  });

  it("renders today's verse text and reference", async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'For God so loved the world...',
              imageUrl: null,
              date: '2026-09-07',
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText, queryByTestId } = await renderCard();
    await waitFor(() => expect(getByText('For God so loved the world...')).toBeTruthy());
    expect(getByText('John 3:16')).toBeTruthy();
    expect(queryByTestId('daily-verse-image')).toBeNull();
  });

  it('renders the image when imageUrl is set', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'Text',
              imageUrl: 'https://example.com/verse.jpg',
              date: '2026-09-07',
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByTestId } = await renderCard();
    await waitFor(() => expect(getByTestId('daily-verse-image')).toBeTruthy());
  });
});
