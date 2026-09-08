import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

interface AudioPlayerProps {
  /**
   * External URL to a directly-playable audio file/stream (e.g. .mp3,
   * .m4a, .wav, or an HLS .m3u8 URL) -- per storage.rules' "no audio
   * files in Storage" constraint, this is never uploaded to this app.
   * expo-audio hands this URI straight to the platform's native media
   * player (see the doc comment below); a webpage URL such as a YouTube
   * watch page or a Spotify track page is NOT a valid value here -- the
   * native player can't resolve those into audio, this component has no
   * code to do so either, and the admin form's helper text says so. This
   * may also simply be invalid or unreachable; this component must not
   * crash on any of that, only show an error state.
   */
  audioUrl: string;
}

function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Day 6 song audio player -- play/pause, restart, and duration display,
 * per the Day 6 audio requirement. Built on expo-audio's `useAudioPlayer`
 * / `useAudioPlayerStatus` hooks (see the user's approved decision to use
 * expo-audio over the legacy expo-av). `useAudioPlayer(audioUrl)` passes
 * the URL straight through to the platform's native media player
 * (AVPlayer on iOS, ExoPlayer/MediaPlayer on Android, HTML5 `<audio>` on
 * web) -- per expo-audio's own AudioSource type ("a string representing
 * the resource identifier for the audio, which could be an HTTPS
 * address...") and its docs, that native layer expects a URI that
 * resolves directly to audio/media data (a file like .mp3/.m4a/.wav, or
 * a streaming manifest like HLS .m3u8), not a third-party webpage. There
 * is no YouTube/Spotify page-resolution step anywhere in this component
 * or in expo-audio itself -- a page URL from either service will fail to
 * load, the same as any other non-audio URL, and is expected to surface
 * through the error state below rather than crash. `status.error` (a
 * string set by the native layer, never a thrown exception -- see
 * expo-audio's AudioStatus type) is how that failure surfaces, so this
 * component reads that field for its error state rather than needing a
 * try/catch -- there's nothing here that throws.
 *
 * Restyled onto the shared Vespers theme, with a scrubber track filled
 * from the same real `status.currentTime`/`status.duration` the time
 * label already reads -- no new/fake state. The `formatSeconds`
 * output and every testID are unchanged (see AudioPlayer.test.tsx's
 * `'1:05 / 3:20'` assertion).
 *
 * Verification note: this project has no way to exercise real native
 * audio playback in its current environment (no device/simulator, no
 * emulator-backed integration harness) -- the tests for this component
 * mock expo-audio's hooks and only prove the loading/error/playing UI
 * states render and the play/pause/restart controls call the right
 * player methods, not that any specific real-world URL actually plays.
 * Real-device playback verification (including confirming a genuine
 * direct-audio-file URL plays end-to-end) remains an open integration
 * gap, same class of limitation as this project's other emulator-backed
 * verification gaps -- see /SECURITY.md.
 */
export function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const { colors, radii } = useTheme();
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  if (status.error) {
    return (
      <View style={styles.container} testID="audio-player-error">
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load this song&apos;s audio.
        </Text>
      </View>
    );
  }

  if (!status.isLoaded) {
    return (
      <View style={styles.container} testID="audio-player-loading">
        <ActivityIndicator />
      </View>
    );
  }

  const progress =
    status.duration > 0
      ? Math.min(1, Math.max(0, status.currentTime / status.duration))
      : 0;

  return (
    <View style={styles.container} testID="audio-player">
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.trackFill,
            { width: `${progress * 100}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>
      <Text style={[styles.time, { color: colors.secondaryText }]}>
        {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)}
      </Text>
      <View style={styles.controls}>
        <Pressable
          testID="audio-restart-button"
          accessibilityRole="button"
          onPress={() => {
            void player.seekTo(0);
            player.play();
          }}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryLabel, { color: colors.text }]}>Restart</Text>
        </Pressable>
        <Pressable
          testID="audio-play-pause-button"
          accessibilityRole="button"
          onPress={() => (status.playing ? player.pause() : player.play())}
          style={[
            styles.playButton,
            { backgroundColor: colors.primary, borderRadius: radii.control },
          ]}
        >
          <Text style={styles.playLabel}>{status.playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: 10 },
  message: { textAlign: 'center' },
  track: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2 },
  time: { fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  secondaryButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 13.5, fontWeight: '600' },
  playButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
