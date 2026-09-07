/**
 * Local-only favorites for songs -- Day 6's "Favorites are local-only
 * with the existing AsyncStorage dependency. No V2 cloud sync." Stores a
 * single JSON array of favorited song ids under one AsyncStorage key;
 * proportional to Day 6's scope (a handful of songs, one device) rather
 * than a per-song key or any cloud-backed structure. Reuses
 * @react-native-async-storage/async-storage, already a mobile dependency
 * since Day 2 (auth persistence) -- no new dependency needed for this.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'song_favorites';

async function readFavoriteIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function isFavoriteSong(songId: string): Promise<boolean> {
  const ids = await readFavoriteIds();
  return ids.includes(songId);
}

/** Adds songId if absent, removes it if present. Returns the new favorited state. */
export async function toggleFavoriteSong(songId: string): Promise<boolean> {
  const ids = await readFavoriteIds();
  const isFavorite = ids.includes(songId);
  const next = isFavorite ? ids.filter((id) => id !== songId) : [...ids, songId];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return !isFavorite;
}
