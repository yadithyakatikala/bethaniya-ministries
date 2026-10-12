import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SongDetailScreen } from '../SongDetailScreen';
import type { PublishedSong } from '../../../services/firebase/songs';
import { fontFamilies, lightTokens } from '../../../theme/tokens';

jest.mock('../../../services/firebase/app');

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(),
  useAudioPlayerStatus: jest.fn(),
}));

const mockedUseAudioPlayer = useAudioPlayer as jest.Mock;
const mockedUseAudioPlayerStatus = useAudioPlayerStatus as jest.Mock;

const SONG: PublishedSong = {
  id: 's1',
  title: 'Amazing Grace',
  artist: 'Traditional',
  category: 'Hymn',
  lyrics: 'Amazing grace, how sweet the sound',
  audioUrl: 'https://example.com/song.mp3',
  coverUrl: null,
};

/**
 * Only `route.params.song` and `navigation.goBack` are read by this screen --
 * the `navigation` and `route` casts below stand in for the rest of
 * NativeStackScreenProps' shape, which this test doesn't need (same
 * `as never` convention already used elsewhere in this codebase for a
 * deliberately-incomplete mock shape, e.g. admin's Firestore error mocks).
 */
async function renderScreen(song: PublishedSong = SONG) {
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <SongDetailScreen
          navigation={{ goBack } as never}
          route={{ key: 'SongDetail', name: 'SongDetail', params: { song } } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, goBack };
}

describe('SongDetailScreen', () => {
  beforeEach(() => {
    mockedUseAudioPlayer.mockReturnValue({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: true,
      error: null,
      playing: false,
      currentTime: 0,
      duration: 100,
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('shows the title, artist, and lyrics', async () => {
    const { getByText, getByTestId } = await renderScreen();
    expect(getByText('Amazing Grace')).toBeTruthy();
    expect(getByText('Traditional')).toBeTruthy();
    expect(getByTestId('song-lyrics')).toHaveTextContent(
      'Amazing grace, how sweet the sound'
    );
  });

  it('renders the audio player for the song', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('audio-player')).toBeTruthy());
  });

  it('toggles the favorite button and persists the choice', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('favorite-button')).toBeTruthy());

    await fireEvent.press(getByTestId('favorite-button'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('song_favorites')).toBe(JSON.stringify(['s1']))
    );
  });

  it('has a top bar whose Back leaves the screen', async () => {
    const { getByRole, goBack } = await renderScreen();
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('draws the cover when the song has one, and a tile with a note when it has none', async () => {
    const withCover = await renderScreen({
      ...SONG,
      coverUrl: 'https://example.com/c.jpg',
    });
    expect(
      withCover.getByTestId('song-cover-image', { includeHiddenElements: true })
    ).toBeTruthy();
    await withCover.unmount();

    const without = await renderScreen();
    expect(
      without.getByTestId('song-cover', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(
      without.queryByTestId('song-cover-image', { includeHiddenElements: true })
    ).toBeNull();
  });

  it('sets each stanza as its own paragraph under a Lyrics heading, keeping line breaks', async () => {
    const { getByText, getByTestId } = await renderScreen({
      ...SONG,
      lyrics: 'Line one\nLine two\n\nLine three\n\n\nLine four',
    });
    expect(getByText('Lyrics')).toBeTruthy();
    // A blank line (or several) starts a new stanza; a single line break stays inside one.
    expect(getByText('Line one\nLine two')).toBeTruthy();
    expect(getByText('Line three')).toBeTruthy();
    expect(getByText('Line four')).toBeTruthy();
    expect(getByTestId('song-lyrics').children).toHaveLength(3);
  });

  it('leaves out the Lyrics heading when the song has no lyrics', async () => {
    const { queryByText, queryByTestId } = await renderScreen({
      ...SONG,
      lyrics: '  \n\n ',
    });
    expect(queryByText('Lyrics')).toBeNull();
    expect(queryByTestId('song-lyrics')).toBeNull();
  });

  it('sets the title in the serif of its script, and in the interface face when scripts mix', async () => {
    const latin = await renderScreen();
    expect(
      StyleSheet.flatten(latin.getByTestId('song-title').props.style).fontFamily
    ).toBe(fontFamilies.serifEnSemiBold);
    await latin.unmount();

    const telugu = await renderScreen({ ...SONG, title: 'ఆశ్చర్యకరమైన కృప' });
    expect(
      StyleSheet.flatten(telugu.getByTestId('song-title').props.style).fontFamily
    ).toBe(fontFamilies.serifTeSemiBold);
    await telugu.unmount();

    const mixed = await renderScreen({
      ...SONG,
      title: 'Amazing Grace - ఆశ్చర్యకరమైన కృప',
    });
    expect(
      StyleSheet.flatten(mixed.getByTestId('song-title').props.style).fontFamily
    ).toBe(fontFamilies.interfaceSemiBold);
  });

  it('announces the title as a heading', async () => {
    const { getByRole } = await renderScreen();
    expect(getByRole('header', { name: 'Amazing Grace' })).toBeTruthy();
  });

  describe('the Favourite pill', () => {
    it('starts as an outlined "Favourite" that is not selected and says it adds', async () => {
      const { getByTestId } = await renderScreen();
      const pill = getByTestId('favorite-button');
      expect(pill).toHaveTextContent(/^Favourite$/);
      expect(pill.props.accessibilityState).toMatchObject({ selected: false });
      expect(pill.props.accessibilityHint).toBe('Add to favourites');
    });

    it('becomes "Favourited", selected, in the ink fill, once chosen -- and goes back when pressed again', async () => {
      const { getByTestId } = await renderScreen();
      await fireEvent.press(getByTestId('favorite-button'));
      await waitFor(() =>
        expect(getByTestId('favorite-button')).toHaveTextContent(/^Favourited$/)
      );
      const chosen = getByTestId('favorite-button');
      expect(chosen.props.accessibilityState).toMatchObject({ selected: true });
      expect(chosen.props.accessibilityHint).toBe('Remove from favourites');
      // The ink fill, never gold.
      const fill = StyleSheet.flatten(chosen.props.style).backgroundColor;
      expect(fill).toBe(lightTokens.primary);
      expect(fill).not.toBe(lightTokens.accent);

      await fireEvent.press(getByTestId('favorite-button'));
      await waitFor(() =>
        expect(getByTestId('favorite-button')).toHaveTextContent(/^Favourite$/)
      );
      expect(await AsyncStorage.getItem('song_favorites')).toBe(JSON.stringify([]));
    });

    it('opens already chosen for a song the member favourited before', async () => {
      await AsyncStorage.setItem('song_favorites', JSON.stringify(['s0', 's1']));
      const { getByTestId } = await renderScreen();
      await waitFor(() =>
        expect(getByTestId('favorite-button')).toHaveTextContent(/^Favourited$/)
      );
    });

    it('stays as it was, without an error, when storage cannot be read or written', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('unreadable'))
      );
      const { getByTestId } = await renderScreen();
      expect(getByTestId('favorite-button')).toHaveTextContent(/^Favourite$/);

      (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('unwritable'))
      );
      await fireEvent.press(getByTestId('favorite-button'));
      await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
      expect(getByTestId('favorite-button')).toHaveTextContent(/^Favourite$/);
    });
  });
});
