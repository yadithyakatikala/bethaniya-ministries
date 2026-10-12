import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { PrayersHubScreen } from '../PrayersHubScreen';

jest.mock('../../../services/firebase/app');
// The two views are tested on their own; here they only have to be the right one.
jest.mock('../../prayer-wall/PrayerWallScreen', () => {
  const { Text } = jest.requireActual('react-native');
  return { PrayerWallScreen: () => <Text testID="wall-stub">The wall</Text> };
});
jest.mock('../PrayersScreen', () => {
  const { Text } = jest.requireActual('react-native');
  return { PrayersScreen: () => <Text testID="journal-stub">The journal</Text> };
});

/**
 * Prayers: ONE destination with two views -- the church's Requests and the
 * member's own journal. A tester reported them as one feature listed twice
 * (a wall tile and a journal tile); they are the two tabs of one place now.
 */
function ui(tab?: 'requests' | 'journal') {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <PrayersHubScreen
          navigation={{} as never}
          route={
            {
              key: 'PrayersHub',
              name: 'PrayersHub',
              params: tab ? { tab } : undefined,
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

describe('PrayersHubScreen', () => {
  it('is titled "Prayers", as a heading', async () => {
    const { getByText, getByTestId } = await render(ui());
    expect(getByTestId('prayers-hub')).toBeTruthy();
    expect(getByText('Prayers').props.accessibilityRole).toBe('header');
  });

  it('offers Requests and My journal as two tabs, Requests chosen', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayers-tabs').props.accessibilityRole).toBe('tablist');
    const requests = getByTestId('prayers-tabs-requests');
    const journal = getByTestId('prayers-tabs-journal');
    expect(requests.props.accessibilityLabel).toBe('Requests');
    expect(journal.props.accessibilityLabel).toBe('My journal');
    expect(requests.props.accessibilityState.selected).toBe(true);
    expect(journal.props.accessibilityState.selected).toBe(false);
  });

  it('shows the wall of requests first, and only that', async () => {
    const { getByTestId, queryByTestId } = await render(ui());
    expect(getByTestId('wall-stub')).toBeTruthy();
    expect(queryByTestId('journal-stub')).toBeNull();
  });

  it('opens on the journal when the route asks for it (Saved’s "Prayer journal" row)', async () => {
    const { getByTestId, queryByTestId } = await render(ui('journal'));
    expect(getByTestId('journal-stub')).toBeTruthy();
    expect(queryByTestId('wall-stub')).toBeNull();
    expect(getByTestId('prayers-tabs-journal').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('switches view on a tap, mounting only the one in view', async () => {
    const { getByTestId, queryByTestId } = await render(ui());
    await fireEvent.press(getByTestId('prayers-tabs-journal'));
    expect(getByTestId('journal-stub')).toBeTruthy();
    expect(queryByTestId('wall-stub')).toBeNull();

    await fireEvent.press(getByTestId('prayers-tabs-requests'));
    expect(getByTestId('wall-stub')).toBeTruthy();
    expect(queryByTestId('journal-stub')).toBeNull();
  });

  it('moves to the journal when navigated to again asking for it', async () => {
    const { getByTestId, rerender } = await render(ui());
    await rerender(ui('journal'));
    await waitFor(() => expect(getByTestId('journal-stub')).toBeTruthy());
  });

  it('keeps the title while the view changes', async () => {
    const { getByText, getByTestId } = await render(ui());
    await fireEvent.press(getByTestId('prayers-tabs-journal'));
    expect(getByText('Prayers')).toBeTruthy();
  });

  it('is titled and tabbed in Telugu in a Telugu interface', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await render(ui());
    await waitFor(() =>
      expect(getByTestId('prayers-tabs-requests').props.accessibilityLabel).toMatch(
        /[ఀ-౿]/u
      )
    );
    expect(getByTestId('prayers-tabs-journal').props.accessibilityLabel).toMatch(
      /[ఀ-౿]/u
    );
  });
});
