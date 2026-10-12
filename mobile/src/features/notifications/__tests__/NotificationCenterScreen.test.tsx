import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { addNotificationToHistory } from '../notificationHistory';
import * as notificationHistory from '../notificationHistory';
import { translate } from '../../../i18n';
import { NotificationCenterScreen } from '../NotificationCenterScreen';

jest.mock('../../../services/firebase/app');

const Stack = createNativeStackNavigator();

function BibleChapterStub() {
  return <Text testID="bible-chapter-stub">Bible chapter stub</Text>;
}

function SongsListStub() {
  return <Text testID="songs-list-stub">Songs list stub</Text>;
}

/** Prints the params it was opened with, so a test can see WHICH view it was sent to. */
function YouStub() {
  const { params } = useRoute();
  return <Text testID="you-stub">{JSON.stringify(params ?? null)}</Text>;
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
            <Stack.Screen name="You" component={YouStub} />
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

  it("opens the Profile tab of You for an older notification that says 'Profile'", async () => {
    // History is kept on the phone, so entries from before the tabs changed
    // can still carry the retired name.
    await addNotificationToHistory({
      title: 'Complete your profile',
      message: 'Add your name',
      data: { screen: 'Profile' },
    });
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Complete your profile')).toBeTruthy());

    const entries = await AsyncStorage.getItem('notification_history');
    const [entry] = JSON.parse(entries ?? '[]');
    await fireEvent.press(getByTestId(`notification-item-${entry.id}`));

    await waitFor(() => expect(getByTestId('you-stub')).toBeTruthy());
    expect(getByTestId('you-stub').props.children).toBe(
      JSON.stringify({ tab: 'profile' })
    );
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
  // --- The look: a top bar, a dot, when it came, a chevron only where it goes --

  it('has a top bar named Notifications with a Back', async () => {
    await addNotificationToHistory({ title: 'Plain', message: 'M' });
    const { getAllByText, getByRole } = await renderScreen();
    await waitFor(() => expect(getAllByText('Notifications').length).toBeGreaterThan(0));
    expect(getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('says "Today" for a notification that arrived today, and "Yesterday" for yesterday’s', async () => {
    const now = new Date();
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      16,
      15
    );
    await addNotificationToHistory({ title: 'New today', message: 'M' });
    await addNotificationToHistory({
      title: 'From yesterday',
      message: 'M',
      receivedAt: yesterday.toISOString(),
    });
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('From yesterday')).toBeTruthy());
    expect(getByText(/^Today, /)).toBeTruthy();
    expect(getByText(/^Yesterday, /)).toBeTruthy();
  });

  it('dates an older notification by its day and month', async () => {
    const old = new Date(2020, 9, 6, 9, 0);
    await addNotificationToHistory({
      title: 'Long ago',
      message: 'M',
      receivedAt: old.toISOString(),
    });
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Long ago')).toBeTruthy());
    expect(getByText(/^6 Oct 2020, /)).toBeTruthy();
  });

  it('announces an unread row as New, and a read one without it', async () => {
    await addNotificationToHistory({ title: 'Plain', message: 'No payload' });
    const { getByText, getByTestId, getByRole } = await renderScreen();
    await waitFor(() => expect(getByText('Plain')).toBeTruthy());
    expect(getByRole('button', { name: /^New\. Plain No payload / })).toBeTruthy();

    const [entry] = JSON.parse(
      (await AsyncStorage.getItem('notification_history')) ?? '[]'
    );
    await fireEvent.press(getByTestId(`notification-item-${entry.id}`));
    await waitFor(() =>
      expect(getByRole('button', { name: /^Plain No payload / })).toBeTruthy()
    );
  });

  it('sets an unread title bolder than a read one, so the dot is not the only sign', async () => {
    await addNotificationToHistory({ title: 'Unread one', message: 'M' });
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Unread one')).toBeTruthy());
    const weight = (
      StyleSheet.flatten(getByText('Unread one').props.style) as { fontWeight?: string }
    ).fontWeight;
    expect(weight).toBe('700');
  });

  it('draws a chevron only on a row that goes somewhere', async () => {
    await addNotificationToHistory({
      title: 'Goes',
      message: 'M',
      data: { screen: 'SongsList' },
    });
    await addNotificationToHistory({ title: 'Stays', message: 'M' });
    const { getByText, getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Goes')).toBeTruthy());
    const entries = JSON.parse(
      (await AsyncStorage.getItem('notification_history')) ?? '[]'
    );
    const goes = entries.find((e: { title: string }) => e.title === 'Goes');
    const stays = entries.find((e: { title: string }) => e.title === 'Stays');
    expect(
      getByTestId(`notification-go-${goes.id}`, { includeHiddenElements: true })
    ).toBeTruthy();
    expect(
      queryByTestId(`notification-go-${stays.id}`, { includeHiddenElements: true })
    ).toBeNull();
  });

  it('keeps the church’s title exactly as sent: no prefix inside it', async () => {
    await addNotificationToHistory({ title: 'Live now: Sunday Worship', message: 'M' });
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Live now: Sunday Worship')).toBeTruthy());
  });

  it('says what the empty page is for', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('notification-center-empty')).toBeTruthy());
    expect(getByTestId('notification-center-empty')).toHaveTextContent(/kept here/);
  });

  // --- A failed read must not spin forever -------------------------------
  // getNotificationHistory() reads AsyncStorage. Its promise used to be
  // consumed with a bare .then(), so a rejection left `history` at
  // undefined and the screen sat on its spinner with no explanation and
  // no way out -- see ../NotificationCenterScreen.tsx.

  it('shows an error state, not an endless spinner, when the history cannot be read', async () => {
    jest
      .spyOn(notificationHistory, 'getNotificationHistory')
      .mockRejectedValueOnce(new Error('AsyncStorage unavailable'));

    const { getByTestId, queryByTestId } = await renderScreen();

    await waitFor(() => expect(getByTestId('notification-center-error')).toBeTruthy());
    expect(queryByTestId('notification-center-loading')).toBeNull();
  });

  it('offers a retry that recovers once the read succeeds', async () => {
    const spy = jest
      .spyOn(notificationHistory, 'getNotificationHistory')
      .mockRejectedValueOnce(new Error('AsyncStorage unavailable'));

    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByTestId('notification-center-error')).toBeTruthy());

    spy.mockResolvedValueOnce([]);
    await fireEvent.press(getByText(translate('en', 'common.tryAgain')));

    await waitFor(() => expect(getByTestId('notification-center-empty')).toBeTruthy());
  });
});
