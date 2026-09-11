import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import { AnnouncementsList } from '../announcements/AnnouncementsList';
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
} from '../../services/firebase/plans';

const DEFAULT_CHURCH_NAME = 'Bethaniya Ministries';
const DEFAULT_CHURCH_DESCRIPTION = 'A community of faith, worship, and fellowship.';

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
 * Falls back to the exact same default name/description Day 5 hardcoded
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
  onPressNotifications,
}: {
  displayLabel: string;
  onPressNotifications: () => void;
}) {
  const { colors, radii } = useTheme();
  const [settings, setSettings] = useState<ChurchSettings | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChurchSettings(
      (next) => setSettings(next),
      () => setSettings(null)
    );
    return unsubscribe;
  }, []);

  const churchName = settings?.churchName || DEFAULT_CHURCH_NAME;
  const description = settings?.description || DEFAULT_CHURCH_DESCRIPTION;

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
          <Text style={styles.monogramText}>{churchName.charAt(0)}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.greeting, { color: colors.secondaryText }]}>
          Welcome, {displayLabel}
        </Text>
        <Text style={[styles.churchName, { color: colors.text }]}>{churchName}</Text>
        <Text style={[styles.churchDescription, { color: colors.secondaryText }]}>
          {description}
        </Text>
      </View>
      <Pressable
        testID="notifications-nav-button"
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={onPressNotifications}
        style={[
          styles.iconButton,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: radii.control,
          },
        ]}
      >
        <View style={[styles.iconButtonDot, { backgroundColor: colors.primary }]} />
      </Pressable>
    </View>
  );
}

/**
 * Quick-links row -- Songs / Events / Bible / Profile. Replaces the
 * original stack of five identical full-width <Button>s ("Home is a
 * stack of five identical buttons... deserve a tab bar", per the UI
 * audit) with a themed card grid. A real tab bar
 * (@react-navigation/bottom-tabs, a new dependency, or a hand-rolled
 * equivalent) is a bigger navigation-structure change, deliberately left
 * for a follow-up phase; every button below keeps its original testID
 * and navigation target unchanged, so this is a pure visual/layout
 * change over the same five destinations Day 6-9 already wired up.
 */
function QuickLink({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.quickLink,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
        },
      ]}
    >
      <Text style={[styles.quickLinkLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
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
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii } = useTheme();
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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 12 },
      ]}
      testID="home-screen"
    >
      <ChurchBranding
        displayLabel={displayLabel}
        onPressNotifications={() => navigation.navigate('NotificationCenter')}
      />

      {liveEvent ? (
        <Pressable
          testID="home-live-banner"
          accessibilityRole="button"
          onPress={() => navigation.navigate('EventDetail', { event: liveEvent })}
          style={[
            styles.liveBanner,
            { backgroundColor: colors.live, borderRadius: radii.card },
          ]}
        >
          <View style={styles.liveBadgeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE NOW</Text>
          </View>
          <Text style={styles.liveTitle}>{liveEvent.title}</Text>
          <View style={[styles.liveCta, { borderRadius: radii.control }]}>
            <Text style={styles.liveCtaLabel}>Watch live</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Verse of the day"
          actionLabel="See all"
          onAction={() => navigation.navigate('DailyVerse')}
        />
        <DailyVerseCard />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Announcements" />
        <AnnouncementsList />
      </View>

      {activePlan ? (
        <View style={styles.section}>
          <SectionHeader title="Your reading plan" />
          <Pressable
            testID="home-active-plan"
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('PlanDay', {
                plan: activePlan.plan,
                dayNumber: activePlan.progress.currentDay,
              })
            }
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
              {activePlan.plan.title}
            </Text>
            <Text style={[styles.eventMeta, { color: colors.secondaryText }]}>
              Day {activePlan.progress.currentDay} of {activePlan.plan.dayCount}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {nextEvent ? (
        <View style={styles.section}>
          <SectionHeader title="Upcoming events" />
          <Pressable
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
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Explore" />
        <View style={styles.quickLinkGrid}>
          <QuickLink
            label="Songs"
            testID="songs-nav-button"
            onPress={() => navigation.navigate('SongsList')}
          />
          <QuickLink
            label="Events"
            testID="events-nav-button"
            onPress={() => navigation.navigate('EventsList')}
          />
          <QuickLink
            label="Bible"
            testID="bible-nav-button"
            onPress={() => navigation.navigate('BibleBooks')}
          />
          <QuickLink
            label="Reading Plans"
            testID="plans-nav-button"
            onPress={() => navigation.navigate('PlansList')}
          />
          <QuickLink
            label="Prayers"
            testID="prayers-nav-button"
            onPress={() => navigation.navigate('Prayers')}
          />
          <QuickLink
            label="Community"
            testID="community-nav-button"
            onPress={() => navigation.navigate('CommunityList')}
          />
          <QuickLink
            label="Profile"
            testID="profile-nav-button"
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      <Pressable
        testID="sign-out-button"
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={styles.signOutRow}
      >
        <Text style={[styles.signOutLabel, { color: colors.danger }]}>Sign out</Text>
      </Pressable>
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
  monogramText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  greeting: { fontSize: 12.5 },
  churchName: { fontSize: 17, fontWeight: '600' },
  churchDescription: { fontSize: 13, lineHeight: 18 },
  iconButton: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDot: { width: 8, height: 8, borderRadius: 4 },
  liveBanner: { padding: 18, gap: 12 },
  liveBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  liveLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  liveTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '600' },
  liveCta: {
    backgroundColor: '#FFFFFF',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCtaLabel: { color: '#8E2A1F', fontSize: 15, fontWeight: '700' },
  section: { gap: 12 },
  eventRow: { padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  eventTitle: { fontSize: 14.5, fontWeight: '600' },
  eventMeta: { fontSize: 12.5 },
  quickLinkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickLink: {
    flexGrow: 1,
    minWidth: '45%',
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: { fontSize: 14.5, fontWeight: '600' },
  signOutRow: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  signOutLabel: { fontSize: 14, fontWeight: '600' },
});
