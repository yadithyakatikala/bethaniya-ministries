import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFavoriteSong, toggleFavoriteSong } from '../favorites';

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
});
