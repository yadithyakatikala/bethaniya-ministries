import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SongsListScreen } from '../SongsListScreen';
import { toggleFavoriteSong } from '../favorites';

jest.mock('../../../services/firebase/app');

/**
 * Only the `navigate` and `goBack` methods this screen actually calls are
 * exercised -- the `navigation`/`route` casts below stand in for the rest of
 * NativeStackScreenProps' shape, which this test doesn't need (same
 * `as never` convention used in SongDetailScreen.test.tsx).
 *
 * Wrapped in AuthProvider/PreferencesProvider since the screen now reads
 * useTheme() -- same reasoning as AnnouncementsList.test.tsx.
 */
async function renderScreen() {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <SongsListScreen
          navigation={{ navigate, goBack } as never}
          route={{ key: 'SongsList', name: 'SongsList' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

function songDoc(id: string, fields: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      title: `Song ${id}`,
      artist: 'Traditional',
      category: 'Hymn',
      lyrics: 'Amazing grace...',
      audioUrl: 'https://example.com/song.mp3',
      coverUrl: null,
      published: true,
      ...fields,
    }),
  };
}

/** Delivers `docs` to the screen's listener as soon as it subscribes. */
function publish(docs: ReturnType<typeof songDoc>[]) {
  (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
    next({ docs });
    return jest.fn();
  });
}

describe('SongsListScreen', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

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
    expect(getByTestId('songs-empty')).toHaveTextContent(/No songs yet/);
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('songs-error')).toBeTruthy());
    expect(getByTestId('songs-error')).toHaveTextContent(/Could not load songs\./);
  });

  it('subscribes again, and shows the songs, when Try again is pressed', async () => {
    (onSnapshot as jest.Mock)
      .mockImplementationOnce((_q, _next, err) => {
        err({ code: 'unavailable' });
        return jest.fn();
      })
      .mockImplementation((_q, next) => {
        next({ docs: [songDoc('s1', { title: 'Amazing Grace' })] });
        return jest.fn();
      });
    const { getByText, getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('songs-error')).toBeTruthy());

    await fireEvent.press(getByText('Try again'));

    await waitFor(() => expect(getByText('Amazing Grace')).toBeTruthy());
    expect(queryByTestId('songs-error')).toBeNull();
    expect((onSnapshot as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('renders each published song and navigates to SongDetail on tap', async () => {
    publish([
      songDoc('s1', {
        title: 'Amazing Grace',
        artist: 'Traditional',
        lyrics: 'Amazing grace...',
      }),
    ]);
    const { getByText, getByTestId, navigate } = await renderScreen();
    await waitFor(() => expect(getByText('Amazing Grace')).toBeTruthy());
    await fireEvent.press(getByTestId('song-s1'));
    expect(navigate).toHaveBeenCalledWith(
      'SongDetail',
      expect.objectContaining({ song: expect.objectContaining({ id: 's1' }) })
    );
  });

  it('has a top bar named Songs whose Back leaves the screen', async () => {
    publish([songDoc('s1')]);
    const { getByText, getByRole, goBack } = await renderScreen();
    expect(getByText('Songs')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('draws the cover when a song has one, and a tile with a note when it has none', async () => {
    publish([
      songDoc('s1', { coverUrl: 'https://example.com/cover.jpg' }),
      songDoc('s2', { coverUrl: null }),
    ]);
    const { getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('song-s1')).toBeTruthy());
    expect(
      getByTestId('song-s1-cover-image', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(getByTestId('song-s2-cover', { includeHiddenElements: true })).toBeTruthy();
    expect(
      queryByTestId('song-s2-cover-image', { includeHiddenElements: true })
    ).toBeNull();
  });

  it('names a row by its title and artist, and says when it is a favourite', async () => {
    await AsyncStorage.setItem('song_favorites', JSON.stringify(['s2']));
    publish([
      songDoc('s1', { title: 'Be Still', artist: 'Church choir' }),
      songDoc('s2', { title: 'Amazing Grace', artist: 'Hymn' }),
    ]);
    const { getByRole } = await renderScreen();
    await waitFor(() =>
      expect(
        getByRole('button', { name: 'Amazing Grace. Hymn. Favourited' })
      ).toBeTruthy()
    );
    expect(getByRole('button', { name: 'Be Still. Church choir' })).toBeTruthy();
  });

  describe('favourites', () => {
    beforeEach(() => {
      publish([
        songDoc('s1', { title: 'Amazing Grace' }),
        songDoc('s2', { title: 'How Great Thou Art' }),
        songDoc('s3', { title: 'Be Still' }),
      ]);
    });

    it('draws a filled heart on the favourites only', async () => {
      await AsyncStorage.setItem('song_favorites', JSON.stringify(['s1', 's3']));
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('song-s1-favourite')).toBeTruthy());
      expect(getByTestId('song-s3-favourite')).toBeTruthy();
      expect(queryByTestId('song-s2-favourite')).toBeNull();
    });

    it('starts on All, with both chips announcing which is chosen', async () => {
      const { getByRole, getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('song-s1')).toBeTruthy());
      expect(getByRole('button', { name: 'All', selected: true })).toBeTruthy();
      expect(getByRole('button', { name: 'Favourites', selected: false })).toBeTruthy();
    });

    it('lists only the favourites under the Favourites chip, and everything again under All', async () => {
      await AsyncStorage.setItem('song_favorites', JSON.stringify(['s2']));
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('song-s1')).toBeTruthy());

      await fireEvent.press(getByTestId('songs-filter-favourites'));
      expect(getByTestId('song-s2')).toBeTruthy();
      expect(queryByTestId('song-s1')).toBeNull();
      expect(queryByTestId('song-s3')).toBeNull();

      await fireEvent.press(getByTestId('songs-filter-all'));
      expect(getByTestId('song-s1')).toBeTruthy();
      expect(getByTestId('song-s2')).toBeTruthy();
      expect(getByTestId('song-s3')).toBeTruthy();
    });

    it('says how to add a favourite when there are none, not that the church has no songs', async () => {
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('song-s1')).toBeTruthy());

      await fireEvent.press(getByTestId('songs-filter-favourites'));

      expect(getByTestId('songs-no-favourites')).toHaveTextContent(/No favourites yet/);
      expect(getByTestId('songs-no-favourites')).toHaveTextContent(
        /Choose Favourite on a song to keep it here\./
      );
      expect(queryByTestId('songs-empty')).toBeNull();
      expect(queryByTestId('songs-list')).toBeNull();
    });

    it('keeps the chips on screen in every state', async () => {
      (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
      const { getByTestId } = await renderScreen();
      expect(getByTestId('songs-loading')).toBeTruthy();
      expect(getByTestId('songs-filter-all')).toBeTruthy();
      expect(getByTestId('songs-filter-favourites')).toBeTruthy();
    });

    it('does not list a favourite whose song is no longer published', async () => {
      await AsyncStorage.setItem('song_favorites', JSON.stringify(['s9']));
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('song-s1')).toBeTruthy());
      await fireEvent.press(getByTestId('songs-filter-favourites'));
      expect(queryByTestId('song-s9')).toBeNull();
      expect(getByTestId('songs-no-favourites')).toBeTruthy();
    });

    it('hears of a favourite chosen on a song’s own page while the list waits underneath', async () => {
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('song-s2')).toBeTruthy());
      expect(queryByTestId('song-s2-favourite')).toBeNull();

      await act(async () => {
        await toggleFavoriteSong('s2');
      });
      expect(getByTestId('song-s2-favourite')).toBeTruthy();

      await act(async () => {
        await toggleFavoriteSong('s2');
      });
      expect(queryByTestId('song-s2-favourite')).toBeNull();
    });
  });
});
