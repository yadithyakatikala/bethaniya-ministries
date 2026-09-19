import { addDays } from '../votdDate';
import {
  DEFAULT_VOTD_CONFIG,
  fnv1a32,
  prepareVersePool,
  selectPoolIndex,
  selectVerseForDate,
  strideFor,
  type VersePoolEntry,
  type VotdConfig,
} from '../votdSelection';

/**
 * The selection algorithm.
 *
 * The property that matters most is not "it picks a verse" but "it picks
 * the SAME verse for everyone, forever, with no server" -- so most of
 * this file is about determinism, and about the full-cycle behaviour
 * that stops one verse appearing twice a fortnight while another never
 * appears at all.
 */
function entry(id: string, order: number, overrides: Partial<VersePoolEntry> = {}) {
  return {
    id,
    reference: `Book ${order}:1`,
    bookId: `book-${order}`,
    chapter: 1,
    verse: 1,
    order,
    active: true,
    ...overrides,
  } satisfies VersePoolEntry;
}

const POOL = Array.from({ length: 7 }, (_, i) => entry(`v${i}`, i));
const CONFIG = DEFAULT_VOTD_CONFIG;

describe('the hash', () => {
  it('is stable for the same input', () => {
    expect(fnv1a32('maranatha|1')).toBe(fnv1a32('maranatha|1'));
  });

  it('separates inputs that differ only in the seed or the version', () => {
    expect(fnv1a32('maranatha|1')).not.toBe(fnv1a32('maranatha|2'));
    expect(fnv1a32('maranatha|1')).not.toBe(fnv1a32('bethany|1'));
  });

  it('stays inside unsigned 32-bit range, so engines cannot disagree on sign', () => {
    for (const input of ['', 'a', 'maranatha|1', 'ಆదికాండము']) {
      const hash = fnv1a32(input);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('the stride', () => {
  it('is always coprime with the pool size, which is what makes the cycle complete', () => {
    for (let n = 1; n <= 60; n += 1) {
      for (const hash of [0, 1, 7, 4294967295, fnv1a32(`seed-${n}`)]) {
        const stride = strideFor(hash, n);
        expect(stride).toBeGreaterThanOrEqual(1);
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        expect(gcd(stride, n)).toBe(1);
      }
    }
  });

  it('degenerates safely for a one-entry pool', () => {
    expect(strideFor(12345, 1)).toBe(1);
  });
});

describe('determinism', () => {
  it('gives the same date the same verse, every time', () => {
    const first = selectVerseForDate('2026-03-14', CONFIG, POOL);
    for (let i = 0; i < 25; i += 1) {
      expect(selectVerseForDate('2026-03-14', CONFIG, POOL)?.id).toBe(first?.id);
    }
  });

  it('does not depend on the order Firestore happened to return', () => {
    const shuffled = [...POOL].reverse();
    expect(selectVerseForDate('2026-03-14', CONFIG, shuffled)?.id).toBe(
      selectVerseForDate('2026-03-14', CONFIG, POOL)?.id
    );
  });

  it('gives consecutive days different verses', () => {
    let date = '2026-01-01';
    for (let i = 0; i < 40; i += 1) {
      const next = addDays(date, 1)!;
      expect(selectVerseForDate(date, CONFIG, POOL)?.id).not.toBe(
        selectVerseForDate(next, CONFIG, POOL)?.id
      );
      date = next;
    }
  });

  it('visits every verse exactly once per cycle, then repeats', () => {
    // The whole point of a coprime stride: a congregation gets all seven
    // verses over seven days, not the same two over and over.
    const seen: string[] = [];
    let date = '2026-01-01';
    for (let i = 0; i < POOL.length; i += 1) {
      seen.push(selectVerseForDate(date, CONFIG, POOL)!.id);
      date = addDays(date, 1)!;
    }
    expect(new Set(seen).size).toBe(POOL.length);
    // Day n is the same as day 0 again.
    expect(selectVerseForDate(date, CONFIG, POOL)!.id).toBe(seen[0]);
  });

  it('works for dates before the epoch instead of going negative', () => {
    const chosen = selectVerseForDate('1969-06-01', CONFIG, POOL);
    expect(chosen).not.toBeNull();
    expect(POOL.map((e) => e.id)).toContain(chosen!.id);
  });
});

describe('the seed and the pool version change the sequence', () => {
  function sequence(config: VotdConfig, days = 14): string[] {
    let date = '2026-01-01';
    const out: string[] = [];
    for (let i = 0; i < days; i += 1) {
      out.push(selectVerseForDate(date, config, POOL)!.id);
      date = addDays(date, 1)!;
    }
    return out;
  }

  it('a different seed produces a different sequence', () => {
    expect(sequence({ ...CONFIG, seed: 'bethany' })).not.toEqual(sequence(CONFIG));
  });

  it('a different poolVersion produces a different sequence', () => {
    expect(sequence({ ...CONFIG, poolVersion: 2 })).not.toEqual(sequence(CONFIG));
  });

  it('reverting the seed restores the original sequence exactly', () => {
    const before = sequence(CONFIG);
    sequence({ ...CONFIG, seed: 'temporary' });
    expect(sequence(CONFIG)).toEqual(before);
  });

  it('returns nothing at all while automation is disabled', () => {
    expect(
      selectVerseForDate('2026-03-14', { ...CONFIG, enabled: false }, POOL)
    ).toBeNull();
  });
});

describe('the pool is filtered before anything is computed', () => {
  it('ignores inactive entries', () => {
    const pool = [entry('a', 0), entry('b', 1, { active: false }), entry('c', 2)];
    expect(prepareVersePool(pool).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('never selects an inactive entry, over a whole cycle', () => {
    const pool = [...POOL, entry('inactive', 99, { active: false })];
    let date = '2026-01-01';
    for (let i = 0; i < 30; i += 1) {
      expect(selectVerseForDate(date, CONFIG, pool)!.id).not.toBe('inactive');
      date = addDays(date, 1)!;
    }
  });

  it('rejects structurally invalid entries rather than selecting them', () => {
    const pool = [
      entry('ok', 0),
      entry('no-book', 1, { bookId: '' }),
      entry('bad-chapter', 2, { chapter: 0 }),
      entry('fractional-verse', 3, { verse: 1.5 }),
      entry('bad-verse', 4, { verse: -3 }),
    ];
    expect(prepareVersePool(pool).map((e) => e.id)).toEqual(['ok']);
  });

  it('keeps one of a duplicated reference, predictably the first in order', () => {
    const pool = [
      entry('second', 5, { bookId: 'john', chapter: 3, verse: 16 }),
      entry('first', 1, { bookId: 'john', chapter: 3, verse: 16 }),
      entry('other', 2, { bookId: 'psalms', chapter: 23, verse: 1 }),
    ];
    expect(prepareVersePool(pool).map((e) => e.id)).toEqual(['first', 'other']);
  });

  it('breaks an `order` tie by id, so the order is total', () => {
    const pool = [entry('b', 0), entry('a', 0), entry('c', 0)];
    // All three share order 0 and differ only by id.
    expect(
      prepareVersePool(pool.map((e, i) => ({ ...e, bookId: `book-${i}` }))).map(
        (e) => e.id
      )
    ).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty pool without throwing', () => {
    expect(prepareVersePool([])).toEqual([]);
    expect(selectVerseForDate('2026-03-14', CONFIG, [])).toBeNull();
    expect(selectPoolIndex('2026-03-14', CONFIG, 0)).toBeNull();
  });

  it('handles a pool with one entry', () => {
    const only = [entry('solo', 0)];
    expect(selectVerseForDate('2026-03-14', CONFIG, only)?.id).toBe('solo');
    expect(selectVerseForDate('2026-03-15', CONFIG, only)?.id).toBe('solo');
  });

  it('returns nothing for an unusable date rather than day zero', () => {
    expect(selectPoolIndex('2026-02-30', CONFIG, 7)).toBeNull();
    expect(selectVerseForDate('not-a-date', CONFIG, POOL)).toBeNull();
  });

  it('always returns an index inside the pool', () => {
    let date = '2020-01-01';
    for (let i = 0; i < 400; i += 1) {
      const index = selectPoolIndex(date, CONFIG, POOL.length)!;
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(POOL.length);
      date = addDays(date, 1)!;
    }
  });
});
