import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  subscribeToPublishedEvents,
  type PublishedEvent,
} from '../../services/firebase/events';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  Badge,
  EmptyState,
  ErrorState,
  Icon,
  SkeletonRows,
  Tappable,
  scriptOf,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';
import { EventDateBlock } from './EventDateBlock';
import { eventMeta } from './eventWhen';

type Props = NativeStackScreenProps<RootStackParamList, 'EventsList'>;

/**
 * Published, upcoming-events list. Real-time listener + loading / error /
 * empty / list states, same shape as SongsListScreen.tsx.
 * subscribeToPublishedEvents() already filters to published && startsAt
 * >= now, ordered soonest-first server-side -- this screen just renders
 * whatever it receives, in order. Tapping an event navigates to
 * EventDetail, passing the full event object as a route param (same
 * reasoning as SongDetail's route param -- see AppNavigator.tsx).
 *
 * THE LOOK. A top bar, then one hairline row per event: a small calendar
 * tile (weekday, day, month), the title, and "Wed 14 Oct, 6:30 PM · Main
 * hall" ("Today, 10:30 AM" for one that starts today), with a chevron. An
 * event that is on now is lifted out of the list into a box with a 1.5 red
 * outline, a LIVE NOW badge above its title and a red-tinted tile; the
 * badge is a word as well as a colour.
 */
export function EventsListScreen({ navigation }: Props) {
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<PublishedEvent[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedEvents(
      (next) => {
        setEvents(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, [retryToken]);

  function retry() {
    setHasError(false);
    setEvents(null);
    setRetryToken((token) => token + 1);
  }

  const pad = { paddingHorizontal: layout.screenMargin };

  return (
    <View
      testID="events-screen"
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={pad}>
        <TopBar title={t('events.title')} onBack={() => navigation.goBack()} />
      </View>

      {hasError ? (
        <View style={[pad, styles.state]}>
          <ErrorState
            testID="events-error"
            message={t('events.loadErrorShort')}
            retryLabel={t('common.tryAgain')}
            onRetry={retry}
          />
        </View>
      ) : !events ? (
        <View style={[pad, styles.state]}>
          <SkeletonRows
            count={3}
            leading="thumbnail"
            label={t('common.loading')}
            testID="events-loading"
          />
        </View>
      ) : events.length === 0 ? (
        <View style={[pad, styles.state]}>
          <EmptyState
            testID="events-empty"
            title={t('events.empty')}
            message={t('events.emptyMessage')}
          />
        </View>
      ) : (
        <FlatList
          testID="events-list"
          data={events}
          keyExtractor={(item) => item.id}
          style={styles.state}
          contentContainerStyle={[pad, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => (
            <EventRow
              event={item}
              onPress={() => navigation.navigate('EventDetail', { event: item })}
            />
          )}
        />
      )}
    </View>
  );
}

function EventRow({ event, onPress }: { event: PublishedEvent; onPress: () => void }) {
  const { colors, radii } = useTheme();
  const { t, appLanguage } = useTranslation();
  const meta = eventMeta(event, appLanguage, t('events.today'), t('events.dateTBA'));
  const telugu =
    appLanguage === 'te' || ['telugu', 'mixed'].includes(scriptOf(event.title));

  return (
    <Tappable
      testID={`event-${event.id}`}
      accessibilityRole="button"
      accessibilityLabel={[event.isLive ? t('common.liveNow') : '', event.title, meta]
        .filter(Boolean)
        .join('. ')}
      onPress={onPress}
      style={[
        styles.row,
        event.isLive
          ? [styles.liveRow, { borderColor: colors.live, borderRadius: radii.card }]
          : { borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}
    >
      <EventDateBlock
        testID={`event-${event.id}-date`}
        date={event.startsAt}
        live={event.isLive}
      />
      <View style={styles.text}>
        {event.isLive ? (
          <Badge
            testID={`live-badge-${event.id}`}
            variant="live"
            label={t('common.liveNow')}
          />
        ) : null}
        <Text
          numberOfLines={2}
          style={[styles.title, telugu && styles.titleTe, { color: colors.ink }]}
        >
          {event.title}
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.meta,
            appLanguage === 'te' && styles.metaTe,
            { color: colors.inkMuted },
          ]}
        >
          {meta}
        </Text>
      </View>
      <Icon name="chev" size={20} color={colors.inkSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 88,
    paddingVertical: 14,
  },
  // The live event is lifted out of the list into a box of its own.
  liveRow: { borderWidth: 1.5, paddingHorizontal: 14, marginTop: 4, marginBottom: 8 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 24,
  },
  titleTe: { lineHeight: 29 },
  meta: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  metaTe: { lineHeight: 23 },
});
