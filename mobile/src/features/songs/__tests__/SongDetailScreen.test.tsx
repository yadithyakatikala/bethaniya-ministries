import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SongDetailScreen } from '../SongDetailScreen';
import type { PublishedSong } from '../../../services/firebase/songs';

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
 * Only `route.params.song` is read by this screen -- the `navigation`
 * and `route` casts below stand in for the rest of NativeStackScreenProps'
 * shape, which this test doesn't need (same `as never` convention already
 * used elsewhere in this codebase for a deliberately-incomplete mock
 * shape, e.g. admin's Firestore error mocks).
 */
async function renderScreen() {
  return await render(
    <AuthProvider>
      <PreferencesProvider>
        <SongDetailScreen
          navigation={{} as never}
          route={
            { key: 'SongDetail', name: 'SongDetail', params: { song: SONG } } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
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

    fireEvent.press(getByTestId('favorite-button'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('song_favorites')).toBe(JSON.stringify(['s1']))
    );
  });
});
