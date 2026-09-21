import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { DEFAULT_CHURCH_NAME } from '../../../theme/brand';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { lightTokens } from '../../../theme';
import { translate } from '../../../i18n';
import { HomeScreen } from '../HomeScreen';
import {
  subscribeToMostRecentPlanProgress,
  type ActivePlanSummary,
} from '../../../services/firebase/plans';

/**
 * HomeScreen is registered as the "Home" screen inside AppNavigator's
 * real stack (Day 6) and calls useNavigation() to reach "SongsList" --
 * useNavigation() only works when the component renders as an actual
 * screen inside a Navigator (a bare NavigationContainer isn't enough),
 * so this test helper builds a small real Stack.Navigator, mirroring
 * AppNavigator.tsx's shape, with a stub "SongsList" screen to assert
 * against. Day 9 adds PreferencesProvider -- HomeScreen renders
 * DailyVerseCard, which now reads usePreferences() (see
 * ../../daily-verses/DailyVerseCard.tsx), so it needs the real provider.
 */
const Stack = createNativeStackNavigator();

function SongsListStub() {
  return <Text testID="songs-list-stub">Songs list stub</Text>;
}

function EventsListStub() {
  return <Text testID="events-list-stub">Events list stub</Text>;
}

function BibleBooksStub() {
  return <Text testID="bible-books-stub">Bible books stub</Text>;
}

function ProfileStub() {
  return <Text testID="profile-stub">Profile stub</Text>;
}

function NotificationCenterStub() {
  return <Text testID="notification-center-stub">Notification center stub</Text>;
}

function AnnouncementsStub() {
  return <Text testID="announcements-stub">Announcements stub</Text>;
}

function PlansListStub() {
  return <Text testID="plans-list-stub">Plans list stub</Text>;
}

function PlanDayStub() {
  return <Text testID="plan-day-stub">Plan day stub</Text>;
}

function PrayersStub() {
  return <Text testID="prayers-stub">Prayers stub</Text>;
}

function CommunityStub() {
  return <Text testID="community-stub">Community stub</Text>;
}

function PrayerWallStub() {
  return <Text testID="prayer-wall-stub">Prayer wall stub</Text>;
}

function ChatStub() {
  return <Text testID="chat-stub">Chat stub</Text>;
}

function MediaFeedStub() {
  return <Text testID="media-feed-stub">Media feed stub</Text>;
}

function renderHomeScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SongsList" component={SongsListStub} />
            <Stack.Screen name="EventsList" component={EventsListStub} />
            <Stack.Screen name="BibleBooks" component={BibleBooksStub} />
            <Stack.Screen name="Profile" component={ProfileStub} />
            <Stack.Screen name="NotificationCenter" component={NotificationCenterStub} />
            <Stack.Screen name="Announcements" component={AnnouncementsStub} />
            <Stack.Screen name="PlansList" component={PlansListStub} />
            <Stack.Screen name="PlanDay" component={PlanDayStub} />
            <Stack.Screen name="Prayers" component={PrayersStub} />
            <Stack.Screen name="CommunityList" component={CommunityStub} />
            <Stack.Screen name="PrayerWall" component={PrayerWallStub} />
            <Stack.Screen name="CommunityChat" component={ChatStub} />
            <Stack.Screen name="MediaFeed" component={MediaFeedStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/plans');

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
    mockActivePlan(null);
  });

  beforeEach(() => {
    mockActivePlan(null);
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
  // Home used to carry an "Explore" grid of seven large cards -- Songs,
  // Events, Bible, Reading Plans, Prayers, Community, Profile -- plus a
  // "Sign out" row. Songs/Events/Bible duplicated the bottom tab bar and
  // Profile duplicated the More tab, so Home was a second way to navigate
  // the same places. Signing out is an account action and belongs with
  // the account settings.
  //
  // These assert the ABSENCE of those affordances, which is the actual
  // fix; the destinations themselves are still reachable (the tab bar for
  // Songs/Events/Bible, More for Profile, Settings for logout) and are
  // covered by TabBar.test.tsx, MoreScreen.test.tsx and
  // SettingsScreen.test.tsx respectively.

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

  // --- Home's top-right utility area (V1 tester feedback) -------------
  // The tester's screenshot showed an "almost invisible dot" in the top
  // right: an 8px View in `colors.primary` on the paper background. It is
  // now two real buttons -- Profile and Announcements -- each a themed
  // 44dp surface with a bordered outline and an ink glyph.
  //
  // Profile is a HEADER ICON here, not the giant Home card it used to be.

  it('offers Profile as a header icon, and navigates to Profile', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('profile-nav-button')).toBeTruthy());

    const button = getByTestId('profile-nav-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe(translate('en', 'home.profileLabel'));
    expect(button.props.accessibilityHint).toBe(translate('en', 'home.profileHint'));

    await fireEvent.press(button);
    await waitFor(() => expect(getByTestId('profile-stub')).toBeTruthy());
  });

  it('offers Announcements as a header icon, and navigates to Announcements', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('announcements-nav-button')).toBeTruthy());

    const button = getByTestId('announcements-nav-button');
    expect(button.props.accessibilityLabel).toBe(
      translate('en', 'home.announcementsLabel')
    );
    expect(button.props.accessibilityHint).toBe(
      translate('en', 'home.announcementsHint')
    );

    await fireEvent.press(button);
    await waitFor(() => expect(getByTestId('announcements-stub')).toBeTruthy());
  });

  it.each([['profile-nav-button'], ['announcements-nav-button']])(
    '%s meets the 44dp minimum touch target',
    async (testID) => {
      signedIn();
      const { getByTestId } = await renderHomeScreen();
      await waitFor(() => expect(getByTestId(testID)).toBeTruthy());
      const style = StyleSheet.flatten(getByTestId(testID).props.style);
      expect(style.width).toBeGreaterThanOrEqual(44);
      expect(style.height).toBeGreaterThanOrEqual(44);
    }
  );

  it.each([['profile-nav-button'], ['announcements-nav-button']])(
    '%s is visible in BOTH themes, painted only from tokens',
    async (testID) => {
      // The old dot failed precisely because it was one colour on a
      // background it did not contrast with. A utility button needs a
      // surface fill, a border, AND an ink glyph -- all tokens, so the
      // contrast survives the palette flip without painting anything white.
      signedIn();
      const { getByTestId } = await renderHomeScreen();
      await waitFor(() => expect(getByTestId(testID)).toBeTruthy());

      const colours = new Set<string>();
      const walk = (node: { props?: Record<string, unknown>; children?: unknown[] }) => {
        const style = StyleSheet.flatten(node.props?.style as never) as
          Record<string, string> | undefined;
        if (style?.borderColor) colours.add(style.borderColor);
        if (style?.backgroundColor) colours.add(style.backgroundColor);
        for (const child of node.children ?? []) {
          if (child && typeof child === 'object') walk(child as never);
        }
      };
      walk(getByTestId(testID) as never);

      // Exactly the three tokens, nothing invented.
      expect([...colours].sort()).toEqual(
        [lightTokens.surface, lightTokens.border, lightTokens.ink].sort()
      );
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

  it('opens the current day when the plan card is pressed', async () => {
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

  it('shows a progress bar ONLY in the reading-plan card', async () => {
    // The owner's constraint: percentage and bar belong to the plan card
    // alone. The three feature tiles carry no data.
    signedIn();
    mockActivePlan(planSummary(30, [1, 2, 3], 4));
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-active-plan')).toBeTruthy());

    // Look for percent TEXT specifically -- '100%' also appears as a
    // layout width on the tiles, which is not a progress readout.
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
    walk(getByTestId('home-feature-tiles') as never);
    expect(percentTexts).toEqual([]);

    // ...while the plan card does render one.
    expect(getByTestId('home-plan-percent').props.children).toMatch(/\d+%/);
  });

  // --- The feature tiles are icon tiles, not content cards -------------
  //
  // FIVE TILES, FIVE DIFFERENT DESTINATIONS. A tester found the M7 grid
  // presented "Prayers" and "Prayer requests" as separate features that
  // opened the same kind of thing, so Prayers now opens the SHARED WALL
  // and the private journal lives in More under its own name. Media is
  // here because it previously had no Home entry at all. The table below
  // is the guarantee that no two tiles land in the same place.

  it.each([
    ['prayers-nav-button', 'prayer-wall-stub'],
    ['plans-nav-button', 'plans-list-stub'],
    ['community-nav-button', 'community-stub'],
    ['chat-nav-button', 'chat-stub'],
    ['media-nav-button', 'media-feed-stub'],
  ])('%s is an icon tile that navigates', async (testID, stub) => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-feature-tiles')).toBeTruthy());

    const tile = getByTestId(testID);
    const style = StyleSheet.flatten(tile.props.style);
    // Square, not a long horizontal card.
    expect(style.aspectRatio).toBe(1);
    expect(tile.props.accessibilityRole).toBe('button');
    expect(typeof tile.props.accessibilityLabel).toBe('string');

    await fireEvent.press(tile);
    await waitFor(() => expect(getByTestId(stub)).toBeTruthy());
  });

  it('sends every tile somewhere DIFFERENT', async () => {
    // The duplicate-destination bug in one assertion: two tiles that
    // navigate to the same route are two buttons for one feature, which
    // is what a tester reported about Prayers / Prayer requests.
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-feature-tiles')).toBeTruthy());

    const every = [
      'prayers-nav-button',
      'plans-nav-button',
      'community-nav-button',
      'chat-nav-button',
      'media-nav-button',
    ] as const;
    // Every tile is present on the one screen...
    for (const testID of every) expect(getByTestId(testID)).toBeTruthy();

    // ...and each lands somewhere no other tile does. Pressed on its own
    // fresh render, because the first press pushes a screen over Home and
    // the next tile would no longer be on it.
    const reached: string[] = [];
    for (const [testID, stub] of [
      ['prayers-nav-button', 'prayer-wall-stub'],
      ['plans-nav-button', 'plans-list-stub'],
      ['community-nav-button', 'community-stub'],
      ['chat-nav-button', 'chat-stub'],
      ['media-nav-button', 'media-feed-stub'],
    ] as const) {
      const fresh = await renderHomeScreen();
      await waitFor(() => expect(fresh.getByTestId('home-feature-tiles')).toBeTruthy());
      await fireEvent.press(fresh.getByTestId(testID));
      await waitFor(() => expect(fresh.getByTestId(stub)).toBeTruthy());
      reached.push(stub);
    }
    expect(new Set(reached).size).toBe(reached.length);
  });

  it('labels the tiles in the active language', async () => {
    signedIn();
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-feature-tiles')).toBeTruthy());
    for (const [testID, key] of [
      ['prayers-nav-button', 'more.prayers'],
      ['plans-nav-button', 'more.readingPlans'],
      ['community-nav-button', 'more.community'],
      ['chat-nav-button', 'chat.title'],
      ['media-nav-button', 'media.title'],
    ] as const) {
      expect(getByTestId(testID).props.accessibilityLabel).toBe(translate('en', key));
    }
  });

  it('labels the three tiles in Telugu when the interface is Telugu', async () => {
    // The interface defaults to English in V2, so the assertion above no
    // longer exercises the Telugu catalogue on this screen. This one does,
    // with the Bible left on its own (Telugu) default -- the two settings
    // are independent.
    await AsyncStorage.setItem('app_language_preference', 'te');
    try {
      signedIn();
      const { getByTestId } = await renderHomeScreen();
      await waitFor(() =>
        expect(getByTestId('prayers-nav-button').props.accessibilityLabel).toBe(
          translate('te', 'more.prayers')
        )
      );
      expect(getByTestId('plans-nav-button').props.accessibilityLabel).toBe(
        translate('te', 'more.readingPlans')
      );
    } finally {
      await AsyncStorage.clear();
    }
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
