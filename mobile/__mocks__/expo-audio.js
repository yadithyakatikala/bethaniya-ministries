/**
 * Manual Jest mock for 'expo-audio' -- same automatic-node-module-mock
 * pattern as ./firebase/auth.js and ./firebase/firestore.js (a root-level
 * __mocks__ file applied to every test with no jest.mock() call needed).
 *
 * expo-audio's real native module isn't present under Jest (no real
 * device/simulator) -- unlike firebase/auth and firebase/firestore,
 * expo-audio throws at *import* time (not just at call time) when its
 * native module is missing, so every test whose module graph reaches
 * AudioPlayer.tsx (even without rendering it -- e.g. App.test.tsx, which
 * renders AppNavigator but never navigates to SongDetail) needs this
 * mocked, not just the tests that exercise audio playback directly.
 * src/features/songs/__tests__/AudioPlayer.test.tsx and
 * SongDetailScreen.test.tsx additionally declare their own
 * jest.mock('expo-audio', ...) to fully control per-test return values;
 * that per-file mock simply takes precedence over this one there.
 */
module.exports = {
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    isLoaded: false,
    error: null,
    playing: false,
    currentTime: 0,
    duration: 0,
  })),
};
