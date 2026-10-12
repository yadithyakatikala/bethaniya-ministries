import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { AppButton, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';
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
 * THE LOOK. A top bar with Back and the event's name (`title`, passed by the
 * event's page; "Watch live on YouTube" when it was reached without one), and
 * the player edge to edge at 16:9 on black. A link that is not a supported
 * YouTube address says so in the error box, with a "Back to the event" button
 * -- never a dead end.
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
export function YouTubePlayerScreen({ route, navigation }: Props) {
  const { youtubeUrl, title } = route.params;
  const { colors, layout, radii, type } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const embedUrl = toYouTubeEmbedUrl(youtubeUrl);
  const pad = { paddingHorizontal: layout.screenMargin };

  const bar = (
    <View style={pad}>
      <TopBar
        title={title ?? t('events.watchOnYouTube')}
        onBack={() => navigation.goBack()}
      />
    </View>
  );

  if (!embedUrl) {
    return (
      <View
        style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
        testID="youtube-player-error"
      >
        {bar}
        <View style={[pad, styles.errorWrap]}>
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.error,
              {
                backgroundColor: colors.dangerTint,
                borderColor: colors.danger,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[type.body, styles.errorText, { color: colors.ink }]}>
              {t('events.unsupportedStreamLink')}
            </Text>
            <AppButton
              testID="youtube-back-to-event"
              title={t('events.backToEvent')}
              variant="secondary"
              compact
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
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
    <View
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {bar}
      <View style={styles.player}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Black behind the video, whichever palette the app is in: it is the
  // letterbox of a film, not a surface of the interface.
  player: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  errorWrap: { marginTop: 16 },
  error: { borderWidth: 1, padding: 24, gap: 12, alignItems: 'center' },
  errorText: { textAlign: 'center' },
});
