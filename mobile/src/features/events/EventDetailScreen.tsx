import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatDateTime } from '../../i18n/locale';
import { Tappable } from '../../theme/ui/Tappable';

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
 * "Open in Maps" button (Linking.openURL only, no map SDK), and a "WATCH
 * LIVE" button that only appears when the event is actually live
 * (event.isLive === true) -- this is a real-time field from the
 * subscription, not a static flag, so the button appears/disappears live
 * as a Host starts/ends the stream from the admin Live Stream Manager.
 *
 * Restyled onto the shared Vespers theme: a LIVE badge above the title
 * when live, themed info rows, and the live CTA promoted to a full-width
 * red button matching the approved prototype. Same testID/behavior
 * contract as before -- see EventDetailScreen.test.tsx.
 */
export function EventDetailScreen({ route, navigation }: Props) {
  const { event } = route.params;
  const { colors, radii, spacing, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  /** The app language decides the date format; the device's locale does not. */
  const startsAt = event.startsAt
    ? formatDateTime(event.startsAt, appLanguage)
    : t('events.dateTBA');

  function handleOpenMaps() {
    void Linking.openURL(buildMapsSearchUrl(event.location));
  }

  function handleWatchLive() {
    navigation.navigate('YouTubePlayer', { youtubeUrl: event.youtubeUrl });
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="event-detail-screen"
    >
      {event.isLive ? (
        <View style={[styles.liveBadge, { backgroundColor: colors.live }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.onLive }]} />
          <Text style={[type.overline, { color: colors.onLive }]}>{t('common.liveNow')}</Text>
        </View>
      ) : null}

      <Text style={[type.headline, { color: colors.text }]}>{event.title}</Text>

      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.lg,
          },
        ]}
      >
        <Text style={[type.body, { color: colors.text }]}>
          {startsAt}
        </Text>
        <Text style={[type.body, { color: colors.secondaryText }]}>
          {event.location}
        </Text>
        <Tappable
          testID="open-maps-button"
          accessibilityRole="button"
          onPress={handleOpenMaps}
          style={[
            styles.mapsButton,
            { borderColor: colors.primary, borderRadius: radii.control },
          ]}
        >
          <Text style={[type.label, { color: colors.primary }]}>
            {t('events.openInMaps')}
          </Text>
        </Tappable>
      </View>

      <Text
        style={[type.body, styles.description, { color: colors.secondaryText }]}
        testID="event-description"
      >
        {event.description}
      </Text>

      {event.isLive ? (
        <Tappable
          testID="watch-live-button"
          accessibilityRole="button"
          onPress={handleWatchLive}
          style={[
            styles.watchLiveButton,
            { backgroundColor: colors.live, borderRadius: radii.control },
          ]}
        >
          <Text style={[type.label, { color: colors.onLive }]}>
            {t('events.watchOnYouTube')}
          </Text>
        </Tappable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  infoCard: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  mapsButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { width: '100%' },
  watchLiveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
