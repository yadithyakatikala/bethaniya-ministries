import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../../../navigation/AppNavigator';
import { getNotificationHistory } from '../../../features/notifications/notificationHistory';
import {
  configureNotificationHandler,
  requestNotificationPermissionsAsync,
  useNotificationListeners,
} from '../notificationService';

jest.mock('../../../navigation/AppNavigator', () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

function buildNotification(overrides: {
  identifier?: string;
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
}) {
  return {
    date: Date.now(),
    request: {
      identifier: overrides.identifier ?? 'notif-1',
      content: {
        title: overrides.title ?? 'Title',
        subtitle: null,
        body: overrides.body ?? 'Body',
        data: overrides.data,
      },
      trigger: null,
    },
  } as never;
}

describe('configureNotificationHandler', () => {
  it('sets a notification handler', () => {
    configureNotificationHandler();
    expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) })
    );
  });
});

describe('requestNotificationPermissionsAsync', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns true without prompting when already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    const result = await requestNotificationPermissionsAsync();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts and returns the result when not already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    const result = await requestNotificationPermissionsAsync();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns false when the user denies the prompt', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
    });
    const result = await requestNotificationPermissionsAsync();
    expect(result).toBe(false);
  });
});

describe('useNotificationListeners', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
  });

  it('registers both listeners on mount and removes them on unmount', async () => {
    const { unmount } = await renderHook(() => useNotificationListeners());
    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();

    const receivedSub = (Notifications.addNotificationReceivedListener as jest.Mock).mock
      .results[0].value;
    const responseSub = (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.results[0].value;
    await unmount();
    expect(receivedSub.remove).toHaveBeenCalled();
    expect(responseSub.remove).toHaveBeenCalled();
  });

  it('records a foreground-received notification to local history', async () => {
    await renderHook(() => useNotificationListeners());
    const onReceived = (Notifications.addNotificationReceivedListener as jest.Mock).mock
      .calls[0][0];

    onReceived(buildNotification({ identifier: 'n1', title: 'Hello', body: 'World' }));

    await waitFor(async () => expect(await getNotificationHistory()).toHaveLength(1));
    const history = await getNotificationHistory();
    expect(history[0]).toMatchObject({ title: 'Hello', message: 'World' });
  });

  it('records a tapped notification only once even if it was already received', async () => {
    await renderHook(() => useNotificationListeners());
    const onReceived = (Notifications.addNotificationReceivedListener as jest.Mock).mock
      .calls[0][0];
    const onResponse = (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.calls[0][0];

    const notification = buildNotification({
      identifier: 'n2',
      title: 'Hi',
      body: 'There',
    });
    onReceived(notification);
    onResponse({ notification, actionIdentifier: 'default' });

    await waitFor(async () => expect(await getNotificationHistory()).toHaveLength(1));
  });

  it('records a tapped notification the listener never saw arrive', async () => {
    await renderHook(() => useNotificationListeners());
    const onResponse = (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.calls[0][0];

    const notification = buildNotification({
      identifier: 'n3',
      title: 'Bg',
      body: 'Tap',
    });
    onResponse({ notification, actionIdentifier: 'default' });

    await waitFor(async () => expect(await getNotificationHistory()).toHaveLength(1));
    const history = await getNotificationHistory();
    expect(history[0]).toMatchObject({ title: 'Bg', message: 'Tap' });
  });

  it('navigates to the payload target when a notification is tapped', async () => {
    await renderHook(() => useNotificationListeners());
    const onResponse = (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.calls[0][0];

    const notification = buildNotification({
      identifier: 'n4',
      data: { screen: 'SongsList' },
    });
    onResponse({ notification, actionIdentifier: 'default' });

    expect(navigationRef.navigate).toHaveBeenCalledWith('SongsList');
  });

  it('does not navigate when the navigator is not ready', async () => {
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);
    await renderHook(() => useNotificationListeners());
    const onResponse = (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.calls[0][0];

    const notification = buildNotification({
      identifier: 'n5',
      data: { screen: 'SongsList' },
    });
    onResponse({ notification, actionIdentifier: 'default' });

    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when the payload has no recognized screen', async () => {
    await renderHook(() => useNotificationListeners());
    const onResponse = (
      Notifications.addNotificationResponseReceivedListener as jest.Mock
    ).mock.calls[0][0];

    const notification = buildNotification({ identifier: 'n6' });
    onResponse({ notification, actionIdentifier: 'default' });

    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });
});
