/**
 * The single data-source seam for the Bible module -- Day 8 requirement:
 * "One clean function such as getChapter(bookId, chapterNumber,
 * language). Screens must NOT directly access placeholder/WEB data."
 * BooksListScreen/ChaptersListScreen/ChapterScreen only ever call
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
 * TELUGU: still blocked. No Telugu source has been confirmed usable (see
 * /BIBLE_LICENSING.md's "Telugu Bible" section) -- Telugu continues to
 * render the same clearly-labeled synthetic placeholder text
 * (placeholderData.ts) it always has, pending either direct written
 * confirmation from a rights holder (e.g. the Bible Society of India) or
 * a verified, licensed alternative source.
 */
import { getBookById } from './books';
import { getCachedChapter, setCachedChapter } from './bibleCache';
import { buildPlaceholderVerses } from './placeholderData';
import { getWebVerseTexts } from './webBible';
import type { BibleChapter, BibleLanguage, BibleVerse } from './types';

/**
 * Pure, synchronous lookup against the current data source -- real WEB
 * text for English, synthetic placeholder for Telugu (see this module's
 * doc comment). Returns null for an unknown book id or a chapter number
 * outside that book's valid range.
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
        isPlaceholder: false,
      };
    }
    // Defensive fallback only -- every valid book/chapter combination is
    // covered by the imported WEB dataset (verified at import time), so
    // this branch should be unreachable in practice.
  }

  return {
    bookId: book.id,
    bookName: book.name,
    chapterNumber,
    language,
    verses: buildPlaceholderVerses(book.order, chapterNumber, language),
    isPlaceholder: true,
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
