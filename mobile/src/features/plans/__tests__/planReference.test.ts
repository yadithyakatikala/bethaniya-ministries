import { readFileSync } from 'fs';
import { join } from 'path';
import { SEED_PLANS } from '../seedPlans';
import { parsePlanReference } from '../planReference';
import { BIBLE_BOOKS } from '../../bible/books';

describe('parsePlanReference', () => {
  it('opens a whole chapter at its first verse', () => {
    expect(parsePlanReference('Psalm 23')).toEqual({
      bookId: 'psalms',
      chapterNumber: 23,
    });
    expect(parsePlanReference('Luke 15')).toEqual({ bookId: 'luke', chapterNumber: 15 });
  });

  it('opens a passage at the chapter and the verse it begins on', () => {
    expect(parsePlanReference('Luke 1:26-56')).toEqual({
      bookId: 'luke',
      chapterNumber: 1,
      verse: 26,
    });
    expect(parsePlanReference('Romans 8:28-39')).toEqual({
      bookId: 'romans',
      chapterNumber: 8,
      verse: 28,
    });
  });

  it('reads books whose names begin with a number, without mistaking them for the book after it', () => {
    expect(parsePlanReference('1 Peter 5:6-11')).toEqual({
      bookId: '1-peter',
      chapterNumber: 5,
      verse: 6,
    });
    expect(parsePlanReference('1 John 1:5')).toMatchObject({ bookId: '1-john' });
    expect(parsePlanReference('John 3:16')).toMatchObject({ bookId: 'john' });
  });

  it('opens at the FIRST of several passages', () => {
    expect(parsePlanReference('Isaiah 7:14; Matthew 1:18-25')).toEqual({
      bookId: 'isaiah',
      chapterNumber: 7,
      verse: 14,
    });
    expect(parsePlanReference('Psalm 23; John 10:11-18')).toEqual({
      bookId: 'psalms',
      chapterNumber: 23,
    });
  });

  it('is not case sensitive, and tolerates extra spaces', () => {
    expect(parsePlanReference('  psalm   46 ')).toEqual({
      bookId: 'psalms',
      chapterNumber: 46,
    });
  });

  it('reads a book written in Telugu', () => {
    const luke = BIBLE_BOOKS.find((b) => b.id === 'luke');
    expect(parsePlanReference(`${luke?.nameTe} 2:1-20`)).toEqual({
      bookId: 'luke',
      chapterNumber: 2,
      verse: 1,
    });
  });

  it('accepts the other common spellings of a book', () => {
    expect(parsePlanReference('Song of Songs 2')).toEqual({
      bookId: 'song-of-solomon',
      chapterNumber: 2,
    });
  });

  it('is null for anything that is not a book and a chapter the app has', () => {
    expect(parsePlanReference('')).toBeNull();
    expect(parsePlanReference('Nonsense 4')).toBeNull();
    expect(parsePlanReference('Psalm')).toBeNull();
    expect(parsePlanReference('Psalm 151')).toBeNull();
    expect(parsePlanReference('Psalm 0')).toBeNull();
    expect(parsePlanReference('Jude 2')).toBeNull();
  });

  it('opens EVERY reading in the plans that ship with the app', () => {
    // The bundled plans are the ones every member has; a reading that opens
    // nothing would be a button that does nothing.
    const unreadable: string[] = [];
    for (const plan of SEED_PLANS) {
      for (const day of plan.days) {
        if (!parsePlanReference(day.scriptureReference)) {
          unreadable.push(`${plan.id}: ${day.scriptureReference}`);
        }
      }
    }
    expect(unreadable).toEqual([]);
  });
});

/**
 * THE CROSS-PACKAGE GUARD.
 *
 * The admin dashboard validates a plan day's reading with its own parser
 * (admin/src/features/plans/passages.ts) and stores a canonical string; this
 * app opens the Bible from that string. The packages share no code, so a
 * reading the dashboard accepts but this app cannot open would be a Read
 * button that silently does nothing -- and neither suite alone could notice.
 * Both replay the SAME file. Change either parser and one suite fails.
 */
interface Vector {
  text: string;
  admin: boolean;
  mobile: { bookId: string; chapterNumber: number; verse?: number } | null;
}

const VECTORS = (
  JSON.parse(
    readFileSync(join(__dirname, 'plan-reference-vectors.json'), 'utf8')
  ) as { vectors: Vector[] }
).vectors;

describe('the reference vectors shared with the admin dashboard', () => {
  it.each(VECTORS.map((vector) => [vector.text, vector] as const))(
    'opens %j where the vector says',
    (_text, vector) => {
      expect(parsePlanReference(vector.text)).toEqual(vector.mobile);
    }
  );

  it('opens every reading the dashboard accepts', () => {
    const accepted = VECTORS.filter((vector) => vector.admin);
    expect(accepted.length).toBeGreaterThan(10);
    for (const vector of accepted) {
      expect(parsePlanReference(vector.text)).not.toBeNull();
    }
  });
});
