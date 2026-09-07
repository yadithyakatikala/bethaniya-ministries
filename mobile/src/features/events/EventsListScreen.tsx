import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  subscribeToPublishedEvents,
  type PublishedEvent,
} from '../../services/firebase/events';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EventsList'>;

function formatStartsAt(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleString();
}

/**
 * Published, upcoming-events list -- Day 7 scope. Real-time listener +
 * loading/error/empty/list states, same shape as SongsListScreen.tsx.
 * subscribeToPublishedEvents() already filters to published && startsAt
 * >= now, ordered soonest-first server-side -- this screen just renders
 * whatever it receives, in order. Tapping an event navigates to
 * EventDetail, passing the full event object as a route param (same
 * reasoning as SongDetail's route param -- see AppNavigator.tsx).
 */
export function EventsListScreen({ navigation }: Props) {
  const [events, setEvents] = useState<PublishedEvent[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedEvents(
      (next) => {
        setEvents(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, []);

  if (hasError) {
    return (
      <View style={styles.container} testID="events-error">
        <Text style={styles.message}>Could not load events.</Text>
      </View>
    );
  }

  if (!events) {
    return (
      <View style={styles.container} testID="events-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.container} testID="events-empty">
        <Text style={styles.message}>No upcoming events.</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="events-list"
      data={events}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          testID={`event-${item.id}`}
          onPress={() => navigation.navigate('EventDetail', { event: item })}
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{formatStartsAt(item.startsAt)}</Text>
          <Text style={styles.meta}>{item.location}</Text>
          {item.isLive ? (
            <Text style={styles.liveBadge} testID={`live-badge-${item.id}`}>
              LIVE NOW
            </Text>
          ) : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { color: '#666', textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  item: {
    padding: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  title: { fontWeight: '600', fontSize: 15 },
  meta: { color: '#374151', fontSize: 13 },
  liveBadge: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
});
