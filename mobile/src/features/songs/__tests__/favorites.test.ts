import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFavoriteSongIds,
  isFavoriteSong,
  subscribeToFavoriteSongs,
  toggleFavoriteSong,
} from '../favorites';

describe('favorites', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('reports a song as not favorited when nothing is stored', async () => {
    expect(await isFavoriteSong('s1')).toBe(false);
  });

  it('toggles a song to favorited and back', async () => {
    expect(await toggleFavoriteSong('s1')).toBe(true);
    expect(await isFavoriteSong('s1')).toBe(true);

    expect(await toggleFavoriteSong('s1')).toBe(false);
    expect(await isFavoriteSong('s1')).toBe(false);
  });

  it('tracks multiple favorited songs independently', async () => {
    await toggleFavoriteSong('s1');
    await toggleFavoriteSong('s2');

    expect(await isFavoriteSong('s1')).toBe(true);
    expect(await isFavoriteSong('s2')).toBe(true);
    expect(await isFavoriteSong('s3')).toBe(false);
  });

  it('recovers gracefully from corrupted stored JSON', async () => {
    await AsyncStorage.setItem('song_favorites', 'not-json');
    expect(await isFavoriteSong('s1')).toBe(false);
  });

  describe('getFavoriteSongIds', () => {
    it('is empty when nothing is stored', async () => {
      expect(await getFavoriteSongIds()).toEqual([]);
    });

    it('lists the favourites in the order they were chosen', async () => {
      await toggleFavoriteSong('s2');
      await toggleFavoriteSong('s1');
      await toggleFavoriteSong('s3');
      await toggleFavoriteSong('s1');
      expect(await getFavoriteSongIds()).toEqual(['s2', 's3']);
    });

    it('ignores anything in storage that is not a song id', async () => {
      await AsyncStorage.setItem('song_favorites', JSON.stringify(['s1', 7, null, 's2']));
      expect(await getFavoriteSongIds()).toEqual(['s1', 's2']);
      await AsyncStorage.setItem('song_favorites', JSON.stringify({ s1: true }));
      expect(await getFavoriteSongIds()).toEqual([]);
    });
  });

  describe('subscribeToFavoriteSongs', () => {
    /** Lets the subscription's first read (a few promise hops) finish. */
    const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it('hands over the stored favourites once they are read', async () => {
      await toggleFavoriteSong('s1');
      const heard: string[][] = [];
      const stop = subscribeToFavoriteSongs((ids) => heard.push([...ids]));
      await settle();
      expect(heard).toEqual([['s1']]);
      stop();
    });

    it('hears of every favourite added or removed afterwards', async () => {
      const heard: string[][] = [];
      const stop = subscribeToFavoriteSongs((ids) => heard.push([...ids]));
      await settle();
      await toggleFavoriteSong('s1');
      await toggleFavoriteSong('s2');
      await toggleFavoriteSong('s1');
      expect(heard).toEqual([[], ['s1'], ['s1', 's2'], ['s2']]);
      stop();
    });

    it('tells every subscriber, and none once it has stopped', async () => {
      const first: string[][] = [];
      const second: string[][] = [];
      const stopFirst = subscribeToFavoriteSongs((ids) => first.push([...ids]));
      const stopSecond = subscribeToFavoriteSongs((ids) => second.push([...ids]));
      await settle();
      stopFirst();
      await toggleFavoriteSong('s1');
      expect(first).toEqual([[]]);
      expect(second).toEqual([[], ['s1']]);
      stopSecond();
      await toggleFavoriteSong('s2');
      expect(second).toEqual([[], ['s1']]);
    });

    it('does not let a slow first read undo a change that landed before it', async () => {
      let finishRead: (value: string | null) => void = () => undefined;
      // Only the subscription's own read is held back; the toggle's reads are real.
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<string | null>((resolve) => {
            finishRead = resolve;
          })
      );
      const heard: string[][] = [];
      const stop = subscribeToFavoriteSongs((ids) => heard.push([...ids]));
      await toggleFavoriteSong('s1');
      // The read that began before the toggle now arrives, with the old (empty) answer.
      finishRead(null);
      await settle();
      expect(heard).toEqual([['s1']]);
      stop();
    });

    it('stays quiet, and does not throw, when storage cannot be read', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('storage unavailable'))
      );
      const heard: string[][] = [];
      const stop = subscribeToFavoriteSongs((ids) => heard.push([...ids]));
      await settle();
      expect(heard).toEqual([]);
      // ...and hears the next change as usual.
      await toggleFavoriteSong('s1');
      expect(heard).toEqual([['s1']]);
      stop();
    });
  });
});
