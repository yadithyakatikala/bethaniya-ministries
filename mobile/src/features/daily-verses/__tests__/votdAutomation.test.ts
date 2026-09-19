import { fetchVersePool, fetchVotdConfig } from '../../../services/firebase/votd';
import { loadVotdAutomation } from '../votdAutomation';
import { getCachedVersePool, setCachedVersePool } from '../votdPoolCache';
import type { VersePoolEntry } from '../votdSelection';

jest.mock('../../../services/firebase/votd');
jest.mock('../votdPoolCache');

/**
 * What this guards is a COST budget, not a behaviour a member can see: on
 * the Spark plan the pool is the only part of the Verse of the Day whose
 * read cost grows with the church's content, so every test here counts
 * calls.
 */
const POOL: VersePoolEntry[] = [
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

const config = {
  enabled: true,
  seed: 'maranatha',
  poolVersion: 4,
  timezone: 'Asia/Kolkata',
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchVotdConfig as jest.Mock).mockResolvedValue(config);
  (fetchVersePool as jest.Mock).mockResolvedValue(POOL);
  (getCachedVersePool as jest.Mock).mockResolvedValue(null);
  (setCachedVersePool as jest.Mock).mockResolvedValue(undefined);
});

describe('loading the automated selection inputs', () => {
  it('reads the configuration, then the pool, and caches the pool', async () => {
    expect(await loadVotdAutomation('2026-04-03')).toEqual({ config, pool: POOL });
    expect(fetchVersePool).toHaveBeenCalledTimes(1);
    expect(setCachedVersePool).toHaveBeenCalledWith(4, '2026-04-03', POOL);
  });

  it('does not touch the pool at all while automation is switched OFF', async () => {
    // A church that curates every date by hand pays one document read per
    // app open for this whole feature.
    (fetchVotdConfig as jest.Mock).mockResolvedValue({ ...config, enabled: false });
    expect(await loadVotdAutomation('2026-04-03')).toEqual({
      config: { ...config, enabled: false },
      pool: [],
    });
    expect(getCachedVersePool).not.toHaveBeenCalled();
    expect(fetchVersePool).not.toHaveBeenCalled();
  });

  it('serves a cached pool without a collection read', async () => {
    (getCachedVersePool as jest.Mock).mockResolvedValue(POOL);
    expect(await loadVotdAutomation('2026-04-03')).toEqual({ config, pool: POOL });
    expect(getCachedVersePool).toHaveBeenCalledWith(4, '2026-04-03');
    expect(fetchVersePool).not.toHaveBeenCalled();
  });

  it('serves a cached EMPTY pool without re-fetching all day', async () => {
    (getCachedVersePool as jest.Mock).mockResolvedValue([]);
    expect((await loadVotdAutomation('2026-04-03')).pool).toEqual([]);
    expect(fetchVersePool).not.toHaveBeenCalled();
  });

  it('re-fetches once the version the administrator configured changes', async () => {
    (getCachedVersePool as jest.Mock).mockImplementation((version: number) =>
      Promise.resolve(version === 4 ? POOL : null)
    );
    (fetchVotdConfig as jest.Mock).mockResolvedValue({ ...config, poolVersion: 5 });
    await loadVotdAutomation('2026-04-03');
    expect(fetchVersePool).toHaveBeenCalledTimes(1);
  });

  it('still returns the pool when the cache write fails', async () => {
    (setCachedVersePool as jest.Mock).mockRejectedValue(new Error('storage full'));
    await expect(loadVotdAutomation('2026-04-03')).resolves.toEqual({
      config,
      pool: POOL,
    });
  });

  it('propagates a failed read so the caller can fall back', async () => {
    // Not swallowed here: ./votdResolver.ts turns "no automation" into the
    // bundled fallback, which is a decision that belongs there.
    (fetchVotdConfig as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(loadVotdAutomation('2026-04-03')).rejects.toThrow('offline');
  });
});
