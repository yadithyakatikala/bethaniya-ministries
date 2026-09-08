import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SongsListScreen } from '../SongsListScreen';

jest.mock('../../../services/firebase/app');

/**
 * Only the `navigate` method this screen actually calls is exercised --
 * the `navigation`/`route` casts below stand in for the rest of
 * NativeStackScreenProps' shape, which this test doesn't need (same
 * `as never` convention used in SongDetailScreen.test.tsx).
 *
 * Wrapped in AuthProvider/PreferencesProvider since the screen now reads
 * useTheme() -- same reasoning as AnnouncementsList.test.tsx.
 */
async function renderScreen() {
  const navigate = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <SongsListScreen
          navigation={{ navigate } as never}
          route={{ key: 'SongsList', name: 'SongsList' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate };
}

describe('SongsListScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state before the first snapshot arrives', async () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await renderScreen();
    expect(getByTestId('songs-loading')).toBeTruthy();
  });

  it('shows an empty state when there are no published songs', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('songs-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('songs-error')).toBeTruthy());
  });

  it('renders each published song and navigates to SongDetail on tap', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 's1',
            data: () => ({
              title: 'Amazing Grace',
              artist: 'Traditional',
              category: 'Hymn',
              lyrics: 'Amazing grace...',
              audioUrl: 'https://example.com/song.mp3',
              coverUrl: null,
              published: true,
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText, getByTestId, navigate } = await renderScreen();
    await waitFor(() => expect(getByText('Amazing Grace')).toBeTruthy());
    fireEvent.press(getByTestId('song-s1'));
    expect(navigate).toHaveBeenCalledWith(
      'SongDetail',
      expect.objectContaining({ song: expect.objectContaining({ id: 's1' }) })
    );
  });
});
