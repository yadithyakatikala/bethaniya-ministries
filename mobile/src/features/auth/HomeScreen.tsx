import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
// The church's own name is admin-configured content in Firestore; this is
// only the fallback for a deployment that has never saved settings.
import { DEFAULT_CHURCH_NAME } from '../../theme/brand';
import { useTranslation } from '../../i18n';
import { Tappable } from '../../theme/ui/Tappable';
import {
  AnnouncementIcon,
  PeopleIcon,
  PersonIcon,
  PlanIcon,
  PrayerIcon,
} from '../../theme/ui/FeatureIcons';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { DailyVerseCard } from '../daily-verses/DailyVerseCard';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  subscribeToChurchSettings,
  type ChurchSettings,
} from '../../services/firebase/settings';
import {
  subscribeToPublishedEvents,
  type PublishedEvent,
} from '../../services/firebase/events';
import {
  subscribeToMostRecentPlanProgress,
  type ActivePlanSummary,
  type PublishedPlan,
} from '../../services/firebase/plans';

/**
 * Church branding block -- Day 5 built this static/hardcoded ("the admin
 * Settings page... is explicitly Day 13 scope... Replace this with real
 * data once Day 13 exists"). Day 13 does exactly that: it now reads the
 * real /settings/church document via subscribeToChurchSettings (see
 * ../../services/firebase/settings.ts), per
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 13 plan ("Mobile app
 * displays updated church info") and P0 feature #17 ("Save button
 * (syncs to mobile app display)").
 *
 * Falls back to the exact same default name Day 5 hardcoded
 * whenever no settings document has ever been saved (a brand-new
 * deployment before any Super Admin has visited
 * admin/src/features/settings/SettingsPage.tsx), while the very first
 * snapshot is still in flight, or on a read error -- there is
 * deliberately no separate loading/error UI for this decorative header
 * block; a sensible default is friendlier than a spinner or error
 * message for something this low-stakes, and firestore.rules' settings
 * read rule (isSignedIn()) never denies a signed-in member anyway (see
 * ../../services/firebase/settings.ts's doc comment). The logo only
 * renders once a settings document with a non-empty logoUrl has actually
 * loaded -- there is no default/placeholder logo image.
 *
 * Visually restyled for the "Vespers" design system (see
 * mobile/src/theme/) -- a branded header row (logo or an evergreen
 * monogram fallback, church name, greeting) instead of a plain stacked
 * title, but the settings subscription and its testID/text contract are
 * unchanged.
 */
function ChurchBranding({
  displayLabel,
  onPressProfile,
  onPressAnnouncements,
}: {
  displayLabel: string;
  onPressProfile: () => void;
  onPressAnnouncements: () => void;
}) {
  const { colors, radii } = useTheme();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ChurchSettings | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChurchSettings(
      (next) => setSettings(next),
      () => setSettings(null)
    );
    return unsubscribe;
  }, []);

  const churchName = settings?.churchName || DEFAULT_CHURCH_NAME;

  return (
    <View style={styles.brandingRow} testID="church-branding">
      {settings?.logoUrl ? (
        <Image
          source={{ uri: settings.logoUrl }}
          style={[styles.logo, { borderRadius: radii.control }]}
          testID="church-logo"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.monogram,
            { backgroundColor: colors.primary, borderRadius: radii.control },
          ]}
        >
          <Text style={[styles.monogramText, { color: colors.onPrimary }]}>
            {churchName.charAt(0)}
          </Text>
        </View>
      )}
      <View style={styles.brandingText}>
        <Text style={[styles.greeting, { color: colors.secondaryText }]}>
          {t('home.welcome')}, {displayLabel}
        </Text>
        <Text style={[styles.churchName, { color: colors.text }]} numberOfLines={2}>
          {churchName}
        </Text>
        {/* The church description used to render here as a third line
            ("A community of faith, worship, and fellowship."). Removed at
            the owner's request: the header reads cleaner as greeting +
            church name, and the description is still stored and editable
            in the admin Settings page -- it is simply not shown on Home.
            `settings.description` is therefore no longer read here. */}
      </View>

      {/* Permanent utility area. Two distinct destinations, two distinct
          icons -- see ../../theme/ui/FeatureIcons.tsx on why Announcements
          is a speech bubble rather than the Notifications bell. */}
      <View style={styles.utilityRow}>
        <UtilityButton
          testID="profile-nav-button"
          label={t('home.profileLabel')}
          hint={t('home.profileHint')}
          onPress={onPressProfile}
        >
          <PersonIcon color={colors.ink} size={20} />
        </UtilityButton>
        <UtilityButton
          testID="announcements-nav-button"
          label={t('home.announcementsLabel')}
          hint={t('home.announcementsHint')}
          onPress={onPressAnnouncements}
        >
          <AnnouncementIcon color={colors.ink} size={20} />
        </UtilityButton>
      </View>
    </View>
  );
}

/**
 * One of Home's top-right utility buttons.
 *
 * The control this replaces was an 8px dot in `colors.primary` on the
 * paper background -- the "almost invisible dot" the tester reported. A
 * utility button needs three things to read as a button in both themes:
 * a `colors.surface` fill that separates it from the paper behind it, a
 * `colors.border` outline for when surface and paper are close in
 * luminance, and a `colors.ink` glyph. All three are tokens, so the
 * contrast holds in light and dark without painting anything white.
 */
function UtilityButton({
  testID,
  label,
  hint,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  hint: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors, radii } = useTheme();
  return (
    <Tappable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={[
        styles.utilityButton,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.control,
        },
      ]}
    >
      {children}
    </Tappable>
  );
}

/**
 * The reading-plan progress card -- the ONLY place on Home that shows a
 * percentage or a progress bar.
 *
 * Reads the EXISTING plan state: `subscribeToMostRecentPlanProgress`
 * already returns the member's active plan together with its
 * `PlanProgress` (startedAt, currentDay, completedDays, lastReadAt) --
 * see ../../services/firebase/plans.ts. Nothing here stores or derives a
 * second copy of that progress, and nothing is persisted from this
 * screen.
 *
 * Progress is computed from `completedDays.length / plan.dayCount`, not
 * from `currentDay`: a member can complete days out of order, and
 * "8 of 30 days done" is the honest number. `currentDay` is what the
 * Continue action opens, which is a different question.
 *
 * With no active plan it shows a compact prompt and opens the Plans list.
 * It never shows a zeroed-out bar or an invented percentage.
 */
function ReadingPlanCard({
  activePlan,
  onContinue,
  onBrowse,
}: {
  activePlan: ActivePlanSummary | null;
  onContinue: (plan: PublishedPlan, dayNumber: number) => void;
  onBrowse: () => void;
}) {
  const { colors, radii } = useTheme();
  const { t } = useTranslation();

  if (!activePlan) {
    return (
      <Tappable
        testID="home-plan-empty"
        accessibilityRole="button"
        accessibilityLabel={t('home.startAPlan')}
        onPress={onBrowse}
        style={[
          styles.planCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
          },
        ]}
      >
        <Text style={[styles.planEmptyLabel, { color: colors.primary }]}>
          {t('home.startAPlan')}
        </Text>
      </Tappable>
    );
  }

  const { plan, progress } = activePlan;
  const total = Math.max(1, plan.dayCount);
  const done = progress.completedDays.length;
  // Clamped: a plan whose dayCount was edited down after a member
  // completed days should not render a bar wider than the track.
  const fraction = Math.min(1, Math.max(0, done / total));
  const percent = Math.round(fraction * 100);

  return (
    <Tappable
      testID="home-active-plan"
      accessibilityRole="button"
      accessibilityLabel={`${plan.title}. ${t('home.dayOf', {
        current: progress.currentDay,
        total: plan.dayCount,
      })}. ${percent}%`}
      onPress={() => onContinue(plan, progress.currentDay)}
      style={[
        styles.planCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
        },
      ]}
    >
      <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={2}>
        {plan.title}
      </Text>
      <Text style={[styles.planMeta, { color: colors.secondaryText }]}>
        {t('home.dayOf', { current: progress.currentDay, total: plan.dayCount })}
      </Text>

      <View style={styles.planProgressRow}>
        <View
          testID="home-plan-progress-track"
          style={[styles.planTrack, { backgroundColor: colors.border }]}
        >
          <View
            testID="home-plan-progress-fill"
            style={[
              styles.planFill,
              { width: `${percent}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        <Text
          testID="home-plan-percent"
          style={[styles.planPercent, { color: colors.secondaryText }]}
        >
          {t('home.percentComplete', { percent })}
        </Text>
      </View>

      <Text style={[styles.planContinue, { color: colors.primary }]}>
        {t('plans.continue')}
      </Text>
    </Tappable>
  );
}

/**
 * A compact icon tile -- Prayers, Reading Plans, Community.
 *
 * Deliberately NOT a content card and NOT a settings row: these are
 * feature shortcuts, so they get a square glyph over a short label and
 * carry no description, no progress and no data. Only
 * ReadingPlanCard above shows progress.
 *
 * These three are the secondary features the bottom tab bar does NOT
 * cover (the bar is Home/Bible/Songs/Events/More), so surfacing them is
 * discovery rather than the duplicate navigation the tester objected to.
 * Each also remains reachable under More.
 */
function FeatureTile({
  testID,
  label,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors, radii } = useTheme();
  return (
    <View style={styles.tileColumn}>
      <Tappable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[
          styles.tile,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.sheet,
          },
        ]}
      >
        {children}
      </Tappable>
      <Text style={[styles.tileLabel, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Authenticated home screen. Day 2 proved the authenticated state renders
 * and sign-out works; Day 4 added the real-time announcements section
 * (AnnouncementsList). Day 5 adds church branding (see ChurchBranding
 * above -- settings-driven since Day 13) and the daily verse card
 * (DailyVerseCard), per the spec's "Home screen UI (church branding +
 * daily verse card + announcements list)" plan item. Day 6 adds a
 * "Songs" entry point into the real navigation introduced this day (see
 * AppNavigator.tsx) -- HomeScreen is itself the "Home" screen registered
 * in that stack, so `useNavigation()` is how it reaches "SongsList"
 * rather than a prop. Tap-to-detail navigation for announcements is
 * later scope and still not built here. Day 7 adds an "Events" entry
 * point the same way. Day 8 adds a "Bible" entry point identically, into
 * BibleBooks. Day 9/10 add "Profile" and "Notifications" entry points
 * the same way -- Settings is reached from Profile (not from Home
 * directly) and Bible Search is reached from the Bible books list (not
 * from Home directly either), per the decision to keep Home from
 * accumulating an entry point for every new screen.
 *
 * Restyled for the approved "Vespers" direction (see the UI audit and
 * its follow-up visual prototype): a live banner when a published event
 * is currently live, reusing the same subscribeToPublishedEvents()
 * EventsListScreen already relies on (see
 * ../../services/firebase/events.ts) rather than a new query shape, and
 * a themed quick-links grid in place of the plain button stack. Every
 * existing testID, navigation target, and visible "Welcome, ..." /
 * church-name/description text is unchanged -- see
 * __tests__/HomeScreen.test.tsx.
 */
export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii } = useTheme();
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

  const displayLabel = user?.displayName || user?.email || user?.phoneNumber || 'Member';

  // Pull-to-refresh: every section on this screen is already backed by a
  // live Firestore onSnapshot listener (see the subscriptions above and in
  // AnnouncementsList/DailyVerseCard/ChurchBranding), so there's no separate
  // "reload" request to make -- content is already as current as the
  // server. This is deliberately a brief, honest confirmatory gesture (the
  // spinner shows, then clears) rather than a fake refetch pretending to
  // do something the real-time architecture doesn't need, satisfying the
  // spec's "pull-to-refresh to reload content" without pretending.
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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 12 },
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
      <ChurchBranding
        displayLabel={displayLabel}
        onPressProfile={() => navigation.navigate('Profile')}
        onPressAnnouncements={() => navigation.navigate('Announcements')}
      />

      {liveEvent ? (
        <Tappable
          testID="home-live-banner"
          accessibilityRole="button"
          onPress={() => navigation.navigate('EventDetail', { event: liveEvent })}
          style={[
            styles.liveBanner,
            { backgroundColor: colors.live, borderRadius: radii.card },
          ]}
        >
          <View style={styles.liveBadgeRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.onLive }]} />
            <Text style={[styles.liveLabel, { color: colors.onLive }]}>
              {t('home.liveNow')}
            </Text>
          </View>
          <Text style={[styles.liveTitle, { color: colors.onLive }]}>
            {liveEvent.title}
          </Text>
          <View
            style={[
              styles.liveCta,
              { borderRadius: radii.control, backgroundColor: colors.onLive },
            ]}
          >
            <Text style={[styles.liveCtaLabel, { color: colors.live }]}>
              {t('home.watchLive')}
            </Text>
          </View>
        </Tappable>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title={t('home.verseOfTheDay')}
          actionLabel={t('common.seeAll')}
          onAction={() => navigation.navigate('DailyVerse')}
        />
        <DailyVerseCard />
      </View>

      {/* The ANNOUNCEMENTS content block that used to sit here is gone.
          It occupied the middle of Home with a permanent "No
          announcements yet." even when there was nothing to show. The
          feature is unchanged -- the Firestore collection, the admin
          screens and AnnouncementsList itself are all intact; the entry
          point is now the permanent icon in the header above, which opens
          ../announcements/AnnouncementsScreen.tsx. */}

      <View style={styles.section}>
        <SectionHeader title={t('home.readingPlan')} />
        <ReadingPlanCard
          activePlan={activePlan}
          onContinue={(plan, dayNumber) =>
            navigation.navigate('PlanDay', { plan, dayNumber })
          }
          onBrowse={() => navigation.navigate('PlansList')}
        />
      </View>

      {nextEvent ? (
        <View style={styles.section}>
          <SectionHeader title={t('home.upcomingEvents')} />
          <Tappable
            testID="home-next-event"
            accessibilityRole="button"
            onPress={() => navigation.navigate('EventDetail', { event: nextEvent })}
            style={[
              styles.eventRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[styles.eventTitle, { color: colors.text }]}>
              {nextEvent.title}
            </Text>
            {nextEvent.location ? (
              <Text style={[styles.eventMeta, { color: colors.secondaryText }]}>
                {nextEvent.location}
              </Text>
            ) : null}
          </Tappable>
        </View>
      ) : null}

      {/* Compact icon tiles, NOT content cards: the three secondary
          features the bottom tab bar does not cover. Songs / Bible /
          Events / Profile are deliberately absent -- the first three are
          tabs and Profile is the header icon above. */}
      <View style={styles.tileRow} testID="home-feature-tiles">
        <FeatureTile
          testID="prayers-nav-button"
          label={t('more.prayers')}
          onPress={() => navigation.navigate('Prayers')}
        >
          <PrayerIcon color={colors.primary} size={26} />
        </FeatureTile>
        <FeatureTile
          testID="plans-nav-button"
          label={t('more.readingPlans')}
          onPress={() => navigation.navigate('PlansList')}
        >
          <PlanIcon color={colors.primary} size={26} />
        </FeatureTile>
        <FeatureTile
          testID="community-nav-button"
          label={t('more.community')}
          onPress={() => navigation.navigate('CommunityList')}
        >
          <PeopleIcon color={colors.primary} size={26} />
        </FeatureTile>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    gap: 22,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  logo: { width: 44, height: 44 },
  monogram: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontSize: 18, fontWeight: '600' },
  greeting: { fontSize: 12.5 },
  churchName: { fontSize: 17, fontWeight: '600' },
  brandingText: { flex: 1, gap: 2 },

  // Home's top-right utility area. Two buttons, each at the 44dp
  // accessibility minimum, which also matches the 44x44 logo/monogram at
  // the other end of the row.
  utilityRow: { flexDirection: 'row', gap: 8 },
  utilityButton: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // The reading-plan card -- the only progress UI on Home.
  planCard: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  planTitle: { fontSize: 16, fontWeight: '600' },
  planMeta: { fontSize: 12.5 },
  planProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  planTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  planFill: { height: 6, borderRadius: 3 },
  planPercent: { fontSize: 12.5, fontWeight: '600', minWidth: 38, textAlign: 'right' },
  planContinue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  planEmptyLabel: { fontSize: 15, fontWeight: '600', textAlign: 'center' },

  // Compact icon tiles. Square with a large radius, sized so three fit a
  // narrow phone comfortably; the label sits OUTSIDE the tile so the
  // glyph stays the whole of the tappable square.
  tileRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  tileColumn: { flex: 1, alignItems: 'center', gap: 8 },
  tile: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 78,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  liveBanner: { padding: 18, gap: 12 },
  liveBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  liveTitle: { fontSize: 21, fontWeight: '600' },
  liveCta: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCtaLabel: { fontSize: 15, fontWeight: '700' },
  section: { gap: 12 },
  eventRow: { padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  eventTitle: { fontSize: 14.5, fontWeight: '600' },
  eventMeta: { fontSize: 12.5 },
});
