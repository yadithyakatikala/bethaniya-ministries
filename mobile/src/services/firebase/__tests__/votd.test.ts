import { doc, getDoc, getDocs, orderBy, where } from 'firebase/firestore';
import {
  VERSE_POOL_COLLECTION,
  VOTD_SETTINGS_DOC_ID,
  VOTD_TIMEZONE,
  fetchVersePool,
  fetchVotdConfig,
  isTransientVotdError,
  toVersePoolEntry,
  toVotdConfig,
} from '../votd';
import { DEFAULT_VOTD_CONFIG } from '../../../features/daily-verses/votdSelection';

jest.mock('../app');

function lastDocPath(): string {
  return ((doc as jest.Mock).mock.results.at(-1)?.value as { path: string }).path;
}

function poolSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map(({ id, data }) => ({ id, data: () => data })) };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reading the configuration document', () => {
  it('lives at settings/dailyVerse, beside but separate from settings/church', () => {
    expect(VOTD_SETTINGS_DOC_ID).toBe('dailyVerse');
  });

  it('defaults every field independently, so a half-written document still works', () => {
    expect(toVotdConfig({})).toEqual({ ...DEFAULT_VOTD_CONFIG, timezone: VOTD_TIMEZONE });
    expect(toVotdConfig({ seed: 'lent-2026' })).toEqual({
      ...DEFAULT_VOTD_CONFIG,
      seed: 'lent-2026',
      timezone: VOTD_TIMEZONE,
    });
  });

  it('keeps a valid stored value', () => {
    expect(toVotdConfig({ enabled: false, seed: 'x', poolVersion: 7 })).toEqual({
      enabled: false,
      seed: 'x',
      poolVersion: 7,
      timezone: VOTD_TIMEZONE,
    });
  });

  it('rejects values it cannot use rather than passing them through', () => {
    // A seed of '' would silently make every church with an empty seed
    // share a sequence; a fractional poolVersion would make the cache key
    // meaningless.
    expect(toVotdConfig({ enabled: 'yes', seed: '', poolVersion: 1.5 })).toEqual({
      ...DEFAULT_VOTD_CONFIG,
      timezone: VOTD_TIMEZONE,
    });
    expect(toVotdConfig({ poolVersion: 0 }).poolVersion).toBe(
      DEFAULT_VOTD_CONFIG.poolVersion
    );
  });

  it('fetches ONE document, not a listener', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ enabled: true, seed: 'advent', poolVersion: 3 }),
    });
    const config = await fetchVotdConfig();
    expect(lastDocPath()).toBe('settings/dailyVerse');
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(config.seed).toBe('advent');
  });

  it('treats a missing document as "automation on, with the defaults"', async () => {
    // This is the whole migration story: an existing install gets the
    // automated verse without anyone configuring anything.
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    expect(await fetchVotdConfig()).toEqual({
      ...DEFAULT_VOTD_CONFIG,
      timezone: VOTD_TIMEZONE,
    });
    expect(DEFAULT_VOTD_CONFIG.enabled).toBe(true);
  });
});

describe('reading a pool document', () => {
  const valid = {
    reference: 'John 3:16',
    bookId: 'john',
    chapter: 3,
    verse: 16,
    order: 4,
  };

  it('keeps a well-formed entry', () => {
    expect(toVersePoolEntry('id1', { ...valid, active: true })).toEqual({
      id: 'id1',
      reference: 'John 3:16',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      order: 4,
      active: true,
    });
  });

  it('drops an entry that is not a reference at all', () => {
    // Returning null rather than a coerced entry is what keeps every
    // device choosing from the same list.
    for (const broken of [
      { ...valid, bookId: '' },
      { ...valid, bookId: 42 },
      { ...valid, chapter: 0 },
      { ...valid, chapter: '3' },
      { ...valid, verse: 1.5 },
      { ...valid, verse: -1 },
      {},
    ]) {
      expect(toVersePoolEntry('id1', broken)).toBeNull();
    }
  });

  it('builds a display reference when the document has none', () => {
    const { reference: _omitted, ...withoutReference } = valid;
    expect(toVersePoolEntry('id1', withoutReference)?.reference).toBe('john 3:16');
  });

  it('treats a missing `active` as active, and a missing `order` as zero', () => {
    // An entry written by an older admin build must not vanish from the
    // rotation; prepareVersePool() breaks the resulting tie by id, so the
    // order stays total.
    expect(toVersePoolEntry('id1', valid)).toMatchObject({ active: true });
    const { order: _omitted, ...withoutOrder } = valid;
    expect(toVersePoolEntry('id1', withoutOrder)).toMatchObject({ order: 0 });
  });

  it('respects an explicit active: false', () => {
    expect(toVersePoolEntry('id1', { ...valid, active: false })).toMatchObject({
      active: false,
    });
  });
});

describe('fetching the pool', () => {
  it('filters inactive entries server-side, so they are never charged for', async () => {
    (getDocs as jest.Mock).mockResolvedValue(
      poolSnapshot([
        { id: 'a', data: { bookId: 'john', chapter: 3, verse: 16, order: 0 } },
        { id: 'b', data: { bookId: 'psalms', chapter: 23, verse: 1, order: 1 } },
      ])
    );
    const pool = await fetchVersePool();
    expect(where).toHaveBeenCalledWith('active', '==', true);
    expect(pool.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(VERSE_POOL_COLLECTION).toBe('verse_pool');
  });

  it('does not order server-side, which would need a composite index for nothing', async () => {
    // prepareVersePool() has to sort defensively anyway -- see
    // features/daily-verses/votdSelection.ts.
    (getDocs as jest.Mock).mockResolvedValue(poolSnapshot([]));
    await fetchVersePool();
    expect(orderBy).not.toHaveBeenCalled();
  });

  it('silently drops an unusable document instead of failing the whole fetch', async () => {
    (getDocs as jest.Mock).mockResolvedValue(
      poolSnapshot([
        { id: 'good', data: { bookId: 'john', chapter: 3, verse: 16 } },
        { id: 'bad', data: { chapter: 3, verse: 16 } },
      ])
    );
    expect((await fetchVersePool()).map((entry) => entry.id)).toEqual(['good']);
  });
});

describe('deciding whether a failed read is worth retrying', () => {
  it('treats a denied read as permanent -- retrying only spends reads', () => {
    expect(isTransientVotdError({ code: 'permission-denied' })).toBe(false);
    expect(isTransientVotdError({ code: 'unauthenticated' })).toBe(false);
  });

  it('treats being offline as transient', () => {
    expect(isTransientVotdError({ code: 'unavailable' })).toBe(true);
    expect(isTransientVotdError(new Error('boom'))).toBe(true);
    expect(isTransientVotdError(undefined)).toBe(true);
  });
});
