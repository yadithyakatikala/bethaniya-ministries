import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
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
    await waitFor(() => expect(getByText('Welcome, Jane Doe')).toBeTruthy());
  });

  it('falls back to email, then phone number, when no display name is set', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u2', displayName: null, email: null, phoneNumber: '+15555550123' });
      return jest.fn();
    });
    const { getByText } = await renderHomeScreen();
    await waitFor(() => expect(getByText('Welcome, +15555550123')).toBeTruthy());
  });

  it('calls Firebase sign-out when "Sign out" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u3', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    mockedSignOut.mockResolvedValue(undefined);
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('sign-out-button')).toBeTruthy());
    await fireEvent.press(getByTestId('sign-out-button'));
    await waitFor(() => expect(mockedSignOut).toHaveBeenCalled());
  });

  it('navigates to the Songs list when "Songs" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u4', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('songs-nav-button')).toBeTruthy());
    await fireEvent.press(getByTestId('songs-nav-button'));
    await waitFor(() => expect(getByTestId('songs-list-stub')).toBeTruthy());
  });

  it('navigates to the Events list when "Events" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u5', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('events-nav-button')).toBeTruthy());
    await fireEvent.press(getByTestId('events-nav-button'));
    await waitFor(() => expect(getByTestId('events-list-stub')).toBeTruthy());
  });

  it('navigates to the Bible books list when "Bible" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u6', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('bible-nav-button')).toBeTruthy());
    await fireEvent.press(getByTestId('bible-nav-button'));
    await waitFor(() => expect(getByTestId('bible-books-stub')).toBeTruthy());
  });

  it('navigates to Profile when "Profile" is pressed', async () => {
    mockedOnAuthStateChanged.mockImplementation((_auth, onNext) => {
      onNext({ uid: 'u7', displayName: 'Sam', email: null, phoneNumber: null });
      return jest.fn();
    });
    const { getByTestId } = await renderHomeScreen();
    await waitFor(() => expect(getByTestId('profile-nav-button')).toBeTruthy());
    await fireEvent.press(getByTestId('profile-nav-button'));
    await waitFor(() => expect(getByTestId('profile-stub')).toBeTruthy());
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
});
