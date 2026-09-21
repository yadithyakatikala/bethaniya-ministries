import { addDays } from '../votdDate';
import { resolveVotdReference, resolveVotdScripture } from '../votdResolver';
import { prepareVersePool, selectVerseForDate } from '../votdSelection';
import { VOTD_YEAR, VOTD_YEAR_LENGTH, bundledVerseYear } from '../votdYear';

/**
 * The Verse of the Day is a 365-day system.
 *
 * ---------------------------------------------------------------------
 * WHAT WAS ACTUALLY WRONG, AND WHAT WAS NOT
 * ---------------------------------------------------------------------
 * The machinery was never the problem. Since M5 the app has worked out
 * each day's verse from the date, a seed and a pool version -- no stored
 * pick, no per-day record, nothing for an administrator to create each
 * morning. The rotation steps through the pool by a stride coprime with
 * its length, so it visits every entry once before any repeat: THE
 * POOL'S LENGTH IS THE CYCLE'S LENGTH.
 *
 * What was wrong was the length. The app carried twelve built-in
 * references, so a church that had not curated a pool of its own got a
 * twelve-day cycle. That is why the Verse of the Day looked like it was
 * repeating rather than running: not a broken scheduler, a short list.
 *
 * These tests pin the length, pin the year, and -- the part that matters
 * most -- pin the claim that no day in a year repeats.
 */
const START = '2026-01-01';

/** The reference the app would show on `dateKey`, with no Firestore at all. */
function verseOn(dateKey: string): string {
  const selection = resolveVotdReference(dateKey, null, null, null);
  if (!selection || selection.source === 'override') {
    throw new Error(`No automated verse for ${dateKey}`);
  }
  return selection.poolReference;
}

describe('the built-in year', () => {
  it('holds exactly 365 references', () => {
    expect(VOTD_YEAR_LENGTH).toBe(365);
    expect(VOTD_YEAR).toHaveLength(365);
    expect(bundledVerseYear()).toHaveLength(365);
  });

  it('is a list of REFERENCES, never verse text', () => {
    // The whole reason the year can be bundled at all: 365 references
    // cost a few kilobytes, while the words live in the corpus the app
    // already carries. A regression here would mean scripture copied
    // into a generated file.
    for (const entry of VOTD_YEAR) {
      expect(Object.keys(entry).sort()).toEqual([
        'active',
        'bookId',
        'chapter',
        'id',
        'order',
        'reference',
        'verse',
      ]);
      expect(entry.reference).toMatch(/^[1-3]? ?[A-Za-z][A-Za-z ]* \d+:\d+$/);
      expect(entry.active).toBe(true);
    }
  });

  it('numbers its entries 0 to 364, with no gaps and no ties', () => {
    // The rotation sorts by `order`, so a tie would make two devices
    // disagree about today's verse.
    expect(VOTD_YEAR.map((entry) => entry.order)).toEqual(
      VOTD_YEAR.map((_entry, index) => index)
    );
    expect(new Set(VOTD_YEAR.map((entry) => entry.id)).size).toBe(365);
  });

  it('carries no duplicate reference, so the year is really 365 days long', () => {
    // prepareVersePool() de-duplicates by book:chapter:verse. A repeat
    // in the source list would quietly shorten the cycle.
    const prepared = prepareVersePool(bundledVerseYear());
    expect(prepared).toHaveLength(365);
  });

  it('resolves every one of its references in English', () => {
    const unresolved = VOTD_YEAR.filter(
      (entry) =>
        resolveVotdScripture(
          { bookId: entry.bookId, chapter: entry.chapter, verse: entry.verse },
          'en'
        ) === null
    );
    expect(unresolved).toEqual([]);
  });

  it('resolves every one of its references in Telugu, the default Bible', () => {
    // A day that is blank for half the congregation is not a day that
    // shipped. The generator refuses such a reference; this is the guard
    // that the generated file is the one in the build.
    const unresolved = VOTD_YEAR.filter(
      (entry) =>
        resolveVotdScripture(
          { bookId: entry.bookId, chapter: entry.chapter, verse: entry.verse },
          'te'
        ) === null
    );
    expect(unresolved).toEqual([]);
  });

  it('draws on most of the canon rather than one corner of it', () => {
    const books = new Set(VOTD_YEAR.map((entry) => entry.bookId));
    expect(books.size).toBeGreaterThanOrEqual(55);
  });
});

describe('a year of mornings', () => {
  it('gives a different verse on all 365 consecutive days', () => {
    // THE CLAIM. Not "usually different" -- every one of them.
    const seen = new Set<string>();
    let date = START;
    for (let day = 0; day < 365; day += 1) {
      seen.add(verseOn(date));
      date = addDays(date, 1)!;
    }
    expect(seen.size).toBe(365);
  });

  it('comes back round on day 366, rather than drifting off the end', () => {
    expect(verseOn(addDays(START, 365)!)).toBe(verseOn(START));
    expect(verseOn(addDays(START, 366)!)).toBe(verseOn(addDays(START, 1)!));
  });

  it('never shows the same verse two mornings running', () => {
    let date = START;
    let previous = verseOn(date);
    for (let day = 1; day < 400; day += 1) {
      date = addDays(date, 1)!;
      const today = verseOn(date);
      expect(today).not.toBe(previous);
      previous = today;
    }
  });

  it('crosses a year boundary without restarting', () => {
    // 31 December to 1 January is an ordinary step. Nothing in the
    // algorithm knows about calendar years -- it counts days since the
    // epoch -- and this is what says so.
    expect(verseOn('2027-01-01')).not.toBe(verseOn('2026-12-31'));
    expect(verseOn('2027-01-01')).toBe(verseOn(addDays('2026-12-31', 1)!));
  });

  it('treats 29 February as the ordinary day it is', () => {
    expect(verseOn('2028-02-29')).toBe(verseOn(addDays('2028-02-28', 1)!));
    expect(verseOn('2028-03-01')).toBe(verseOn(addDays('2028-02-29', 1)!));
    expect(verseOn('2028-02-29')).not.toBe(verseOn('2028-02-28'));
  });

  it('gives every device the same answer for the same date', () => {
    // Two "devices", each resolving independently. There is no server
    // and no stored pick; agreement comes from the arithmetic.
    for (const date of ['2026-01-01', '2026-07-04', '2026-12-31', '2027-06-15']) {
      expect(verseOn(date)).toBe(verseOn(date));
      expect(resolveVotdReference(date, null, null, null)).toEqual(
        resolveVotdReference(date, null, null, null)
      );
    }
  });
});

describe('the church’s own pool still wins', () => {
  const churchPool = [
    {
      id: 'church-1',
      reference: 'Psalm 121:1',
      bookId: 'psalms',
      chapter: 121,
      verse: 1,
      order: 0,
      active: true,
    },
  ];

  it('replaces the built-in year entirely', () => {
    const selection = resolveVotdReference(
      '2026-04-03',
      null,
      { enabled: true, seed: 'maranatha', poolVersion: 1 },
      churchPool
    );
    expect(selection?.source).toBe('pool');
    if (selection?.source !== 'pool') throw new Error('unreachable');
    expect(selection.poolReference).toBe('Psalm 121:1');
  });

  it('and a verse set by hand for the date still beats both', () => {
    const selection = resolveVotdReference(
      '2026-04-03',
      {
        id: '2026-04-03',
        date: '2026-04-03',
        reference: 'Isaiah 53:5',
        text: 'But he was pierced for our transgressions.',
        imageUrl: null,
      },
      { enabled: true, seed: 'maranatha', poolVersion: 1 },
      churchPool
    );
    expect(selection?.source).toBe('override');
  });

  it('falls back to the year when the church has no pool at all', () => {
    const selection = resolveVotdReference(
      '2026-04-03',
      null,
      { enabled: true, seed: 'maranatha', poolVersion: 1 },
      []
    );
    expect(selection?.source).toBe('fallback');
    if (selection?.source !== 'fallback') throw new Error('unreachable');
    expect(VOTD_YEAR.map((entry) => entry.reference)).toContain(selection.poolReference);
  });
});

describe('nothing schedules a verse to a date', () => {
  it('computes any date directly, past or future, in one call', () => {
    // The point of a deterministic rotation: no state to walk forward
    // through, so the admin schedule can list a whole year and a phone
    // that was switched off for a month is not behind.
    const pool = bundledVerseYear();
    const config = { enabled: true, seed: 'maranatha', poolVersion: 1 };
    const far = selectVerseForDate('2035-08-19', config, pool);
    expect(far).not.toBeNull();
    expect(selectVerseForDate('2035-08-19', config, pool)).toEqual(far);
    expect(selectVerseForDate('2019-02-11', config, pool)).not.toBeNull();
  });
});
