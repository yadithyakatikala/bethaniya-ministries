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
import { useTheme } from '../../theme';

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
 *
 * Restyled onto the shared Vespers theme, with the LIVE badge as a
 * proper pill (dot + text, matching the audit's "never colour-only"
 * guidance) instead of bare colored text.
 */
export function EventsListScreen({ navigation }: Props) {
  const { colors, radii, spacing } = useTheme();
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
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="events-error"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load events.
        </Text>
      </View>
    );
  }

  if (!events) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="events-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID="events-empty"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          No upcoming events.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="events-list"
      data={events}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.item,
            {
              backgroundColor: colors.surface,
              borderColor: item.isLive ? colors.live : colors.border,
              borderWidth: item.isLive ? 1.5 : StyleSheet.hairlineWidth,
              borderRadius: radii.card,
              padding: spacing.md,
            },
          ]}
          testID={`event-${item.id}`}
          onPress={() => navigation.navigate('EventDetail', { event: item })}
        >
          {item.isLive ? (
            <View
              style={[styles.liveBadge, { backgroundColor: colors.live }]}
              testID={`live-badge-${item.id}`}
            >
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE NOW</Text>
            </View>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.meta, { color: colors.secondaryText }]}>
            {formatStartsAt(item.startsAt)}
          </Text>
          <Text style={[styles.meta, { color: colors.secondaryText }]}>
            {item.location}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  item: { gap: 4 },
  title: { fontWeight: '600', fontSize: 15 },
  meta: { fontSize: 13 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
