import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addNotificationToHistory,
  clearNotificationHistory,
  getNotificationHistory,
} from '../notificationHistory';

describe('notificationHistory', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns an empty array when nothing has ever been recorded', async () => {
    expect(await getNotificationHistory()).toEqual([]);
  });

  it('records a notification and returns it', async () => {
    await addNotificationToHistory({
      title: 'Service Reminder',
      message: 'Starts at 10am',
    });
    const history = await getNotificationHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      title: 'Service Reminder',
      message: 'Starts at 10am',
    });
    expect(history[0].id).toEqual(expect.any(String));
    expect(history[0].receivedAt).toEqual(expect.any(String));
  });

  it('defaults data to null when none is provided', async () => {
    await addNotificationToHistory({ title: 'T', message: 'M' });
    const [entry] = await getNotificationHistory();
    expect(entry.data).toBeNull();
  });

  it('stores the navigation payload when provided', async () => {
    await addNotificationToHistory({
      title: 'New chapter',
      message: 'Check it out',
      data: { screen: 'BibleChapter', bookId: 'genesis', chapterNumber: 3 },
    });
    const [entry] = await getNotificationHistory();
    expect(entry.data).toEqual({
      screen: 'BibleChapter',
      bookId: 'genesis',
      chapterNumber: 3,
    });
  });

  it('returns entries newest first', async () => {
    await addNotificationToHistory({
      title: 'First',
      message: 'M',
      receivedAt: '2026-01-01T00:00:00.000Z',
    });
    await addNotificationToHistory({
      title: 'Second',
      message: 'M',
      receivedAt: '2026-01-02T00:00:00.000Z',
    });
    const history = await getNotificationHistory();
    expect(history.map((e) => e.title)).toEqual(['Second', 'First']);
  });

  it('caps history at 100 entries', async () => {
    for (let i = 0; i < 105; i++) {
      await addNotificationToHistory({
        title: `N${i}`,
        message: 'M',
        receivedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
    }
    const history = await getNotificationHistory();
    expect(history.length).toBe(100);
  });

  it('clears history', async () => {
    await addNotificationToHistory({ title: 'T', message: 'M' });
    await clearNotificationHistory();
    expect(await getNotificationHistory()).toEqual([]);
  });

  it('recovers gracefully from corrupted stored JSON', async () => {
    await AsyncStorage.setItem('notification_history', 'not valid json{{{');
    expect(await getNotificationHistory()).toEqual([]);
  });
});
