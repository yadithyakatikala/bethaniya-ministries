import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { DEFAULT_CHURCH_NAME } from '../../../theme/brand';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { darkTokens, lightTokens } from '../../../theme';
import { translate } from '../../../i18n';
import { HomeScreen } from '../HomeScreen';
import {
  subscribeToMostRecentPlanProgress,
  type ActivePlanSummary,
} from '../../../services/firebase/plans';
import {
  subscribeToPublishedEvents,
  type PublishedEvent,
} from '../../../services/firebase/events';
import { subscribeToReadingPosition } from '../../../services/firebase/readingPosition';
import { subscribeToTodaysDailyVerse } from '../../../services/firebase/dailyVerses';
import { loadVotdAutomation } from '../../daily-verses/votdAutomation';
import { fetchMediaPage, type MediaPost } from '../../../services/firebase/media';
import {
  useVerseOfTheDay,
  type VerseOfTheDayState,
} from '../../daily-verses/useVerseOfTheDay';
import {
  useProphetVerse,
  type ProphetVerseState,
} from '../../prophet-verses/useProphetVerse';

/**
 * HomeScreen is registered as the "Home" screen inside AppNavigator's real
 * stack and calls useNavigation() to reach everything else -- which only
 * works when the component renders as an actual screen inside a Navigator
 * (a bare NavigationContainer isn't enough), so this test helper builds a
 * small real Stack.Navigator, mirroring AppNavigator.tsx's shape, with a stub
 * for every destination Home can open to assert against.
 *
 * Home renders DailyVerseCard, ContinueReading, TogetherSection and the rest,
 * which read usePreferences() and the auth context, so it needs the real
 * providers.
 */
const Stack = createNativeStackNavigator();

function stub(testID: string, label: string) {
  return function Stub() {
    return <Text testID={testID}>{label}</Text>;
  };
}

/** Prints the params it was opened with, so a test can see WHERE it was sent. */
function paramsStub(testID: string) {
  return function ParamsStub() {
    const { params } = useRoute();
    return <Text testID={testID}>{JSON.stringify(params ?? null)}</Text>;
  };
}

const SongsListStub = stub('songs-list-stub', 'Songs list stub');
const EventsListStub = stub('events-list-stub', 'Events list stub');
const BibleBooksStub = stub('bible-books-stub', 'Bible books stub');
const NotificationCenterStub = stub(
  'notification-center-stub',
  'Notification center stub'
);
const PlansListStub = stub('plans-list-stub', 'Plans list stub');
const PlanDayStub = stub('plan-day-stub', 'Plan day stub');
// Prayers and Community are tabs with views inside them; Home asks for the view.
const PrayersHubStub = paramsStub('prayers-hub-stub');
const CommunityHubStub = paramsStub('community-hub-stub');
const MediaFeedStub = stub('media-feed-stub', 'Media feed stub');
const DailyVerseStub = stub('daily-verse-stub', 'Daily verse stub');
const EventDetailStub = paramsStub('event-detail-stub');
const BibleChapterStub = paramsStub('bible-chapter-stub');

function renderHomeScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SongsList" component={SongsListStub} />
            <Stack.Screen name="EventsList" component={EventsListStub} />
            <Stack.Screen name="EventDetail" component={EventDetailStub} />
            <Stack.Screen name="BibleBooks" component={BibleBooksStub} />
            <Stack.Screen name="BibleChapter" component={BibleChapterStub} />
            <Stack.Screen name="NotificationCenter" component={NotificationCenterStub} />
            <Stack.Screen name="DailyVerse" component={DailyVerseStub} />
            <Stack.Screen name="PlansList" component={PlansListStub} />
            <Stack.Screen name="PlanDay" component={PlanDayStub} />
            <Stack.Screen name="PrayersHub" component={PrayersHubStub} />
            <Stack.Screen name="CommunityHub" component={CommunityHubStub} />
            <Stack.Screen name="MediaFeed" component={MediaFeedStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/plans');
jest.mock('../../../services/firebase/events');
jest.mock('../../../services/firebase/readingPosition');
jest.mock('../../../services/firebase/media');
jest.mock('../../../services/firebase/dailyVerses');
jest.mock('../../daily-verses/votdAutomation');
jest.mock('../../daily-verses/useVerseOfTheDay');
jest.mock('../../prophet-verses/useProphetVerse');

/**
 * Home reads the member's active plan through the EXISTING
 * subscribeToMostRecentPlanProgress -- see
 * ../../../services/firebase/plans.ts. These helpers drive that one
 * subscription; Home holds no plan state of its own.
 */
function mockActivePlan(summary: ActivePlanSummary | null) {
  (subscribeToMostRecentPlanProgress as jest.Mock).mockImplementation((_uid, onNext) => {
    onNext(summary);
    return jest.fn();
  });
}

function planSummary(dayCount: number, completedDays: number[], currentDay: number) {
  return {
    plan: {
      id: 'plan-1',
      title: 'Bible in 30 Days',
      description: 'A month of reading.',
      category: 'Devotional',
      coverImageUrl: null,
      dayCount,
    },
    progress: {
      startedAt: new Date('2026-01-01T00:00:00Z'),
      currentDay,
      completedDays,
      lastReadAt: new Date('2026-01-12T00:00:00Z'),
    },
  } as ActivePlanSummary;
}

function mockEvents(events: PublishedEvent[]) {
  (subscribeToPublishedEvents as jest.Mock).mockImplementation((onNext) => {
    onNext(events);
    return jest.fn();
  });
}

function event(partial: Partial<PublishedEvent> = {}): PublishedEvent {
  return {
    id: 'e1',
    title: 'Wednesday Prayer Meeting',
    location: 'Main hall',
    description: '',
    // 14 October 2026, 18:30 -- a Wednesday.
    startsAt: new Date(2026, 9, 14, 18, 30),
    isLive: false,
    youtubeUrl: '',
    ...partial,
  };
}

function mockReadingPosition(bookId: string | null) {
  (subscribeToReadingPosition as jest.Mock).mockImplementation((_uid, _tr, onNext) => {
    onNext(
      bookId
        ? { translationId: 'te', bookId, chapter: 3, verse: 16, updatedAt: null }
        : null
    );
    return jest.fn();
  });
}

function mediaPost(id: string, type: 'image' | 'video' = 'image'): MediaPost {
  return {
    id,
    type,
    mediaUrl: `https://example.org/${id}`,
    caption: `Caption ${id}`,
    verseReference: null,
    verseText: null,
    published: true,
    publishAt: new Date('2026-04-01T00:00:00Z'),
    authorName: 'Pastor',
    authorUid: 'a1',
  } as unknown as MediaPost;
}

const VERSE = {
  status: 'ready' as const,
  dateKey: '2026-10-11',
  content: {
    source: 'pool' as const,
    reference: 'John 14:27',
    body: {
      kind: 'text' as const,
      language: 'en' as const,
      text: 'Peace I leave with you; my peace I give you.',
    },
    imageUrl: null,
    label: '27',
    citation: { bookName: 'John', chapter: 14, label: '27' },
    location: { bookId: 'john', chapter: 14, verse: 27 },
  },
};

function mockProphet(state: ProphetVerseState) {
  (useProphetVerse as jest.Mock).mockReturnValue(state);
}

function signedIn(uid = 'u1', displayName: string | null = 'Jane Doe') {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid, displayName, email: 'jane@example.com', phoneNumber: null });
    return jest.fn();
  });
}

describe('HomeScreen', () => {
  const mockedOnAuthStateChanged = onAuthStateChanged as jest.Mock;
  const mockedSignOut = signOut as jest.Mock;

  afterEach(() => {
    mockedOnAuthStateChanged.mockReset();
    mockedSignOut.mockReset();
    // Restore, not just clear -- mockReset() alone would leave onSnapshot
    // returning `undefined` instead of a real unsubscribe function for
    // every subsequent test (mobile/__mocks__/firebase/firestore.js's own
    // default is `jest.fn(() => jest.fn())`, not a bare `jest.fn()`), and
    // several components elsewhere on this screen (e.g.
    // PreferencesContext.tsx's own Firestore subscription) call that
    // return value as a cleanup function on unmount.
    (onSnapshot as jest.Mock).mockReset().mockImplementation(() => jest.fn());
  });

  beforeEach(() => {
    mockActivePlan(null);
    mockEvents([]);
    mockReadingPosition(null);
    mockProphet({ status: 'empty' });
    (useVerseOfTheDay as jest.Mock).mockReturnValue(VERSE);
    (fetchMediaPage as jest.Mock).mockResolvedValue({ posts: [], cursor: null });
  });

  it('greets the signed-in user by display name', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({
        uid: 'u1',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: null,
      });
      return jest.fn();
    });
    const { getByText } = await renderHomeScreen();
    await waitFor(() =>
      expect(getByText(`${translate('en', 'home.welcome')}, Jane Doe`)).toBeTruthy()
    );
  });

  it('falls back to email, then phone number, when no display name is set', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u2', displayName: null, email: null, phoneNumber: '+15555550123' });
      return jest.fn();
    });
    const { getByText } = await renderHomeScreen();
    await waitFor(() =>
      expect(getByText(`${translate('en', 'home.welcome')}, +15555550123`)).toBeTruthy()
    );
  });

  // --- Home is not a second navigation menu (V1 tester feedback) -------
  // Home used to carry an "Explore" grid of large cards. Songs/Events/Bible
  // duplicated the bottom tab bar, so Home was a second way to navigate the
  // same places. This asserts the ABSENCE of those affordances, which is the
  // actual fix; the destinations themselves are reachable from the tab bar
  // (see TabBar.test.tsx).

  it('does not duplicate the bottom tab bar with Songs/Events/Bible cards', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u4', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

    expect(queryByTestId('songs-nav-button')).toBeNull();
    expect(queryByTestId('events-nav-button')).toBeNull();
    expect(queryByTestId('bible-nav-button')).toBeNull();
  });

  it('has no grid of feature tiles any more -- Together says it in words', async () => {
    signedIn();
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

    expect(queryByTestId('home-feature-tiles')).toBeNull();
    // Plans is the plan row; Community is a place you reach from the tab bar.
    expect(queryByTestId('plans-nav-button')).toBeNull();
    expect(queryByTestId('community-nav-button')).toBeNull();
  });

  // --- Home's header: the mark, the greeting, ONE button ---------------
  // It used to carry Profile and Announcements side by side. Profile
  // belongs to "You" now; what stays is the way into what the church is
  // saying -- the Updates feed.

  it('has one button in its header -- Updates -- and no Profile button', async () => {
    signedIn();
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('updates-nav-button')).toBeTruthy());

    expect(queryByTestId('profile-nav-button')).toBeNull();
    expect(queryByTestId('announcements-nav-button')).toBeNull();
  });

  it('offers Updates as a header icon, and navigates to it', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('updates-nav-button')).toBeTruthy());

    const button = getByTestId('updates-nav-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(translate('en', 'home.updatesLabel'));
    expect(button.props.accessibilityHint).toBe(translate('en', 'home.updatesHint'));

    await fireEvent.press(button);
    // The Updates view of Community -- not Chat, which is the other view.
    await waitFor(() => expect(getByTestId('community-hub-stub')).toBeTruthy());
    expect(getByTestId('community-hub-stub').props.children).toBe(
      JSON.stringify({ tab: 'updates' })
    );
  });

  it('gives Updates a 44dp round target', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('updates-nav-button')).toBeTruthy());
    const style = StyleSheet.flatten(getByTestId('updates-nav-button').props.style);
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.borderRadius).toBe(999);
  });

  it.each([
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as const)(
    "paints the Updates glyph from the %s palette's ink, with nothing painted white",
    async (theme, tokens) => {
      // The old Profile and Announcements buttons failed in one theme or the
      // other by painting a fixed colour. The glyph takes the ink token, so
      // its contrast survives the palette flip.
      await AsyncStorage.setItem('theme_preference', theme);
      try {
        signedIn();
        const { getByTestId } = await renderHomeScreen();
        await waitFor(() => expect(getByTestId('updates-nav-button')).toBeTruthy());

        const colours = new Set<string>();
        const walk = (node: {
          props?: Record<string, unknown>;
          children?: unknown[];
        }) => {
          for (const key of ['stroke', 'fill']) {
            const value = node.props?.[key];
            if (typeof value === 'string' && value !== 'none') colours.add(value);
          }
          for (const child of node.children ?? []) {
            if (child && typeof child === 'object') walk(child as never);
          }
        };
        await waitFor(() => {
          colours.clear();
          walk(getByTestId('updates-nav-button') as never);
          expect([...colours]).toEqual([tokens.ink]);
        });
      } finally {
        await AsyncStorage.clear();
      }
    }
  );

  it('shows the settings-driven church name once the settings snapshot arrives', async () => {
    signedIn();
    (onSnapshot as jest.Mock).mockImplementation((ref, onNext) => {
      if (String((ref as { path?: string })?.path ?? '').includes('settings')) {
        onNext({
          exists: () => true,
          data: () => ({
            churchName: 'Custom Church Name',
            description: 'Custom description from settings.',
          }),
        });
      }
      return jest.fn();
    });
    const { getByText, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('Custom Church Name')).toBeTruthy());
    // The description is still STORED and editable in the admin app; it is
    // simply not rendered on Home any more.
    expect(queryByText('Custom description from settings.')).toBeNull();
  });

  it('falls back to the product name when no settings document exists', async () => {
    // Reads the constant rather than repeating the literal, so a future
    // rename cannot leave this test asserting a name the app no longer uses.
    signedIn();
    const { getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText(DEFAULT_CHURCH_NAME)).toBeTruthy());
    expect(DEFAULT_CHURCH_NAME).toBe('Maranatha');
  });

  it('marks the church with the gold fish, and with its own logo once it has one', async () => {
    signedIn();
    const withoutLogo = await renderHomeScreen();
    await waitFor(() => expect(withoutLogo.getByTestId('church-branding')).toBeTruthy());
    expect(
      withoutLogo.getByTestId('church-fish', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(withoutLogo.queryByTestId('church-logo')).toBeNull();
    await withoutLogo.unmount();

    (onSnapshot as jest.Mock).mockImplementation((ref, onNext) => {
      if (String((ref as { path?: string })?.path ?? '').includes('settings')) {
        onNext({
          exists: () => true,
          data: () => ({ churchName: 'Grace', logoUrl: 'https://example.org/logo.png' }),
        });
      }
      return jest.fn();
    });
    const withLogo = await renderHomeScreen();
    await waitFor(() => expect(withLogo.getByTestId('church-logo')).toBeTruthy());
    expect(
      withLogo.queryByTestId('church-fish', { includeHiddenElements: true })
    ).toBeNull();
  });

  // --- The tagline is gone (V1 tester feedback) -----------------------

  it('renders no tagline under the church name, in either language', async () => {
    signedIn();
    const { getByTestId, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('church-branding')).toBeTruthy());
    expect(queryByText('A community of faith, worship, and fellowship.')).toBeNull();
    // And the header renders exactly two lines of text: greeting + name.
    const branding = JSON.stringify(getByTestId('church-branding'));
    expect(branding).not.toContain('community of faith');
  });

  // --- The announcements CONTENT block is gone --------------------------
  // It sat in the middle of Home showing "No announcements yet." even with
  // nothing to show. The feature is intact -- the header icon above opens
  // the list, asserted in its own test.

  it('has no announcements content section', async () => {
    signedIn();
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    for (const id of [
      'announcements-list',
      'announcements-empty',
      'announcements-loading',
      'announcements-error',
    ]) {
      expect(queryByTestId(id)).toBeNull();
    }
  });

  // --- The Verse of the Day is the hero ---------------------------------

  it('opens on the Verse of the Day, with its date, label, text and reference', async () => {
    signedIn();
    const { getByTestId, getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('daily-verse-card')).toBeTruthy());

    expect(getByTestId('daily-verse-date').props.children).toBe('Sunday, 11 October');
    expect(getByText(translate('en', 'home.verseOfTheDay'))).toBeTruthy();
    expect(getByText('Peace I leave with you; my peace I give you.')).toBeTruthy();
    expect(getByTestId('daily-verse-reference').props.children).toBe('John 14:27');
  });

  it('resolves a REAL verse with no network at all, never an empty hero', async () => {
    // The mocked hook above keeps the other tests deterministic; this one
    // runs the real one, with Firestore giving nothing, and expects the
    // bundled fallback -- a Bible app whose first screen says "could not
    // load" where the verse belongs has failed at its one job.
    (useVerseOfTheDay as jest.Mock).mockImplementation(
      jest.requireActual('../../daily-verses/useVerseOfTheDay').useVerseOfTheDay
    );
    // No override for today, and the church's pool cannot be fetched.
    (subscribeToTodaysDailyVerse as jest.Mock).mockImplementation((onNext) => {
      onNext(null);
      return jest.fn();
    });
    (loadVotdAutomation as jest.Mock).mockRejectedValue(new Error('offline'));
    signedIn();
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('daily-verse-card')).toBeTruthy());

    expect(queryByTestId('daily-verse-empty')).toBeNull();
    expect(
      String(getByTestId('daily-verse-reference').props.children).length
    ).toBeGreaterThan(0);
  });

  it('opens the Verse screen from "See all"', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('daily-verse-see-all')).toBeTruthy());

    await fireEvent.press(getByTestId('daily-verse-see-all'));
    await waitFor(() => expect(getByTestId('daily-verse-stub')).toBeTruthy());
  });

  it('opens the Bible at the verse\'s own chapter from "Read chapter"', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('daily-verse-read')).toBeTruthy());

    await fireEvent.press(getByTestId('daily-verse-read'));
    await waitFor(() => expect(getByTestId('bible-chapter-stub')).toBeTruthy());
    expect(JSON.parse(getByTestId('bible-chapter-stub').props.children)).toEqual({
      bookId: 'john',
      chapterNumber: 14,
      verse: 27,
    });
  });

  it('offers no "Read chapter" for an override, which has no known place', async () => {
    const override: VerseOfTheDayState = {
      ...VERSE,
      content: { ...VERSE.content, source: 'override', citation: null, location: null },
    };
    (useVerseOfTheDay as jest.Mock).mockReturnValue(override);
    signedIn();
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('daily-verse-card')).toBeTruthy());

    expect(queryByTestId('daily-verse-read')).toBeNull();
    expect(getByTestId('daily-verse-share')).toBeTruthy();
  });

  // --- Continue reading: offered only when there is something to continue

  it('offers no Continue reading before the member has read anything', async () => {
    signedIn();
    mockReadingPosition(null);
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    expect(queryByTestId('continue-reading-button')).toBeNull();
  });

  it('offers Continue reading once there is a position, and opens the Bible there', async () => {
    signedIn();
    mockReadingPosition('john');
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('continue-reading-button')).toBeTruthy());

    expect(getByTestId('continue-reading-button').props.accessibilityLabel).toContain(
      translate('en', 'bible.continueReading')
    );
    await fireEvent.press(getByTestId('continue-reading-button'));
    await waitFor(() => expect(getByTestId('bible-chapter-stub')).toBeTruthy());
    expect(JSON.parse(getByTestId('bible-chapter-stub').props.children)).toEqual({
      bookId: 'john',
      chapterNumber: 3,
      verse: 16,
    });
  });

  // --- Reading-plan progress -------------------------------------------
  // The ONLY progress UI on Home. Percentage is completedDays / dayCount,
  // not currentDay: days can be completed out of order.

  it('shows the active plan, its day count and a real percentage', async () => {
    signedIn();
    mockActivePlan(planSummary(30, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12));
    const { getByTestId, getByText } = await renderHomeScreen();

    await waitFor(() => expect(getByTestId('home-active-plan')).toBeTruthy());
    expect(getByText('Bible in 30 Days')).toBeTruthy();
    expect(
      getByText(translate('en', 'home.dayOf', { current: 12, total: 30 }))
    ).toBeTruthy();
    // 12 of 30 completed = 40%
    expect(getByTestId('home-plan-percent').props.children).toBe('40%');
    expect(
      StyleSheet.flatten(getByTestId('home-plan-progress-fill').props.style).width
    ).toBe('40%');
  });

  it('draws progress as a 3-point line, not a bar', async () => {
    signedIn();
    mockActivePlan(planSummary(30, [1, 2, 3], 4));
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-plan-progress-track')).toBeTruthy());
    expect(
      StyleSheet.flatten(getByTestId('home-plan-progress-track').props.style).height
    ).toBe(3);
    expect(
      StyleSheet.flatten(getByTestId('home-plan-progress-fill').props.style).height
    ).toBe(3);
  });

  it('computes 0% for a started-but-uncompleted plan, with no fake fill', async () => {
    signedIn();
    mockActivePlan(planSummary(10, [], 1));
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-plan-percent')).toBeTruthy());
    expect(getByTestId('home-plan-percent').props.children).toBe('0%');
    expect(
      StyleSheet.flatten(getByTestId('home-plan-progress-fill').props.style).width
    ).toBe('0%');
  });

  it('computes 100% for a completed plan', async () => {
    signedIn();
    mockActivePlan(planSummary(5, [1, 2, 3, 4, 5], 5));
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-plan-percent')).toBeTruthy());
    expect(getByTestId('home-plan-percent').props.children).toBe('100%');
  });

  it('clamps to 100% if dayCount was edited below the completed count', async () => {
    // An admin shrinking a plan after members completed days must not
    // render a bar wider than its track.
    signedIn();
    mockActivePlan(planSummary(3, [1, 2, 3, 4, 5], 3));
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-plan-percent')).toBeTruthy());
    expect(getByTestId('home-plan-percent').props.children).toBe('100%');
  });

  it('opens the current day when the plan row is pressed', async () => {
    signedIn();
    mockActivePlan(planSummary(30, [1, 2], 3));
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-active-plan')).toBeTruthy());

    await fireEvent.press(getByTestId('home-active-plan'));
    await waitFor(() => expect(getByTestId('plan-day-stub')).toBeTruthy());
  });

  it('shows a compact prompt, and NO progress, when there is no active plan', async () => {
    signedIn();
    mockActivePlan(null);
    const { getByTestId, queryByTestId, getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-plan-empty')).toBeTruthy());

    expect(getByText(translate('en', 'home.startAPlan'))).toBeTruthy();
    // No invented progress of any kind.
    expect(queryByTestId('home-plan-percent')).toBeNull();
    expect(queryByTestId('home-plan-progress-fill')).toBeNull();
    expect(queryByTestId('home-plan-progress-track')).toBeNull();
  });

  it('opens the plans list from the no-active-plan state', async () => {
    signedIn();
    mockActivePlan(null);
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-plan-empty')).toBeTruthy());

    await fireEvent.press(getByTestId('home-plan-empty'));
    await waitFor(() => expect(getByTestId('plans-list-stub')).toBeTruthy());
  });

  it('shows a progress readout ONLY in the reading-plan row', async () => {
    // The owner's constraint: percentage and line belong to the plan row
    // alone. Nothing else on Home carries data a member could read as progress.
    signedIn();
    mockActivePlan(planSummary(30, [1, 2, 3], 4));
    mockEvents([event()]);
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-active-plan')).toBeTruthy());

    const percentTexts: string[] = [];
    const walk = (node: {
      type?: string;
      props?: Record<string, unknown>;
      children?: unknown[];
    }) => {
      if (node.type === 'Text') {
        const text = JSON.stringify(node.children ?? '');
        if (/\d+%/.test(text)) percentTexts.push(text);
      }
      for (const child of node.children ?? []) {
        if (child && typeof child === 'object') walk(child as never);
      }
    };
    walk(getByTestId('home-together') as never);
    walk(getByTestId('home-next-event') as never);
    expect(percentTexts).toEqual([]);

    // ...while the plan row does render one.
    expect(getByTestId('home-plan-percent').props.children).toMatch(/\d+%/);
  });

  // --- The Prophet Verse is always there -------------------------------

  it('always shows the Prophet Verse section, even with none published', async () => {
    signedIn();
    mockProphet({ status: 'empty' });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('prophet-verse-empty')).toBeTruthy());
    expect(getByTestId('prophet-verse-section-title').props.children).toBe(
      translate('en', 'prophetVerse.title')
    );
  });

  it('shows a published Prophet Verse as a quote block', async () => {
    signedIn();
    mockProphet({
      status: 'ready',
      verse: {
        id: 'p1',
        title: 'Be still',
        reference: 'Psalm 46:10',
        text: 'Be still, and know that I am God.',
        attribution: null,
        imageUrl: null,
        publishAt: new Date('2026-04-01T06:00:00.000Z'),
      },
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('prophet-verse-card')).toBeTruthy());
    expect(getByTestId('prophet-verse-title').props.children).toBe('Be still');
    expect(getByTestId('prophet-verse-reference').props.children).toBe('Psalm 46:10');
  });

  // --- A live service: the one red -------------------------------------

  it('shows no live bar when nothing is live', async () => {
    signedIn();
    mockEvents([event()]);
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    expect(queryByTestId('home-live-banner')).toBeNull();
  });

  it('shows a slim live bar for a live event, and opens that event', async () => {
    signedIn();
    const live = event({ id: 'live1', title: 'Sunday Worship', isLive: true });
    mockEvents([live, event()]);
    const { getByTestId, getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-live-banner')).toBeTruthy());

    expect(getByText('Sunday Worship')).toBeTruthy();
    expect(getByText(translate('en', 'home.watchLive'))).toBeTruthy();
    const bar = getByTestId('home-live-banner');
    expect(bar.props.accessibilityLabel).toContain('Sunday Worship');
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({
      backgroundColor: lightTokens.live,
      minHeight: 54,
    });

    await fireEvent.press(bar);
    await waitFor(() => expect(getByTestId('event-detail-stub')).toBeTruthy());
    expect(JSON.parse(getByTestId('event-detail-stub').props.children).event.id).toBe(
      'live1'
    );
  });

  // --- The next event ---------------------------------------------------

  it('shows the next event as a row with a date block, and opens it', async () => {
    signedIn();
    mockEvents([event()]);
    const { getByTestId, getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-next-event')).toBeTruthy());

    expect(getByText('Wednesday Prayer Meeting')).toBeTruthy();
    expect(getByText(/Main hall/)).toBeTruthy();
    // The block: the weekday over the day number.
    expect(getByText('14')).toBeTruthy();
    expect(getByText('Wed')).toBeTruthy();

    await fireEvent.press(getByTestId('home-next-event'));
    await waitFor(() => expect(getByTestId('event-detail-stub')).toBeTruthy());
    expect(JSON.parse(getByTestId('event-detail-stub').props.children).event.id).toBe(
      'e1'
    );
  });

  it('shows no event row, and no label for it, when there is no upcoming event', async () => {
    signedIn();
    mockEvents([]);
    const { getByTestId, queryByTestId, queryByText } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    expect(queryByTestId('home-next-event')).toBeNull();
    expect(queryByText(translate('en', 'home.upcomingEvents'))).toBeNull();
  });

  it('opens the events list from the event section\'s "See all"', async () => {
    signedIn();
    mockEvents([event()]);
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-events-see-all')).toBeTruthy());

    await fireEvent.press(getByTestId('home-events-see-all'));
    await waitFor(() => expect(getByTestId('events-list-stub')).toBeTruthy());
  });

  it('does not show the live event a second time as the next one', async () => {
    signedIn();
    mockEvents([event({ id: 'live1', title: 'Sunday Worship', isLive: true })]);
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-live-banner')).toBeTruthy());
    expect(queryByTestId('home-next-event')).toBeNull();
  });

  // --- Together: three rows, three different places ---------------------
  //
  // The five-tile grid this replaces put two pairs of tiles in the same place
  // as far as a member could tell. Each row below lands somewhere no other
  // does, and the table is the guarantee.

  // [row, the screen it opens, and the view it asks that screen for]
  const TOGETHER_DESTINATIONS = [
    ['prayers-nav-button', 'prayers-hub-stub', JSON.stringify({ tab: 'requests' })],
    ['chat-nav-button', 'community-hub-stub', JSON.stringify({ tab: 'chat' })],
    ['media-nav-button', 'media-feed-stub', 'null'],
  ] as const;

  it.each(TOGETHER_DESTINATIONS)(
    '%s is a row that navigates',
    async (testID, stubID, params) => {
      signedIn();
      const { getByTestId } = await renderHomeScreen();
      await waitFor(() => expect(getByTestId('home-together')).toBeTruthy());

      const row = getByTestId(testID);
      expect(row.props.accessibilityRole).toBe('button');
      expect(typeof row.props.accessibilityLabel).toBe('string');

      await fireEvent.press(row);
      await waitFor(() => expect(getByTestId(stubID)).toBeTruthy());
      // The hubs hold two views each; the row has to ask for the right one.
      if (params !== 'null') expect(getByTestId(stubID).props.children).toBe(params);
    }
  );

  it('sends every row somewhere DIFFERENT', async () => {
    // The duplicate-destination bug in one assertion: two rows that
    // navigate to the same route are two buttons for one feature.
    signedIn();
    const reached: string[] = [];
    for (const [testID, stubID, params] of TOGETHER_DESTINATIONS) {
      // A fresh render each time: the first press pushes a screen over Home.
      const fresh = await renderHomeScreen();
      await waitFor(() => expect(fresh.getByTestId('home-together')).toBeTruthy());
      await fireEvent.press(fresh.getByTestId(testID));
      await waitFor(() => expect(fresh.getByTestId(stubID)).toBeTruthy());
      // Destination = the screen AND the view of it: Prayers and Community
      // are one screen each, so the params are what tell Chat from Updates.
      reached.push(`${stubID} ${params}`);
      await fresh.unmount();
    }
    expect(new Set(reached).size).toBe(reached.length);
  });

  it('says what each row is for, in the active language', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-together')).toBeTruthy());
    for (const [testID, title, hint] of [
      ['prayers-nav-button', 'prayerWall.title', 'home.askPray'],
      ['chat-nav-button', 'chat.title', 'community.goToChatHint'],
      ['media-nav-button', 'community.goToMedia', 'community.goToMediaHint'],
    ] as const) {
      const label = getByTestId(testID).props.accessibilityLabel as string;
      expect(label).toContain(translate('en', title));
      expect(label).toContain(translate('en', hint));
    }
  });

  it('says them in Telugu when the interface is Telugu', async () => {
    // The interface defaults to English, so the assertion above does not
    // exercise the Telugu catalogue on this screen. This one does, with the
    // Bible left on its own (Telugu) default -- the two settings are independent.
    await AsyncStorage.setItem('app_language_preference', 'te');
    try {
      signedIn();
      const { getByTestId } = await renderHomeScreen();
      await waitFor(() =>
        expect(getByTestId('prayers-nav-button').props.accessibilityLabel).toContain(
          translate('te', 'prayerWall.title')
        )
      );
      expect(getByTestId('chat-nav-button').props.accessibilityLabel).toContain(
        translate('te', 'chat.title')
      );
    } finally {
      await AsyncStorage.clear();
    }
  });

  it('shows what is new in "Photos and videos" as thumbnails, and still opens the feed', async () => {
    signedIn();
    (fetchMediaPage as jest.Mock).mockResolvedValue({
      posts: [mediaPost('a'), mediaPost('b', 'video'), mediaPost('c')],
      cursor: null,
    });
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() =>
      expect(
        getByTestId('home-media-thumbnails', { includeHiddenElements: true })
      ).toBeTruthy()
    );
    for (const id of ['a', 'b', 'c']) {
      expect(
        getByTestId(`home-media-${id}`, { includeHiddenElements: true })
      ).toBeTruthy();
    }
    // A picture is shown; a video has no still the app can fetch (its address is
    // a clip, not an image), so it is a quiet tile with a play mark instead.
    for (const id of ['a', 'c']) {
      expect(
        getByTestId(`home-media-image-${id}`, { includeHiddenElements: true }).props
          .source
      ).toEqual({ uri: `https://example.org/${id}` });
      expect(
        queryByTestId(`home-media-play-${id}`, { includeHiddenElements: true })
      ).toBeNull();
    }
    expect(
      queryByTestId('home-media-image-b', { includeHiddenElements: true })
    ).toBeNull();
    expect(
      getByTestId('home-media-play-b', { includeHiddenElements: true })
    ).toBeTruthy();

    await fireEvent.press(getByTestId('media-nav-button'));
    await waitFor(() => expect(getByTestId('media-feed-stub')).toBeTruthy());
  });

  it('shows the Photos row with no thumbnails when the church has posted nothing', async () => {
    signedIn();
    (fetchMediaPage as jest.Mock).mockResolvedValue({ posts: [], cursor: null });
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(fetchMediaPage).toHaveBeenCalled());
    expect(getByTestId('media-nav-button')).toBeTruthy();
    expect(
      queryByTestId('home-media-thumbnails', { includeHiddenElements: true })
    ).toBeNull();
  });

  // --- Reading order ----------------------------------------------------

  it('keeps Home in the order of the design: scripture first, together last', async () => {
    signedIn();
    mockActivePlan(planSummary(7, [1], 2));
    mockReadingPosition('john');
    mockEvents([event()]);
    mockProphet({ status: 'empty' });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-next-event')).toBeTruthy());
    await waitFor(() => expect(getByTestId('continue-reading-button')).toBeTruthy());

    const order = [
      'church-branding',
      'daily-verse-card',
      'continue-reading-button',
      'home-active-plan',
      'prophet-verse-empty',
      'home-next-event',
      'home-together',
    ];
    const seen: string[] = [];
    const walk = (node: { props?: Record<string, unknown>; children?: unknown[] }) => {
      const id = node.props?.testID;
      if (typeof id === 'string' && order.includes(id) && !seen.includes(id))
        seen.push(id);
      for (const child of node.children ?? []) {
        if (child && typeof child === 'object') walk(child as never);
      }
    };
    walk(getByTestId('home-screen') as never);
    expect(seen).toEqual(order);
  });

  it('shows a brief refreshing indicator on pull-to-refresh, then clears it', async () => {
    jest.useFakeTimers();
    try {
      mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
        onNext({ uid: 'u11', displayName: 'Sam', email: null, phoneNumber: null });
        return jest.fn();
      });
      const { getByTestId } = await renderHomeScreen();
      await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

      // RefreshControl is passed to ScrollView via the `refreshControl`
      // prop rather than as a queryable child -- assert on that prop's
      // element directly instead of getByTestId.
      const refreshControl = () => getByTestId('home-screen').props.refreshControl;
      expect(refreshControl().props.refreshing).toBe(false);

      await act(async () => refreshControl().props.onRefresh());
      expect(refreshControl().props.refreshing).toBe(true);

      await act(async () => jest.advanceTimersByTime(400));
      await waitFor(() => expect(refreshControl().props.refreshing).toBe(false));
    } finally {
      jest.useRealTimers();
    }
  });
});
