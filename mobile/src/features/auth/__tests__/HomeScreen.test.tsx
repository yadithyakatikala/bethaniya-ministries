import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { HomeScreen } from '../HomeScreen';

/**
 * HomeScreen is registered as the "Home" screen inside AppNavigator's
 * real stack (Day 6) and calls useNavigation() to reach "SongsList" --
 * useNavigation() only works when the component renders as an actual
 * screen inside a Navigator (a bare NavigationContainer isn't enough),
 * so this test helper builds a small real Stack.Navigator, mirroring
 * AppNavigator.tsx's shape, with a stub "SongsList" screen to assert
 * against.
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

function renderHomeScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="SongsList" component={SongsListStub} />
          <Stack.Screen name="EventsList" component={EventsListStub} />
          <Stack.Screen name="BibleBooks" component={BibleBooksStub} />
        </Stack.Navigator>
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
});
