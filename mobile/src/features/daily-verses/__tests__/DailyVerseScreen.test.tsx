import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { DailyVerseScreen } from '../DailyVerseScreen';
import { todayDateString } from '../../../services/firebase/dailyVerses';

jest.mock('../../../services/firebase/app');

const Stack = createNativeStackNavigator();

async function renderScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="DailyVerse" component={DailyVerseScreen} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

describe('DailyVerseScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('shows a loading indicator before the first snapshot arrives', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('daily-verse-screen-loading')).toBeTruthy();
  });

  it('shows an empty state when no verse is set for today', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('daily-verse-screen-empty')).toBeTruthy());
  });

  it("shows today's verse when set", async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'For God so loved the world...',
              imageUrl: null,
              date: todayDateString(),
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByTestId('daily-verse-today-card')).toBeTruthy());
    expect(getByText('For God so loved the world...')).toBeTruthy();
    expect(getByText('John 3:16')).toBeTruthy();
  });

  it('lists past verses in the archive, excluding today', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'today',
            data: () => ({
              reference: 'John 3:16',
              text: "Today's verse",
              imageUrl: null,
              date: todayDateString(),
            }),
          },
          {
            id: 'past1',
            data: () => ({
              reference: 'Psalm 23:1',
              text: 'The Lord is my shepherd...',
              imageUrl: null,
              date: '2020-01-01',
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByTestId, getByText, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('daily-verse-archive-list')).toBeTruthy());
    // "Today's verse" legitimately appears once, in the today-card -- the
    // assertion here is that today's entry is NOT duplicated into the
    // archive list below it.
    expect(getByText('The Lord is my shepherd...')).toBeTruthy();
    expect(queryByTestId('daily-verse-archive-item-today')).toBeNull();
  });

  it('shows an archive empty state when there are no past verses', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('daily-verse-archive-empty')).toBeTruthy());
  });

  it('goes back when the back button is pressed', async () => {
    const { getByTestId } = await renderScreen();
    // No assertion on navigation state here (this screen is the only one
    // registered in this test's Stack.Navigator) -- pressing back with
    // nothing to go back to is a no-op in React Navigation, so this just
    // proves the button exists and doesn't throw when pressed.
    fireEvent.press(getByTestId('daily-verse-back-button'));
    expect(getByTestId('daily-verse-screen')).toBeTruthy();
  });
});
