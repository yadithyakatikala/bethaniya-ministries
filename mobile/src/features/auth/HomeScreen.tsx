import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { ContinueReading } from '../bible/reader/ContinueReading';
import { DailyVerseCard } from '../daily-verses/DailyVerseCard';
import { ProphetVerseCard } from '../prophet-verses/ProphetVerseCard';
import { HomeHeader } from '../home/HomeHeader';
import { LiveBar } from '../home/LiveBar';
import { ReadingPlanRow } from '../home/ReadingPlanRow';
import { TogetherSection } from '../home/TogetherSection';
import { UpcomingEventRow } from '../home/UpcomingEventRow';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  subscribeToPublishedEvents,
  type PublishedEvent,
} from '../../services/firebase/events';
import {
  subscribeToMostRecentPlanProgress,
  type ActivePlanSummary,
} from '../../services/firebase/plans';

/**
 * Home: "Scripture First". The first screen of the app opens like a page of
 * a Bible -- the date, today's verse set large in the serif, and one gold
 * thread -- and everything else follows in a calm order, each piece one
 * glance and one tap:
 *
 *   header           the mark, "Welcome, {name}", the church's name, Updates
 *   live bar         only while a published event is live -- the one red
 *   Verse of the Day the hero: Read chapter, Share, Copy
 *   continue reading where the member left off (nothing, until they have read)
 *   reading plan     the one progress line on Home
 *   Prophet Verse    a quote block, held to four lines (always present)
 *   upcoming event   the next published event
 *   Together         Prayer requests, Church chat, Photos and videos
 *
 * REAL DATA, REAL EMPTY STATES. Nothing here is a sample. Every piece reads
 * the same live source it always did -- the church's settings, the published
 * events, the member's own plan progress and reading position, the verse
 * resolver, the Prophet Verse -- and a piece with nothing to show either
 * says so (the Prophet Verse, the plan prompt) or is not there (Continue
 * reading, the event row). Whitespace is drawn as margins on the pieces
 * themselves, so a piece that is not there leaves no gap behind it.
 *
 * Rhythm: 20 of margin each side; 32 between pieces, 24 above the plan.
 * A label that carries a "See all" is a 44-high row, so its section takes
 * the 14 above the label out of its own margin -- the gap LOOKS 32.
 *
 * The profile button that used to sit beside Updates is gone from the
 * header: Profile belongs to "You". The five feature tiles are gone too --
 * Together says the same three things in words, and Plans is the plan row.
 *
 * Pull-to-refresh: every piece is already backed by a live Firestore
 * listener (or a resolved-at-mount read), so there is no separate "reload"
 * request to make. The gesture is a brief, honest confirmation (the spinner
 * shows, then clears) rather than a fake refetch pretending to do something
 * the real-time architecture does not need, satisfying "pull-to-refresh to
 * reload content" without pretending.
 */
export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, layout } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<PublishedEvent[] | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeToPublishedEvents(
      (next) => setEvents(next),
      () => setEvents([])
    );
    return unsubscribe;
  }, []);

  const [activePlan, setActivePlan] = useState<ActivePlanSummary | null>(null);
  useEffect(() => {
    // No setState for the signed-out case -- HomeScreen only ever renders
    // post-authentication, so `user` is absent only transiently; see
    // ../prayers/PrayersScreen.tsx's identical comment for why this
    // avoids react-hooks/set-state-in-effect.
    if (!user?.uid) return;
    const unsubscribe = subscribeToMostRecentPlanProgress(
      user.uid,
      (next) => setActivePlan(next),
      () => setActivePlan(null)
    );
    return unsubscribe;
  }, [user?.uid]);

  const liveEvent = events?.find((event) => event.isLive) ?? null;
  const nextEvent = events?.find((event) => !event.isLive) ?? null;

  // The final fallback is a WORD rather than a name, so it is translated:
  // a Telugu interface should not greet the member in English.
  const displayLabel =
    user?.displayName || user?.email || user?.phoneNumber || t('common.member');

  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), 400);
  }, []);
  // Cleared on unmount, so a pull immediately followed by a tab switch
  // doesn't leave a timer running against a screen that is gone.
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    []
  );

  const openChapter = useCallback(
    (bookId: string, chapterNumber: number, verse: number) =>
      navigation.navigate('BibleChapter', { bookId, chapterNumber, verse }),
    [navigation]
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top, paddingHorizontal: layout.screenMargin },
      ]}
      testID="home-screen"
      refreshControl={
        <RefreshControl
          testID="home-refresh-control"
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <HomeHeader
        displayLabel={displayLabel}
        onPressUpdates={() => navigation.navigate('Announcements')}
      />

      {liveEvent ? (
        <View style={styles.live}>
          <LiveBar
            title={liveEvent.title}
            onPress={() => navigation.navigate('EventDetail', { event: liveEvent })}
          />
        </View>
      ) : null}

      <DailyVerseCard
        onSeeAll={() => navigation.navigate('DailyVerse')}
        onReadChapter={(place) => openChapter(place.bookId, place.chapter, place.verse)}
      />

      <ContinueReading style={styles.afterVerse} onOpen={openChapter} />

      <ReadingPlanRow
        style={styles.plan}
        activePlan={activePlan}
        onContinue={(plan, dayNumber) =>
          navigation.navigate('PlanDay', { plan, dayNumber })
        }
        onBrowse={() => navigation.navigate('PlansList')}
      />

      <View style={styles.section}>
        <ProphetVerseCard />
      </View>

      {nextEvent ? (
        <View style={styles.sectionWithAction}>
          <SectionHeader
            title={t('home.upcomingEvents')}
            actionLabel={t('common.seeAll')}
            onAction={() => navigation.navigate('EventsList')}
            actionTestID="home-events-see-all"
          />
          <UpcomingEventRow
            event={nextEvent}
            onPress={() => navigation.navigate('EventDetail', { event: nextEvent })}
          />
        </View>
      ) : null}

      <TogetherSection
        style={styles.section}
        onOpenPrayers={() => navigation.navigate('PrayerWall')}
        onOpenChat={() => navigation.navigate('CommunityChat')}
        onOpenMedia={() => navigation.navigate('MediaFeed')}
      />
    </ScrollView>
  );
}

// 32 between pieces; 24 above the plan row; 4 and 6 around the live bar.
const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32 },
  live: { marginTop: 4, marginBottom: 6 },
  afterVerse: { marginTop: 32 },
  plan: { marginTop: 24 },
  section: { marginTop: 32 },
  // 32, less the 14 of air above a label centred in its 44-high row.
  sectionWithAction: { marginTop: 18 },
});
