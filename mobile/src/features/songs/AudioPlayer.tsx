import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ErrorState, GoldFill, Icon, Tappable, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

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
 * THE LOOK. A 4-point track filled in gold from the same real
 * `status.currentTime`/`status.duration` the times read -- no new/fake
 * state -- with the time played at its left end and the length at its
 * right; under it a Restart pill (an icon and a word, 44 high) and, at 64,
 * the round Play/Pause button, whose glyph changes with the state and whose
 * spoken name says what pressing it does. The track is announced as a
 * progress bar ("Song progress", "1:05 / 3:20"); it is not a scrubber, and
 * the design does not draw it as one. A song that cannot load shows the
 * error box, and one still loading a spinner.
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
  const { colors, type } = useTheme();
  const { t } = useTranslation();
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  if (status.error) {
    return (
      <View style={styles.container}>
        <ErrorState testID="audio-player-error" message={t('songs.audioError')} />
      </View>
    );
  }

  if (!status.isLoaded) {
    return (
      <View
        style={[styles.container, styles.loading]}
        testID="audio-player-loading"
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
        accessibilityState={{ busy: true }}
      >
        <ActivityIndicator color={colors.inkMuted} />
      </View>
    );
  }

  const progress =
    status.duration > 0
      ? Math.min(1, Math.max(0, status.currentTime / status.duration))
      : 0;
  const elapsed = formatSeconds(status.currentTime);
  const length = formatSeconds(status.duration);

  return (
    <View style={styles.container} testID="audio-player">
      <View
        testID="audio-track"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('songs.progress')}
        accessibilityValue={{
          min: 0,
          max: Math.max(1, Math.round(status.duration)),
          now: Math.round(status.currentTime),
          text: `${elapsed} / ${length}`,
        }}
        style={[styles.track, { backgroundColor: colors.border }]}
      >
        <View
          testID="audio-track-fill"
          style={[styles.trackFill, { width: `${progress * 100}%` }]}
        >
          <GoldFill />
        </View>
      </View>
      <View style={styles.times}>
        <Text
          testID="audio-time-elapsed"
          style={[type.caption, { color: colors.inkMuted }]}
        >
          {elapsed}
        </Text>
        <Text
          testID="audio-time-length"
          style={[type.caption, { color: colors.inkMuted }]}
        >
          {length}
        </Text>
      </View>
      <View style={styles.controls}>
        <Tappable
          testID="audio-restart-button"
          accessibilityRole="button"
          accessibilityLabel={t('songs.restart')}
          onPress={() => {
            void player.seekTo(0);
            player.play();
          }}
          style={[styles.restart, { borderColor: colors.borderStrong }]}
        >
          <Icon name="restart" size={20} color={colors.ink} />
          <Text style={[type.label, { color: colors.ink }]}>{t('songs.restart')}</Text>
        </Tappable>
        <Tappable
          testID="audio-play-pause-button"
          accessibilityRole="button"
          accessibilityLabel={t(status.playing ? 'songs.pause' : 'songs.play')}
          onPress={() => (status.playing ? player.pause() : player.play())}
          style={[styles.play, { backgroundColor: colors.primary }]}
        >
          <Icon
            name={status.playing ? 'pause' : 'play'}
            size={30}
            color={colors.onPrimary}
          />
        </Tappable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 10 },
  loading: { alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  track: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    minHeight: 68,
  },
  restart: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
