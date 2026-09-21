import { describe, expect, it } from 'vitest';
import {
  indexOverridesByDate,
  resolveVotdDay,
  resolveVotdSchedule,
  votdCycle,
} from '../votdStatus';
import {
  prepareVersePool,
  selectVerseForDate,
  type VersePoolEntry,
} from '../votdSelection';
import { VOTD_YEAR_CONFIG, bundledVerseYear } from '../votdYear';
import type { DailyVerse } from '../../../types';

/**
 * The one answer the whole page is built on: which verse, on which day,
 * and from where.
 *
 * The three steps it takes are the phone's three steps
 * (mobile/src/features/daily-verses/votdResolver.ts). These tests state
 * the precedence explicitly, because getting it wrong is not a visible
 * bug -- it is a dashboard confidently showing a pastor a verse the
 * congregation will not see.
 */
function poolEntry(
  id: string,
  reference: string,
  bookId: string,
  chapter: number,
  verse: number,
  order: number
): VersePoolEntry {
  // Distinct book/chapter/verse per entry, deliberately: prepareVersePool
  // de-duplicates by reference, so three entries all pointing at John
  // 3:16 would be a one-verse pool and every count below would be wrong.
  return { id, reference, bookId, chapter, verse, order, active: true };
}

function dailyVerse(date: string, partial: Partial<DailyVerse> = {}): DailyVerse {
  return {
    id: date,
    date,
    reference: 'Isaiah 53:5',
    text: 'But he was pierced for our transgressions.',
    imageUrl: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

const CONFIG = { enabled: true, seed: 'maranatha', poolVersion: 1 };
const POOL = [
  poolEntry('a', 'John 3:16', 'john', 3, 16, 0),
  poolEntry('b', 'Psalms 23:1', 'psalms', 23, 1, 1),
  poolEntry('c', 'Romans 8:28', 'romans', 8, 28, 2),
];

describe('precedence', () => {
  it('puts a day set by hand above everything', () => {
    const day = resolveVotdDay(
      '2026-04-03',
      CONFIG,
      POOL,
      indexOverridesByDate([dailyVerse('2026-04-03')])
    );
    expect(day).toEqual({
      dateKey: '2026-04-03',
      source: 'override',
      reference: 'Isaiah 53:5',
    });
  });

  it('ignores a half-saved override rather than showing a blank day', () => {
    // Both a reference and text are required for the app to honour one.
    for (const broken of [
      dailyVerse('2026-04-03', { text: '   ' }),
      dailyVerse('2026-04-03', { reference: '' }),
    ]) {
      const day = resolveVotdDay(
        '2026-04-03',
        CONFIG,
        POOL,
        indexOverridesByDate([broken])
      );
      expect(day?.source).toBe('pool');
    }
  });

  it('uses the church’s pool next', () => {
    const day = resolveVotdDay('2026-04-03', CONFIG, POOL, new Map());
    expect(day?.source).toBe('pool');
    expect(POOL.map((entry) => entry.reference)).toContain(day?.reference);
  });

  it('falls to the app’s year when the pool is empty', () => {
    const day = resolveVotdDay('2026-04-03', CONFIG, [], new Map());
    expect(day?.source).toBe('year');
  });

  it('falls to the app’s year when every entry has been taken out', () => {
    const inactive = POOL.map((entry) => ({ ...entry, active: false }));
    expect(resolveVotdDay('2026-04-03', CONFIG, inactive, new Map())?.source).toBe('year');
  });

  it('falls to the app’s year when automatic selection is paused', () => {
    // Paused stops the CHURCH's verses being used. It does not leave
    // the congregation with a blank card, and the page must not claim
    // it does.
    const day = resolveVotdDay('2026-04-03', { ...CONFIG, enabled: false }, POOL, new Map());
    expect(day?.source).toBe('year');
  });

  it('agrees with the year’s own rotation, exactly', () => {
    // The page must not have its own opinion about the built-in year:
    // the phone rotates it with VOTD_YEAR_CONFIG, and so does this.
    const day = resolveVotdDay('2026-04-03', CONFIG, [], new Map());
    const direct = selectVerseForDate('2026-04-03', VOTD_YEAR_CONFIG, bundledVerseYear());
    expect(day?.reference).toBe(direct?.reference);
  });

  it('returns nothing for a date that does not exist', () => {
    expect(resolveVotdDay('2026-02-30', CONFIG, POOL, new Map())).toBeNull();
    expect(resolveVotdDay('not-a-date', CONFIG, POOL, new Map())).toBeNull();
  });
});

describe('the schedule', () => {
  it('runs consecutive days from the date given', () => {
    const schedule = resolveVotdSchedule('2026-04-03', 5, CONFIG, POOL, new Map());
    expect(schedule.map((day) => day.dateKey)).toEqual([
      '2026-04-03',
      '2026-04-04',
      '2026-04-05',
      '2026-04-06',
      '2026-04-07',
    ]);
  });

  it('crosses a month and a year boundary without a gap', () => {
    const schedule = resolveVotdSchedule('2026-12-30', 4, CONFIG, POOL, new Map());
    expect(schedule.map((day) => day.dateKey)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('includes 29 February in a leap year', () => {
    const schedule = resolveVotdSchedule('2028-02-28', 3, CONFIG, POOL, new Map());
    expect(schedule.map((day) => day.dateKey)).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('marks the days somebody set by hand, in place', () => {
    const schedule = resolveVotdSchedule(
      '2026-04-03',
      3,
      CONFIG,
      POOL,
      indexOverridesByDate([dailyVerse('2026-04-04')])
    );
    expect(schedule.map((day) => day.source)).toEqual(['pool', 'override', 'pool']);
  });

  it('visits every verse of the app’s year once, over 365 days', () => {
    const schedule = resolveVotdSchedule('2026-01-01', 365, CONFIG, [], new Map());
    expect(new Set(schedule.map((day) => day.reference)).size).toBe(365);
  });
});

describe('how long the cycle is', () => {
  it('is the length of the church’s pool when it has one', () => {
    expect(votdCycle(CONFIG, prepareVersePool(POOL))).toEqual({ using: 'pool', days: 3 });
  });

  it('is 365 when it does not', () => {
    expect(votdCycle(CONFIG, [])).toEqual({ using: 'year', days: 365 });
  });

  it('is 365 while automatic selection is paused', () => {
    expect(votdCycle({ ...CONFIG, enabled: false }, prepareVersePool(POOL))).toEqual({
      using: 'year',
      days: 365,
    });
  });
});

describe('indexing the days set by hand', () => {
  it('keeps the first document for a date, as the app’s listener does', () => {
    const byDate = indexOverridesByDate([
      dailyVerse('2026-04-03', { id: 'first', reference: 'First' }),
      dailyVerse('2026-04-03', { id: 'second', reference: 'Second' }),
    ]);
    expect(byDate.get('2026-04-03')?.id).toBe('first');
  });
});
