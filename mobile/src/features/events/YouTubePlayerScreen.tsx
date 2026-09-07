import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { toYouTubeEmbedUrl } from './youtube';

type Props = NativeStackScreenProps<RootStackParamList, 'YouTubePlayer'>;

/**
 * In-app YouTube playback -- Day 7, Option B (approved decision: an
 * in-app WebView loading YouTube's own official /embed/<videoId> player,
 * not a third-party wrapper package, not the YouTube/Google API, and
 * nothing downloaded/proxied/re-hosted -- see youtube.ts's doc comment).
 *
 * `youtubeUrl` arrives as a route param (the event's raw youtubeUrl
 * field, as a Host/Content Admin entered it in the Live Stream Manager --
 * see EventDetailScreen.tsx's "WATCH LIVE" button). It is parsed here,
 * not trusted as already-safe, via the authoritative parser in
 * youtube.ts. An unparseable URL shows a clear error instead of loading
 * a broken/garbage WebView source or crashing.
 *
 * VERIFICATION NOTE: Jest here mocks react-native-webview entirely (see
 * mobile/__mocks__/react-native-webview.js) -- the tests below prove this
 * screen resolves the right embed URL and *asks* a WebView to load it,
 * not that a real WebView actually renders/plays a live YouTube stream on
 * a device. Real playback (video decodes, audio plays, LIVE indicator
 * shows, etc.) is a manual, real-device verification item, same
 * limitation already documented for AudioPlayer.tsx in Day 6's
 * correction pass.
 */
export function YouTubePlayerScreen({ route }: Props) {
  const { youtubeUrl } = route.params;
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl);

  if (!embedUrl) {
    return (
      <View style={styles.container} testID="youtube-player-error">
        <Text style={styles.errorText}>
          This stream link isn&apos;t a supported YouTube URL, so it can&apos;t be played
          here.
        </Text>
      </View>
    );
  }

  return (
    <WebView
      testID="youtube-webview"
      source={{ uri: embedUrl }}
      style={styles.webview}
      allowsFullscreenVideo
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorText: { color: '#666', textAlign: 'center' },
  webview: { flex: 1 },
});
