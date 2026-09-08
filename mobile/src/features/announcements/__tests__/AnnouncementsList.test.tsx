import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { AnnouncementsList } from '../AnnouncementsList';

jest.mock('../../../services/firebase/app');

const Stack = createNativeStackNavigator();

function AnnouncementDetailStub() {
  return <Text testID="announcement-detail-stub">Announcement detail stub</Text>;
}

// AnnouncementsList now reads colors from the shared useTheme() (see
// AnnouncementsList.tsx's doc comment), which needs the real
// PreferencesProvider stack -- the same wrapping DailyVerseCard.test.tsx
// already uses for the same reason. onAuthStateChanged is left at its
// default (never fires -- see mobile/__mocks__/firebase/auth.js), so
// AuthContext's status stays 'loading' / uid stays null throughout these
// tests, meaning PreferencesProvider never subscribes to a Firestore user
// profile -- the shared `onSnapshot` mock below is only ever driven by
// AnnouncementsList's own announcements subscription, exactly as before.
//
// Also now needs a real Stack.Navigator -- AnnouncementsList calls
// useNavigation() to push AnnouncementDetail on tap (see its doc
// comment), same "real navigator + stub destination" pattern
// HomeScreen.test.tsx already uses.
function renderList() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="AnnouncementsListHost" component={AnnouncementsList} />
            <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

describe('AnnouncementsList', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state before the first snapshot arrives', async () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await renderList();
    expect(getByTestId('announcements-loading')).toBeTruthy();
  });

  it('shows an empty state when there are no published announcements', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await renderList();
    await waitFor(() => expect(getByTestId('announcements-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await renderList();
    await waitFor(() => expect(getByTestId('announcements-error')).toBeTruthy());
  });

  it('renders each published announcement', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'a1',
            data: () => ({
              title: 'Sunday Service',
              content: 'Join us at 10am.',
              imageUrl: null,
              published: true,
              createdAt: null,
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText } = await renderList();
    await waitFor(() => expect(getByText('Sunday Service')).toBeTruthy());
    expect(getByText('Join us at 10am.')).toBeTruthy();
  });

  it('navigates to AnnouncementDetail when a row is pressed', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'a1',
            data: () => ({
              title: 'Sunday Service',
              content: 'Join us at 10am.',
              imageUrl: null,
              published: true,
              createdAt: null,
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText, getByTestId } = await renderList();
    await waitFor(() => expect(getByText('Sunday Service')).toBeTruthy());
    fireEvent.press(getByTestId('announcement-a1'));
    await waitFor(() => expect(getByTestId('announcement-detail-stub')).toBeTruthy());
  });
});
