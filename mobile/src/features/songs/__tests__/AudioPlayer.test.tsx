import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AudioPlayer } from '../AudioPlayer';

/**
 * expo-audio has no shipped Jest mock (unlike react-native-safe-area-context)
 * and its native module isn't present under Jest, so this test mocks the
 * module boundary directly -- the same "mock the SDK, not the component"
 * convention already used for firebase/firestore and firebase/auth
 * throughout this codebase.
 *
 * IMPORTANT SCOPE NOTE: because useAudioPlayer/useAudioPlayerStatus are
 * mocked, these tests verify AudioPlayer's own UI/state-handling logic
 * (loading/error/playing rendering, and that play/pause/restart call the
 * right player methods) -- they do NOT prove that any real URL, of any
 * format, actually plays through expo-audio on a real device. This
 * project has no emulator/device harness to verify that end-to-end (see
 * AudioPlayer.tsx's "Verification note"), so that remains an open,
 * explicitly-reported integration-verification gap, not something these
 * tests claim to cover.
 *
 * The two "unsupported source" tests below both simulate the SAME
 * mocked failure (`status.error` set) -- expo-audio's native layer
 * doesn't distinguish *why* a source failed to load (a dead link vs. a
 * webpage that was never audio to begin with), it just reports that it
 * couldn't play it. A YouTube/Spotify page URL is one example of a
 * non-audio source that would hit this same path in the real world; it
 * isn't a separately-mockable code path, so there's nothing more
 * specific to assert about it than "an unplayable source shows the
 * error state, not a crash."
 */
jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(),
  useAudioPlayerStatus: jest.fn(),
}));

const mockedUseAudioPlayer = useAudioPlayer as jest.Mock;
const mockedUseAudioPlayerStatus = useAudioPlayerStatus as jest.Mock;

describe('AudioPlayer', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state while the audio has not finished loading', async () => {
    mockedUseAudioPlayer.mockReturnValue({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: false,
      error: null,
      playing: false,
      currentTime: 0,
      duration: 0,
    });
    const { getByTestId } = await render(
      <AudioPlayer audioUrl="https://example.com/song.mp3" />
    );
    expect(getByTestId('audio-player-loading')).toBeTruthy();
  });

  it('shows an error state without crashing when the audio URL is invalid/unavailable', async () => {
    mockedUseAudioPlayer.mockReturnValue({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: false,
      error: 'Failed to load audio',
      playing: false,
      currentTime: 0,
      duration: 0,
    });
    const { getByTestId } = await render(<AudioPlayer audioUrl="not-a-real-url" />);
    expect(getByTestId('audio-player-error')).toBeTruthy();
  });

  it('shows an error state without crashing for a webpage URL (e.g. YouTube/Spotify) that is not a direct audio source', async () => {
    // expo-audio's native player can't resolve a webpage into audio (see
    // AudioPlayer.tsx's doc comment) -- this simulates the native layer
    // reporting that failure the same way it would for any other
    // non-audio source, which is the only way this is meaningfully
    // testable without a real device/network.
    mockedUseAudioPlayer.mockReturnValue({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: false,
      error: 'Failed to load audio',
      playing: false,
      currentTime: 0,
      duration: 0,
    });
    const { getByTestId } = await render(
      <AudioPlayer audioUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
    );
    expect(getByTestId('audio-player-error')).toBeTruthy();
  });

  it('shows play/pause and restart controls with formatted duration once loaded', async () => {
    mockedUseAudioPlayer.mockReturnValue({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: true,
      error: null,
      playing: false,
      currentTime: 65,
      duration: 200,
    });
    const { getByTestId, getByText } = await render(
      <AudioPlayer audioUrl="https://example.com/song.mp3" />
    );
    expect(getByText('1:05 / 3:20')).toBeTruthy();
    expect(getByTestId('audio-play-pause-button')).toBeTruthy();
    expect(getByTestId('audio-restart-button')).toBeTruthy();
  });

  it('calls player.play() when Play is pressed while paused', async () => {
    const play = jest.fn();
    const pause = jest.fn();
    mockedUseAudioPlayer.mockReturnValue({ play, pause, seekTo: jest.fn() });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: true,
      error: null,
      playing: false,
      currentTime: 0,
      duration: 100,
    });
    const { getByTestId } = await render(
      <AudioPlayer audioUrl="https://example.com/song.mp3" />
    );
    fireEvent.press(getByTestId('audio-play-pause-button'));
    expect(play).toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it('calls player.pause() when Pause is pressed while playing', async () => {
    const play = jest.fn();
    const pause = jest.fn();
    mockedUseAudioPlayer.mockReturnValue({ play, pause, seekTo: jest.fn() });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: true,
      error: null,
      playing: true,
      currentTime: 10,
      duration: 100,
    });
    const { getByTestId } = await render(
      <AudioPlayer audioUrl="https://example.com/song.mp3" />
    );
    fireEvent.press(getByTestId('audio-play-pause-button'));
    expect(pause).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('seeks to 0 and plays when Restart is pressed', async () => {
    const play = jest.fn();
    const seekTo = jest.fn().mockResolvedValue(undefined);
    mockedUseAudioPlayer.mockReturnValue({ play, pause: jest.fn(), seekTo });
    mockedUseAudioPlayerStatus.mockReturnValue({
      isLoaded: true,
      error: null,
      playing: true,
      currentTime: 50,
      duration: 100,
    });
    const { getByTestId } = await render(
      <AudioPlayer audioUrl="https://example.com/song.mp3" />
    );
    fireEvent.press(getByTestId('audio-restart-button'));
    expect(seekTo).toHaveBeenCalledWith(0);
    await waitFor(() => expect(play).toHaveBeenCalled());
  });
});
