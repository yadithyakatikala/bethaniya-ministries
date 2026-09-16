import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';
import { isAllowedPlayerNavigation, toYouTubeEmbedUrl } from './youtube';

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
  const { colors } = useTheme();
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl);

  if (!embedUrl) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="youtube-player-error"
      >
        <Text style={[styles.errorText, { color: colors.secondaryText }]}>
          This stream link isn&apos;t a supported YouTube URL, so it can&apos;t be played
          here.
        </Text>
      </View>
    );
  }

  /**
   * Keeps the WebView on YouTube's own player. The embed page has tappable
   * links ("Watch on YouTube", the channel name, end-screen cards); before
   * this guard existed they navigated in place, leaving the member in a
   * chrome-less in-app browser on an arbitrary page with no URL bar and no
   * sign they had left the app's content. Those now open in the system
   * browser, where the user can see where they are and come back.
   *
   * See isAllowedPlayerNavigation() in ./youtube.ts for the allow-list and
   * why non-https schemes are refused outright.
   */
  function handleShouldStartLoad(request: ShouldStartLoadRequest): boolean {
    if (isAllowedPlayerNavigation(request.url)) return true;
    // Only hand real web URLs to the browser -- never an intent://,
    // market:// or other scheme an embedded page might try to fire.
    if (request.url.startsWith('https://')) {
      void Linking.openURL(request.url).catch(() => undefined);
    }
    return false;
  }

  return (
    <WebView
      testID="youtube-webview"
      source={{ uri: embedUrl }}
      style={styles.webview}
      allowsFullscreenVideo
      // Defence in depth alongside onShouldStartLoadWithRequest below:
      // originWhitelist governs what the WebView will load at all, the
      // callback governs each individual navigation.
      originWhitelist={['https://*.youtube.com', 'https://youtube.com']}
      onShouldStartLoadWithRequest={handleShouldStartLoad}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorText: { color: '#666', textAlign: 'center' },
  webview: { flex: 1 },
});
