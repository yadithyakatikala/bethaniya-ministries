import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  AppButton,
  Badge,
  Icon,
  contentTextStyle,
  scriptOf,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';
import { eventWhen } from './eventWhen';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

/**
 * Builds a Google Maps search URL for a free-text location string. No map
 * SDK/package is used (per the Day 7 decision) -- this is just a URL
 * that Linking.openURL() hands to whatever maps app/website the device
 * resolves it with.
 */
export function buildMapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/**
 * Event detail -- Day 7 scope. Receives the full event object as a route
 * param (same reasoning as SongDetail's route param -- see
 * AppNavigator.tsx). Shows title/starts-at/location/description, an
 * "Open in Maps" button (Linking.openURL only, no map SDK), and a "Watch
 * live" button that only appears when the event is actually live
 * (event.isLive === true) -- this is a real-time field from the
 * subscription, not a static flag, so the button appears/disappears live
 * as a Host starts/ends the stream from the admin Live Stream Manager.
 *
 * THE LOOK. A top bar with Back; a LIVE NOW badge when it is on; the title in
 * the serif of its script (the design's rule S5); then, between two
 * hairlines, when it starts (a calendar, in bold) and where (a pin, the
 * place in bold, and a small outlined "Open in Maps" under it) -- icons in
 * ink, never gold; then the description. A live event has a bar fixed to the
 * foot of the screen with one full-width red button, "Watch live on
 * YouTube", so the way in is always under the thumb. An event with no place
 * has no place row (and no Maps button to search for nothing); one with no
 * description has no paragraph. Same testID/behavior contract as before --
 * see EventDetailScreen.test.tsx.
 */
export function EventDetailScreen({ route, navigation }: Props) {
  const { event } = route.params;
  const { colors, layout } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const when = eventWhen(event, appLanguage, t('events.today'), t('events.dateTBA'));
  const location = event.location.trim();
  const description = event.description.trim();
  const telugu = (text: string) =>
    appLanguage === 'te' || ['telugu', 'mixed'].includes(scriptOf(text));

  function handleOpenMaps() {
    void Linking.openURL(buildMapsSearchUrl(event.location));
  }

  function handleWatchLive() {
    navigation.navigate('YouTubePlayer', {
      youtubeUrl: event.youtubeUrl,
      title: event.title,
    });
  }

  return (
    <View
      testID="event-detail-screen"
      style={[styles.screen, { backgroundColor: colors.paper }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingHorizontal: layout.screenMargin,
          // Room under the last line for the live bar, when there is one.
          paddingBottom: event.isLive ? insets.bottom + 120 : insets.bottom + 40,
        }}
      >
        <TopBar onBack={() => navigation.goBack()} />

        {event.isLive ? (
          <View style={styles.badge}>
            <Badge testID="event-live-badge" variant="live" label={t('common.liveNow')} />
          </View>
        ) : null}

        <Text
          accessibilityRole="header"
          testID="event-title"
          style={[
            contentTextStyle(event.title, {
              size: 26,
              line: 32,
              teSize: 24,
              teLine: 40,
              weight: 'semiBold',
              fallback: appLanguage,
            }),
            { color: colors.ink, marginTop: event.isLive ? 10 : 8 },
          ]}
        >
          {event.title}
        </Text>

        <View
          style={[
            styles.info,
            { borderTopColor: colors.border, borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Icon name="calendar" size={22} color={colors.inkMuted} />
            </View>
            <View style={styles.infoText}>
              <Text
                testID="event-when"
                style={[
                  styles.strong,
                  telugu(when) && styles.strongTe,
                  { color: colors.ink },
                ]}
              >
                {when}
              </Text>
            </View>
          </View>
          {location ? (
            <View
              style={[
                styles.infoRow,
                styles.infoRowRule,
                { borderTopColor: colors.border },
              ]}
            >
              <View style={styles.infoIcon}>
                <Icon name="pin" size={22} color={colors.inkMuted} />
              </View>
              <View style={styles.infoText}>
                <Text
                  testID="event-location"
                  style={[
                    styles.strong,
                    telugu(location) && styles.strongTe,
                    { color: colors.ink },
                  ]}
                >
                  {event.location}
                </Text>
                <AppButton
                  testID="open-maps-button"
                  title={t('events.openInMaps')}
                  variant="secondary"
                  compact
                  leadingIcon="external"
                  onPress={handleOpenMaps}
                />
              </View>
            </View>
          ) : null}
        </View>

        {description ? (
          <Text
            testID="event-description"
            style={[
              styles.description,
              telugu(description) && styles.descriptionTe,
              { color: colors.ink },
            ]}
          >
            {event.description}
          </Text>
        ) : null}
      </ScrollView>

      {event.isLive ? (
        <View
          testID="event-live-bar"
          style={[
            styles.liveBar,
            {
              backgroundColor: colors.paper,
              borderTopColor: colors.border,
              paddingHorizontal: layout.screenMargin,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <AppButton
            testID="watch-live-button"
            title={t('events.watchOnYouTube')}
            variant="live"
            fullWidth
            leadingIcon="play"
            onPress={handleWatchLive}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  badge: { marginTop: 8, alignItems: 'flex-start' },
  info: { marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
  },
  infoRowRule: { borderTopWidth: 1 },
  infoIcon: { marginTop: 1 },
  infoText: { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' },
  strong: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
  },
  strongTe: { lineHeight: 27 },
  description: {
    marginTop: 18,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 16.5,
    lineHeight: 26,
  },
  descriptionTe: { lineHeight: 31 },
  liveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    borderTopWidth: 1,
  },
});
