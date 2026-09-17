import { BIBLE_BOOKS } from '../books';
import { getTeluguSpans, getTeluguVerses } from '../teluguBible';

/**
 * The Telugu IRV 2019 accessor, after the V2 re-import.
 *
 * WHAT CHANGED FROM V1, AND WHY THESE EXPECTATIONS MOVED.
 * V1's import kept only source lines carrying text, discarding the
 * `<range>` (merged verse) and empty (absent in this versification)
 * markers. Two consequences were baked into the tests that used to live
 * here, and both were wrong about the data:
 *
 *   1. Joel 3 was believed to have NO Telugu text. It does -- 5 verses.
 *      V1's import lost them. (The chapter is still classified
 *      'divergent' for BILINGUAL purposes, because the IRV follows
 *      Hebrew chapter division in Joel, but single-language reading of
 *      it works and always should have.)
 *
 *   2. Verse numbers were believed to be "ascending, not necessarily
 *      contiguous", with the gaps explained away as "combined numbering
 *      at the high end of some chapters". They were mid-chapter holes
 *      caused by the dropped range markers -- Luke 1 lost 40, 49, 55,
 *      71, 72, 73, 75, 77 and 78.
 *
 * Exactly one canonical chapter genuinely has no Telugu text: Malachi 4,
 * whose Hebrew-numbered slots are empty upstream. See teluguBible.ts and
 * scripts/import-telugu-bible.mjs.
 */
const CHAPTERS_WITHOUT_TELUGU_TEXT = new Set(['malachi:4']);

describe('getTeluguVerses', () => {
  it('returns real verse text for every canonical chapter but Malachi 4', () => {
    let checked = 0;
    let realChapters = 0;
    for (const book of BIBLE_BOOKS) {
      for (let chapterNumber = 1; chapterNumber <= book.chapterCount; chapterNumber += 1) {
        checked += 1;
        const verses = getTeluguVerses(book.order, chapterNumber);
        if (CHAPTERS_WITHOUT_TELUGU_TEXT.has(`${book.id}:${chapterNumber}`)) {
          expect(verses).toBeUndefined();
        } else {
          expect(verses).toBeDefined();
          expect(verses!.length).toBeGreaterThan(0);
          realChapters += 1;
        }
      }
    }
    expect(checked).toBe(1189);
    expect(realChapters).toBe(1189 - CHAPTERS_WITHOUT_TELUGU_TEXT.size);
    expect(realChapters).toBe(1188);
  });

  it('has real Telugu text for Joel 3, which V1 wrongly reported as empty', () => {
    const verses = getTeluguVerses(29, 3);
    expect(verses).toBeDefined();
    expect(verses!.length).toBe(5);
    expect(verses![0].text.length).toBeGreaterThan(0);
  });

  it('numbers every chapter contiguously from 1, with no mid-chapter holes', () => {
    // This is the assertion V1 could not make. A hole here means the
    // import has dropped a range marker again.
    const holes: string[] = [];
    for (const book of BIBLE_BOOKS) {
      for (let chapterNumber = 1; chapterNumber <= book.chapterCount; chapterNumber += 1) {
        const verses = getTeluguVerses(book.order, chapterNumber);
        if (!verses) continue;
        let expected = 1;
        for (const verse of verses) {
          if (verse.number !== expected) {
            holes.push(`${book.id} ${chapterNumber}: expected ${expected}, got ${verse.number}`);
            break;
          }
          expected = (verse.endNumber ?? verse.number) + 1;
        }
      }
    }
    expect(holes).toEqual([]);
  });

  it('carries both ends of a merged range, e.g. Luke 1:39-40', () => {
    const verses = getTeluguVerses(42, 1);
    const merged = verses!.find((verse) => verse.number === 39);
    expect(merged).toMatchObject({ number: 39, endNumber: 40 });
  });

  it('gives an ordinary verse no endNumber at all', () => {
    const verses = getTeluguVerses(1, 1);
    expect(verses![0]).toEqual({
      number: 1,
      text: 'ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.',
    });
    expect(verses![0].endNumber).toBeUndefined();
  });

  it('returns undefined for a book/chapter outside the dataset', () => {
    expect(getTeluguVerses(999, 1)).toBeUndefined();
    expect(getTeluguVerses(1, 999)).toBeUndefined();
  });
});

describe('getTeluguSpans', () => {
  it('exposes spans with explicit start and end for the bilingual reader', () => {
    const spans = getTeluguSpans(42, 1);
    expect(spans).toBeDefined();
    const merged = spans!.find((span) => span.start === 39);
    expect(merged).toEqual({
      start: 39,
      end: 40,
      text: expect.stringMatching(/\S/),
    });
  });

  it('never overlaps or reverses a span, in any chapter', () => {
    const problems: string[] = [];
    for (const book of BIBLE_BOOKS) {
      for (let chapterNumber = 1; chapterNumber <= book.chapterCount; chapterNumber += 1) {
        const spans = getTeluguSpans(book.order, chapterNumber);
        if (!spans) continue;
        let previousEnd = 0;
        for (const span of spans) {
          if (span.end < span.start || span.start <= previousEnd) {
            problems.push(`${book.id} ${chapterNumber}: ${span.start}-${span.end}`);
          }
          previousEnd = span.end;
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('returns undefined for the one chapter with no Telugu text', () => {
    expect(getTeluguSpans(39, 4)).toBeUndefined();
  });
});
