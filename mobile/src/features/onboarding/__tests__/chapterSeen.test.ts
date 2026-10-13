import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenChapter, markChapterSeen } from '../chapterSeen';

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('chapterSeen', () => {
  it('has not been seen on a new device', async () => {
    expect(await hasSeenChapter()).toBe(false);
  });

  it('is remembered once it has been', async () => {
    await markChapterSeen();
    expect(await hasSeenChapter()).toBe(true);
  });

  it('is a bare flag: no answer and nothing personal is written with it', async () => {
    await markChapterSeen();
    expect(await AsyncStorage.getAllKeys()).toEqual(['onboarding_chapter_seen']);
    expect(await AsyncStorage.getItem('onboarding_chapter_seen')).toBe('1');
  });

  it('shows the chapter again, rather than hiding it, when the device cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    expect(await hasSeenChapter()).toBe(false);
  });

  it('does not interrupt anyone when the device cannot be written', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(markChapterSeen()).resolves.toBeUndefined();
  });
});
