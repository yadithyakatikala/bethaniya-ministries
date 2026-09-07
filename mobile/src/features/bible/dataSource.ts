/**
 * The single data-source seam for the Bible module -- Day 8 requirement:
 * "One clean function such as getChapter(bookId, chapterNumber,
 * language). Screens must NOT directly access placeholder/WEB data."
 * BooksListScreen/ChaptersListScreen/ChapterScreen only ever call
 * loadChapter() below; none of them import placeholderData.ts or
 * bibleCache.ts directly. Swapping in a real translation later (WEB, or
 * a licensed Telugu source) means changing getChapter()'s body -- not
 * touching any screen or type.
 *
 * WHY ENGLISH IS STILL PLACEHOLDER TOO (Day 8 sourcing investigation):
 * /BIBLE_LICENSING.md confirms the World English Bible's *license* is
 * public domain (ebible.org/web/, mirrored via get.bible). Before writing
 * real WEB verse text into this repo, that source was investigated for a
 * genuinely bulk, verifiable data file in this environment:
 *   - WebFetch against ebible.org/web/ and its /find/details.php?id=eng-web
 *     page found no verbatim license statement and no concrete download
 *     URL for a structured (USFM/plain-text) data file in the fetched
 *     content.
 *   - get.bible/bible-data-sets/ and a guessed get.bible/eng-web/ page
 *     were checked; neither yielded a usable bulk endpoint from the
 *     fetched content either (the latter 404s).
 *   - More fundamentally: this environment's WebFetch tool does not
 *     return raw page bytes -- per its own description, it "processes the
 *     content with a small, fast model" and returns that model's
 *     response. That means even a successful fetch cannot be trusted to
 *     reproduce scripture text byte-for-byte, which is exactly the kind
 *     of unverified copy Day 8's licensing-safety requirement rules out.
 *   - Bulk-downloading a zip/USFM archive with curl/wget/a script instead
 *     of WebFetch is explicitly disallowed by this environment's web
 *     content rules, and adding a Bible-data npm package is ruled out by
 *     the Day 8 approval's "no new dependencies" scope decision.
 *   - Reconstructing WEB verse text from training-data memory was ruled
 *     out per Day 8's explicit instruction not to guess at scripture text.
 * Conclusion: no safe, verifiable path to real WEB text exists in this
 * environment today. English renders the same clearly-labeled synthetic
 * placeholder as Telugu (placeholderData.ts) until a real data file can
 * be supplied through a verified, human-reviewed channel (e.g. the WEB
 * USFM/text files downloaded and added to the repo directly, outside
 * this sandboxed fetch path) and wired in here.
 */
import { getBookById } from './books';
import { getCachedChapter, setCachedChapter } from './bibleCache';
import { buildPlaceholderVerses } from './placeholderData';
import type { BibleChapter, BibleLanguage } from './types';

/**
 * Pure, synchronous lookup against the current data source (placeholder
 * content for both languages today). Returns null for an unknown book id
 * or a chapter number outside that book's valid range.
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
