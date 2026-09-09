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

  /**
   * STRICT completeness requirement: every one of the 1189 canonical
   * chapters must have real Telugu verse text. This test has NO
   * carve-out for Joel 3 / Malachi 4 -- it is expected to FAIL for those
   * two chapters as of this commit. It is committed failing, on purpose,
   * rather than weakened to pass, because a green suite that quietly
   * excuses missing scripture is worse than a red test that tells the
   * truth. See teluguBible.ts's doc comment and BIBLE_LICENSING.md's
   * "Investigation: are Joel 3 / Malachi 4 hiding elsewhere?" section for
   * the full investigation proving this is a genuine gap in the only
   * legally-usable source found (not a versification-mapping error, not
   * an extraction bug this app introduced) that could not be resolved
   * without either fabricating text or reaching eBible.org directly
   * (blocked from every environment this project has had access to).
   * Do not delete, weaken, or add a KNOWN_GAPS-style exception to this
   * test to make it pass -- fix it only by importing real recovered
   * text for these two chapters from a verified source, or by removing
   * it if the project's Telugu-completeness bar is deliberately
   * relaxed by a human decision (not by an AI editing this file).
   */
  it('has real, non-empty verse text for every one of the 1189 canonical chapters (no exceptions)', () => {
    const empty: string[] = [];
    for (const book of BIBLE_BOOKS) {
      for (
        let chapterNumber = 1;
        chapterNumber <= book.chapterCount;
        chapterNumber += 1
      ) {
        const verses = getTeluguVerses(book.order, chapterNumber);
        if (!verses || verses.length === 0) {
          empty.push(`${book.id} ${chapterNumber}`);
        }
      }
    }
    expect(empty).toEqual([]);
  });
});
