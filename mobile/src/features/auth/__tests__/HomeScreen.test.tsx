import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { lightTokens } from '../../../theme';
import { translate } from '../../../i18n';
import { HomeScreen } from '../HomeScreen';

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
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

jest.mock('../../../services/firebase/app');

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
      expect(getByText(`${translate('te', 'home.welcome')}, Jane Doe`)).toBeTruthy()
    );
  });

  it('falls back to email, then phone number, when no display name is set', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u2', displayName: null, email: null, phoneNumber: '+15555550123' });
      return jest.fn();
    });
    const { getByText } = await renderHomeScreen();
    await waitFor(() =>
      expect(getByText(`${translate('te', 'home.welcome')}, +15555550123`)).toBeTruthy()
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

  it('does not duplicate the More tab with a Profile card', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u7', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

    expect(queryByTestId('profile-nav-button')).toBeNull();
  });

  it('has no sign-out button -- that lives in Settings', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u3', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId, queryByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

    expect(queryByTestId('sign-out-button')).toBeNull();
    // And Firebase sign-out is never reachable from this screen.
    expect(mockedSignOut).not.toHaveBeenCalled();
  });

  it('still surfaces the three secondary destinations the tab bar omits', async () => {
    // Plans / Prayers / Community are NOT in the bottom tab bar, so
    // offering them on Home is discovery rather than duplication.
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u9', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());

    expect(getByTestId('plans-nav-button')).toBeTruthy();
    expect(getByTestId('prayers-nav-button')).toBeTruthy();
    expect(getByTestId('community-nav-button')).toBeTruthy();
  });

  it('navigates to Notifications when "Notifications" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u8', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('notifications-nav-button')).toBeTruthy());
    await fireEvent.press(getByTestId('notifications-nav-button'));
    await waitFor(() => expect(getByTestId('notification-center-stub')).toBeTruthy());
  });

  // --- The notification control -----------------------------------------
  // It used to render a bare 8px dot in `colors.primary`: it said nothing
  // about what the button did, and being permanently lit it read as an
  // unread badge that never cleared. It is now a bell drawn from Views
  // (see ../../../theme/ui/BellIcon.tsx -- this project has no icon
  // dependency, and the bell follows the same idiom as MoreScreen's
  // chevron).

  it('labels the notification control as an action, not just a noun', async () => {
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('notifications-nav-button')).toBeTruthy());
    const button = getByTestId('notifications-nav-button');
    expect(button.props.accessibilityLabel).toBe(
      translate('te', 'home.notificationsLabel')
    );
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('meets the 44dp minimum touch target', async () => {
    // It was 40x40, under the accessibility minimum on both platforms.
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('notifications-nav-button')).toBeTruthy());
    const style = StyleSheet.flatten(getByTestId('notifications-nav-button').props.style);
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });

  it('draws the bell from the theme, so it flips with the palette', async () => {
    // The bell owns no colour of its own -- every stroke is painted from
    // `colors.ink` by the caller, which is what makes it correct in dark
    // mode too. A colour literal inside BellIcon would be the exact
    // defect this pass removed everywhere else.
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('notifications-nav-button')).toBeTruthy());

    // The three bell parts: the dome is stroked, the rim and clapper are
    // filled, so collect both properties.
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
    walk(getByTestId('notifications-nav-button') as never);

    // Every colour the control paints is a token -- the bell's ink, plus
    // the button's own surface and border.
    expect(colours).toContain(lightTokens.ink);
    expect([...colours].sort()).toEqual(
      [lightTokens.ink, lightTokens.surface, lightTokens.border].sort()
    );
  });

  // Day 13: ChurchBranding is now settings-driven (see
  // ../../../services/firebase/settings.ts) instead of hardcoded --
  // isolate the settings/church onSnapshot call from
  // AnnouncementsList's/DailyVerseCard's own onSnapshot calls (also
  // mounted on this screen) by checking each call's first argument, the
  // same `doc()`-produced `{ path }` shape the global firebase/firestore
  // mock (mobile/__mocks__/firebase/firestore.js) already returns.
  it('shows the settings-driven church name/description once the settings snapshot arrives', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u9', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((ref, next) => {
      if (ref && (ref as { path?: string }).path === 'settings/church') {
        next({
          exists: () => true,
          data: () => ({
            churchName: 'Grace Chapel',
            logoUrl: '',
            description: 'Custom description from settings.',
            supportEmail: 'contact@example.com',
          }),
        });
      }
      return jest.fn();
    });
    const { getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('Grace Chapel')).toBeTruthy());
    expect(getByText('Custom description from settings.')).toBeTruthy();
  });

  it('falls back to the default church name/description when no settings document exists', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u10', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((ref, next) => {
      if (ref && (ref as { path?: string }).path === 'settings/church') {
        next({ exists: () => false, data: () => undefined });
      }
      return jest.fn();
    });
    const { getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('Bethaniya Ministries')).toBeTruthy());
    expect(getByText('A community of faith, worship, and fellowship.')).toBeTruthy();
  });

  // Kept last in this file deliberately: jest's fake timers leave the RN
  // test renderer's internal scheduling in a state where the *next* test's
  // ref/render doesn't flush synchronously -- even once real timers are
  // restored (the same issue found and documented while debugging
  // dailyVerses.test.ts/events.test.ts, which avoid fake timers
  // entirely for this reason). Ordering it last avoids
  // tripping over it.
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
