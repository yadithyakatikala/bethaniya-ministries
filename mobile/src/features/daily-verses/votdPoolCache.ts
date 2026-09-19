/**
 * The verse pool, cached on the device so it is fetched at most once per
 * day.
 *
 * WHY THIS EXISTS. The pool is a collection, so fetching it costs one
 * Firestore read per entry. On the Spark plan that is the only part of
 * the Verse of the Day whose cost grows, so it is the only part that is
 * cached. AsyncStorage-backed, exactly like
 * ../bible/bibleCache.ts.
 *
 * ---------------------------------------------------------------------
 * WHEN THE CACHE IS USED
 * ---------------------------------------------------------------------
 * Only when BOTH match:
 *
 *   poolVersion   the administrator's version number, read from the
 *                 configuration document (one document read). Bumping it
 *                 therefore refreshes every device on its next app open,
 *                 which is what makes it the documented control for
 *                 "I have edited the pool, start again".
 *   dateKey       the canonical Indian date. So a device re-reads the
 *                 pool once a day even when nothing was bumped, which
 *                 bounds how stale an activate/deactivate can be.
 *
 * The consequence worth stating plainly: activating or deactivating an
 * entry WITHOUT bumping `poolVersion` can leave devices disagreeing
 * about today's verse until the next Indian midnight, because the pool
 * they are choosing from differs. The admin page says so, and bumping
 * the version is one tap.
 *
 * A cache read or write that fails is not an error worth surfacing --
 * the caller simply fetches, or simply does not cache. Nothing here
 * throws.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VersePoolEntry } from './votdSelection';

const CACHE_KEY = 'votd_verse_pool_cache';

interface CachedPool {
  poolVersion: number;
  dateKey: string;
  entries: VersePoolEntry[];
}

function isVersePoolEntry(value: unknown): value is VersePoolEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<VersePoolEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.bookId === 'string' &&
    typeof entry.chapter === 'number' &&
    typeof entry.verse === 'number' &&
    typeof entry.order === 'number' &&
    typeof entry.active === 'boolean' &&
    typeof entry.reference === 'string'
  );
}

function isCachedPool(value: unknown): value is CachedPool {
  if (typeof value !== 'object' || value === null) return false;
  const cached = value as Partial<CachedPool>;
  return (
    typeof cached.poolVersion === 'number' &&
    typeof cached.dateKey === 'string' &&
    Array.isArray(cached.entries) &&
    cached.entries.every(isVersePoolEntry)
  );
}

/**
 * The cached pool for this exact (poolVersion, dateKey), or null.
 *
 * A cached EMPTY pool is a legitimate answer -- an administrator may have
 * deactivated everything -- so the return distinguishes "nothing usable
 * cached" (null) from "cached, and it is empty" (`[]`).
 */
export async function getCachedVersePool(
  poolVersion: number,
  dateKey: string
): Promise<VersePoolEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCachedPool(parsed)) return null;
    if (parsed.poolVersion !== poolVersion || parsed.dateKey !== dateKey) return null;
    return parsed.entries;
  } catch {
    return null;
  }
}

export async function setCachedVersePool(
  poolVersion: number,
  dateKey: string,
  entries: VersePoolEntry[]
): Promise<void> {
  try {
    const payload: CachedPool = { poolVersion, dateKey, entries };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A full or unavailable store costs a fetch tomorrow, nothing more.
  }
}

/** Used by the tests, and by nothing in the app. */
export async function clearCachedVersePool(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to do; the validity check above rejects a stale entry anyway.
  }
}
