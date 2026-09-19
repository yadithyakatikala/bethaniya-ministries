import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearCachedVersePool,
  getCachedVersePool,
  setCachedVersePool,
} from '../votdPoolCache';
import type { VersePoolEntry } from '../votdSelection';

/**
 * The pool cache is a COST control, and its correctness condition is
 * narrow: serve the cached pool only when it is for the same
 * `poolVersion` AND the same canonical date. Every test here is about one
 * of the ways that condition can be wrong.
 */
const ENTRIES: VersePoolEntry[] = [
  {
    id: 'a',
    reference: 'John 3:16',
    bookId: 'john',
    chapter: 3,
    verse: 16,
    order: 0,
    active: true,
  },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('serving from the cache', () => {
  it('returns what was stored for the same version and date', async () => {
    await setCachedVersePool(2, '2026-04-03', ENTRIES);
    expect(await getCachedVersePool(2, '2026-04-03')).toEqual(ENTRIES);
  });

  it('is a miss when the administrator bumped poolVersion', async () => {
    // This is the documented "I edited the pool, start again" control: one
    // single-document read invalidates every device.
    await setCachedVersePool(2, '2026-04-03', ENTRIES);
    expect(await getCachedVersePool(3, '2026-04-03')).toBeNull();
  });

  it('is a miss the next day, so an edit cannot go unnoticed forever', async () => {
    await setCachedVersePool(2, '2026-04-03', ENTRIES);
    expect(await getCachedVersePool(2, '2026-04-04')).toBeNull();
  });

  it('distinguishes a cached EMPTY pool from nothing cached', async () => {
    // An administrator may legitimately have deactivated everything, and
    // that answer is worth caching rather than re-fetching all day.
    await setCachedVersePool(2, '2026-04-03', []);
    expect(await getCachedVersePool(2, '2026-04-03')).toEqual([]);
    await clearCachedVersePool();
    expect(await getCachedVersePool(2, '2026-04-03')).toBeNull();
  });
});

describe('a cache that cannot be trusted', () => {
  it('is a miss when nothing has ever been written', async () => {
    expect(await getCachedVersePool(1, '2026-04-03')).toBeNull();
  });

  it('is a miss for unparsable contents rather than a crash', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('{not json');
    expect(await getCachedVersePool(1, '2026-04-03')).toBeNull();
  });

  it('is a miss for a shape this build does not recognise', async () => {
    for (const stored of [
      '{"poolVersion":1,"dateKey":"2026-04-03"}',
      '{"poolVersion":"1","dateKey":"2026-04-03","entries":[]}',
      '{"poolVersion":1,"dateKey":"2026-04-03","entries":[{"id":"a"}]}',
      'null',
    ]) {
      jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(stored);
      expect(await getCachedVersePool(1, '2026-04-03')).toBeNull();
    }
  });

  it('never throws when the store itself is unavailable', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('no store'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('full'));
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(new Error('no store'));
    // A device that cannot cache still gets today's verse; it just pays
    // for the fetch again tomorrow.
    await expect(getCachedVersePool(1, '2026-04-03')).resolves.toBeNull();
    await expect(setCachedVersePool(1, '2026-04-03', ENTRIES)).resolves.toBeUndefined();
    await expect(clearCachedVersePool()).resolves.toBeUndefined();
  });
});
