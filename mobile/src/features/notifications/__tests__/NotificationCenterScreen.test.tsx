import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { addNotificationToHistory } from '../notificationHistory';
import { NotificationCenterScreen } from '../NotificationCenterScreen';

jest.mock('../../../services/firebase/app');

const Stack = createNativeStackNavigator();

function BibleChapterStub() {
  return <Text testID="bible-chapter-stub">Bible chapter stub</Text>;
}

function SongsListStub() {
  return <Text testID="songs-list-stub">Songs list stub</Text>;
}

async function renderScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen
              name="NotificationCenter"
              component={NotificationCenterScreen}
            />
            <Stack.Screen name="BibleChapter" component={BibleChapterStub} />
            <Stack.Screen name="SongsList" component={SongsListStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

describe('NotificationCenterScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('shows an empty state when there is no notification history', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('notification-center-empty')).toBeTruthy());
  });

  it('lists recorded notifications with title, message, and timestamp', async () => {
    await addNotificationToHistory({
      title: 'Service Reminder',
      message: 'Starts at 10am',
    });
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Service Reminder')).toBeTruthy());
    expect(getByText('Starts at 10am')).toBeTruthy();
  });

  it('navigates to a no-param route from a notification payload', async () => {
    await addNotificationToHistory({
      title: 'New Song',
      message: 'Check it out',
      data: { screen: 'SongsList' },
    });
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('New Song')).toBeTruthy());

    const entries = await AsyncStorage.getItem('notification_history');
    const [entry] = JSON.parse(entries ?? '[]');
    await fireEvent.press(getByTestId(`notification-item-${entry.id}`));

    await waitFor(() => expect(getByTestId('songs-list-stub')).toBeTruthy());
  });

  it('navigates to BibleChapter with bookId/chapterNumber from a notification payload', async () => {
    await addNotificationToHistory({
      title: 'New chapter',
      message: 'Genesis 3 updated',
      data: { screen: 'BibleChapter', bookId: 'genesis', chapterNumber: 3 },
    });
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('New chapter')).toBeTruthy());

    const entries = await AsyncStorage.getItem('notification_history');
    const [entry] = JSON.parse(entries ?? '[]');
    await fireEvent.press(getByTestId(`notification-item-${entry.id}`));

    await waitFor(() => expect(getByTestId('bible-chapter-stub')).toBeTruthy());
  });

  it('does not navigate for an entry with no payload', async () => {
    await addNotificationToHistory({ title: 'Plain', message: 'No payload' });
    const { getByText, getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Plain')).toBeTruthy());

    const entries = await AsyncStorage.getItem('notification_history');
    const [entry] = JSON.parse(entries ?? '[]');
    await fireEvent.press(getByTestId(`notification-item-${entry.id}`));

    expect(queryByTestId('bible-chapter-stub')).toBeNull();
    expect(queryByTestId('songs-list-stub')).toBeNull();
  });

  it('shows an unread dot for an unread entry', async () => {
    await addNotificationToHistory({ title: 'Unread one', message: 'M' });
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Unread one')).toBeTruthy());

    const entries = await AsyncStorage.getItem('notification_history');
    const [entry] = JSON.parse(entries ?? '[]');
    expect(getByTestId(`notification-unread-dot-${entry.id}`)).toBeTruthy();
  });

  it('hides the unread dot and persists read state after the entry is pressed', async () => {
    await addNotificationToHistory({ title: 'Plain', message: 'No payload' });
    const { getByText, getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Plain')).toBeTruthy());

    const entries = await AsyncStorage.getItem('notification_history');
    const [entry] = JSON.parse(entries ?? '[]');
    expect(getByTestId(`notification-unread-dot-${entry.id}`)).toBeTruthy();

    await fireEvent.press(getByTestId(`notification-item-${entry.id}`));

    await waitFor(() =>
      expect(queryByTestId(`notification-unread-dot-${entry.id}`)).toBeNull()
    );
    const stored = await AsyncStorage.getItem('notification_history');
    const [updated] = JSON.parse(stored ?? '[]');
    expect(updated.readAt).toEqual(expect.any(String));
  });
});
