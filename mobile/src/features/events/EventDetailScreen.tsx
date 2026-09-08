import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

function formatStartsAt(date: Date | null): string {
  if (!date) return 'Date/time to be announced';
  return date.toLocaleString();
}

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
  const { colors, radii, spacing } = useTheme();

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
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE NOW</Text>
        </View>
      ) : null}

      <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>

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
        <Text style={[styles.meta, { color: colors.text }]}>
          {formatStartsAt(event.startsAt)}
        </Text>
        <Text style={[styles.meta, { color: colors.secondaryText }]}>
          {event.location}
        </Text>
        <Pressable
          testID="open-maps-button"
          accessibilityRole="button"
          onPress={handleOpenMaps}
          style={[
            styles.mapsButton,
            { borderColor: colors.primary, borderRadius: radii.control },
          ]}
        >
          <Text style={[styles.mapsButtonLabel, { color: colors.primary }]}>
            Open in Maps
          </Text>
        </Pressable>
      </View>

      <Text
        style={[styles.description, { color: colors.secondaryText }]}
        testID="event-description"
      >
        {event.description}
      </Text>

      {event.isLive ? (
        <Pressable
          testID="watch-live-button"
          accessibilityRole="button"
          onPress={handleWatchLive}
          style={[
            styles.watchLiveButton,
            { backgroundColor: colors.live, borderRadius: radii.control },
          ]}
        >
          <Text style={styles.watchLiveLabel}>Watch live on YouTube</Text>
        </Pressable>
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
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: { fontSize: 24, fontWeight: '600' },
  infoCard: { borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  meta: { fontSize: 14.5 },
  mapsButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapsButtonLabel: { fontSize: 13.5, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 23, width: '100%' },
  watchLiveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchLiveLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
