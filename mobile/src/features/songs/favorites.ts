/**
 * Local-only favorites for songs -- Day 6's "Favorites are local-only
 * with the existing AsyncStorage dependency. No V2 cloud sync." Stores a
 * single JSON array of favorited song ids under one AsyncStorage key;
 * proportional to Day 6's scope (a handful of songs, one device) rather
 * than a per-song key or any cloud-backed structure. Reuses
 * @react-native-async-storage/async-storage, already a mobile dependency
 * since Day 2 (auth persistence) -- no new dependency needed for this.
 *
 * The songs list draws a heart on each favourite and has a Favourites
 * filter, while the heart itself is chosen on the song's own page -- a
 * different screen, which stays mounted underneath. `subscribeToFavoriteSongs`
 * is how the list hears of a change without either screen knowing the other:
 * a toggle tells every subscriber the new set.
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

/** The ids of every song the member has favourited, in the order they were chosen. */
export async function getFavoriteSongIds(): Promise<string[]> {
  return readFavoriteIds();
}

export async function isFavoriteSong(songId: string): Promise<boolean> {
  const ids = await readFavoriteIds();
  return ids.includes(songId);
}

const listeners = new Set<(ids: string[]) => void>();

/**
 * Calls `onChange` with the current set of favourites once it has been read,
 * and again with the new set each time a song is favourited or unfavourited.
 * Returns the function that stops it.
 *
 * A change that arrives while the first read is still on its way wins: the
 * stale read is dropped, so a quick toggle can never be undone by the read
 * that began before it.
 */
export function subscribeToFavoriteSongs(
  onChange: (ids: ReadonlySet<string>) => void
): () => void {
  let active = true;
  let heardOfAChange = false;
  const onToggle = (ids: string[]) => {
    if (!active) return;
    heardOfAChange = true;
    onChange(new Set(ids));
  };
  listeners.add(onToggle);
  readFavoriteIds().then(
    (ids) => {
      if (active && !heardOfAChange) onChange(new Set(ids));
    },
    // Storage that cannot be read leaves the list as it was: no hearts.
    () => undefined
  );
  return () => {
    active = false;
    listeners.delete(onToggle);
  };
}

/** Adds songId if absent, removes it if present. Returns the new favorited state. */
export async function toggleFavoriteSong(songId: string): Promise<boolean> {
  const ids = await readFavoriteIds();
  const isFavorite = ids.includes(songId);
  const next = isFavorite ? ids.filter((id) => id !== songId) : [...ids, songId];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener(next));
  return !isFavorite;
}
