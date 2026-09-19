/**
 * The single data-source seam for the Bible module -- Day 8 requirement:
 * "One clean function such as getChapter(bookId, chapterNumber,
 * language). Screens must NOT directly access placeholder/WEB data."
 * BooksListScreen/ChaptersListScreen/the reader only ever call
 * loadChapter() below; none of them import placeholderData.ts,
 * webBible.ts, or bibleCache.ts directly. Swapping in a real translation
 * (or a future licensed Telugu source) is a change to this one
 * function's body -- not to any screen or type.
 *
 * ENGLISH: resolved. Real World English Bible (WEB, public domain) verse
 * text is now imported -- see webBible.ts's doc comment for the exact
 * source, license, and completeness verification, and
 * /BIBLE_LICENSING.md for the full writeup.
 *
 * TELUGU: resolved. Real Indian Revised Version (IRV) 2019 verse text
 * (CC BY-SA 4.0) -- see teluguBible.ts's doc comment for the source,
 * licence, and what V1's import got wrong.
 *
 * NO SYNTHETIC SCRIPTURE. V1 filled the chapters its Telugu data lacked
 * with generated placeholder text from a `placeholderData.ts` module,
 * behind a warning badge. That module is deleted: a Bible app must not
 * render invented verses, badge or no badge. One canonical chapter has no
 * Telugu text in the source (Malachi 4), and it now returns an empty
 * chapter flagged `unavailableInTranslation` so the reader can say so and
 * offer the other translation.
 */
import { getBookById } from './books';
import { getCachedChapter, setCachedChapter } from './bibleCache';
import { getWebVerseTexts } from './webBible';
import { getTeluguSpans, getTeluguVerses } from './teluguBible';
import { buildBilingualChapter, type BilingualPresentation } from './alignment';
import type { BibleChapter, BibleLanguage, BibleVerse } from './types';

/**
 * Pure, synchronous lookup of ONE translation. Returns null for an
 * unknown book id or a chapter number outside that book's valid range.
 * For both translations paired, see getBilingualChapter() below.
 */
export function getChapter(
  bookId: string,
  chapterNumber: number,
  language: BibleLanguage
): BibleChapter | null {
  const book = getBookById(bookId);
  if (!book) return null;
  if (
    !Number.isInteger(chapterNumber) ||
    chapterNumber < 1 ||
    chapterNumber > book.chapterCount
  ) {
    return null;
  }

  if (language === 'en') {
    const texts = getWebVerseTexts(book.order, chapterNumber);
    if (texts) {
      const verses: BibleVerse[] = texts.map((text, index) => ({
        number: index + 1,
        text,
      }));
      return {
        bookId: book.id,
        bookName: book.name,
        chapterNumber,
        language,
        verses,
        unavailableInTranslation: false,
      };
    }
    // Defensive fallback only -- every valid book/chapter combination is
    // covered by the imported WEB dataset (verified at import time), so
    // this branch should be unreachable in practice.
  }

  if (language === 'te') {
    const verses = getTeluguVerses(book.order, chapterNumber);
    if (verses) {
      return {
        bookId: book.id,
        bookName: book.name,
        chapterNumber,
        language,
        verses,
        unavailableInTranslation: false,
      };
    }
    // Reached for exactly one of 1189 chapters -- Malachi 4, whose
    // Hebrew-numbered slots are empty in the source. See teluguBible.ts.
  }

  // The selected translation has no text for this chapter. An empty
  // chapter, honestly flagged, rather than generated filler.
  return {
    bookId: book.id,
    bookName: book.name,
    chapterNumber,
    language,
    verses: [],
    unavailableInTranslation: true,
  };
}

/**
 * What screens actually call: cache-first read, falling back to
 * getChapter() and writing a successful result back to cache. Returns
 * null (without touching the cache) for an invalid book/chapter -- there
 * is nothing successful to cache.
 */
export async function loadChapter(
  bookId: string,
  chapterNumber: number,
  language: BibleLanguage
): Promise<BibleChapter | null> {
  const cached = await getCachedChapter(bookId, chapterNumber, language);
  if (cached) return cached;

  const chapter = getChapter(bookId, chapterNumber, language);
  if (chapter) {
    await setCachedChapter(chapter);
  }
  return chapter;
}

/**
 * A chapter in BOTH translations, paired through the M1 alignment policy.
 *
 * This is the bilingual reader's only data entry point. It deliberately
 * does not decide anything about pairing itself -- it fetches the two
 * chapters and hands them to buildBilingualChapter(), whose single rule
 * is that an English verse is never placed beside a Telugu verse unless
 * the pairing can be proven. See ./alignment.ts.
 *
 * Returns null for an unknown book or an out-of-range chapter, matching
 * getChapter(). The English side always exists for a valid reference; the
 * Telugu side may legitimately be absent (Malachi 4), which the policy
 * reports as `englishOnly` rather than inventing text.
 */
export function getBilingualChapter(
  bookId: string,
  chapterNumber: number
): { bookId: string; chapterNumber: number; presentation: BilingualPresentation } | null {
  const book = getBookById(bookId);
  if (!book) return null;
  if (
    !Number.isInteger(chapterNumber) ||
    chapterNumber < 1 ||
    chapterNumber > book.chapterCount
  ) {
    return null;
  }

  const englishTexts = getWebVerseTexts(book.order, chapterNumber) ?? [];
  const englishVerses: BibleVerse[] = englishTexts.map((text, index) => ({
    number: index + 1,
    text,
  }));
  const teluguSpans = getTeluguSpans(book.order, chapterNumber) ?? null;

  return {
    bookId: book.id,
    chapterNumber,
    presentation: buildBilingualChapter(
      book.order,
      chapterNumber,
      englishVerses,
      teluguSpans
    ),
  };
}
