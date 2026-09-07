import { Button, Linking, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';

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
 */
export function EventDetailScreen({ route, navigation }: Props) {
  const { event } = route.params;

  function handleOpenMaps() {
    void Linking.openURL(buildMapsSearchUrl(event.location));
  }

  function handleWatchLive() {
    navigation.navigate('YouTubePlayer', { youtubeUrl: event.youtubeUrl });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} testID="event-detail-screen">
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>{formatStartsAt(event.startsAt)}</Text>
      <Text style={styles.meta}>{event.location}</Text>

      <Button title="Open in Maps" onPress={handleOpenMaps} testID="open-maps-button" />

      {event.isLive ? (
        <Button title="WATCH LIVE" onPress={handleWatchLive} testID="watch-live-button" />
      ) : null}

      <Text style={styles.description} testID="event-description">
        {event.description}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  meta: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 22, color: '#111827', width: '100%' },
});
