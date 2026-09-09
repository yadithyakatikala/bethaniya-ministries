import { BIBLE_BOOKS } from '../books';
import { getTeluguVerses } from '../teluguBible';

// The two chapters (English versification) with no real verse text in the
// imported source -- see teluguBible.ts's doc comment for why. Every other
// book/chapter combination in the 66-book canon is expected to resolve to
// real text.
const KNOWN_GAPS = new Set(['joel:3', 'malachi:4']);

describe('getTeluguVerses', () => {
  it('returns real verse text for every book/chapter except the two documented gaps', () => {
    let checked = 0;
    let realChapters = 0;
    for (const book of BIBLE_BOOKS) {
      for (
        let chapterNumber = 1;
        chapterNumber <= book.chapterCount;
        chapterNumber += 1
      ) {
        checked += 1;
        const verses = getTeluguVerses(book.order, chapterNumber);
        if (KNOWN_GAPS.has(`${book.id}:${chapterNumber}`)) {
          expect(verses).toBeUndefined();
        } else {
          expect(verses).toBeDefined();
          expect(verses!.length).toBeGreaterThan(0);
          realChapters += 1;
        }
      }
    }
    expect(checked).toBe(1189);
    expect(realChapters).toBe(1189 - KNOWN_GAPS.size);
  });

  it('returns verses with explicit, ascending (not necessarily contiguous) verse numbers', () => {
    const verses = getTeluguVerses(1, 1); // Genesis 1
    expect(verses).toBeDefined();
    for (let i = 1; i < verses!.length; i++) {
      expect(verses![i].number).toBeGreaterThan(verses![i - 1].number);
    }
  });

  it('returns the correct real text for Genesis 1:1', () => {
    const verses = getTeluguVerses(1, 1);
    expect(verses?.[0]).toEqual({
      number: 1,
      text: 'ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.',
    });
  });

  it('returns undefined (not an empty array) for the two documented gap chapters', () => {
    expect(getTeluguVerses(29, 3)).toBeUndefined(); // Joel 3 (order 29)
    expect(getTeluguVerses(39, 4)).toBeUndefined(); // Malachi 4 (order 39)
  });

  it('returns undefined for a book/chapter combination outside the dataset', () => {
    expect(getTeluguVerses(999, 1)).toBeUndefined();
    expect(getTeluguVerses(1, 999)).toBeUndefined();
  });
});
