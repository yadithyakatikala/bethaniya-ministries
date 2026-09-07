/**
 * Bible module types -- Day 8.
 *
 * See /BIBLE_LICENSING.md at the repo root for the current licensing
 * status. Per the Day 8 approval: a verifiable, bulk, license-confirmed
 * source for the World English Bible's actual verse text could not be
 * safely obtained in this sandboxed environment (see dataSource.ts's doc
 * comment for exactly why), so BOTH languages render synthetic
 * placeholder verse text today -- English is not exempt just because its
 * *license* is confirmed; only its *text* is what's missing. Book names,
 * canonical ordering, and chapter counts (books.ts) are NOT scripture
 * text -- they're factual/structural metadata -- so those are real and
 * accurate even while verse text stays placeholder.
 *
 * `getChapter()`/`loadChapter()` in dataSource.ts are the single seam
 * every screen goes through; swapping in a real translation later (WEB
 * once safely sourced, or a licensed Telugu translation) is a change to
 * that one function's data source, not to these types or to any screen.
 */

export type BibleLanguage = 'en' | 'te';

export type BibleTestament = 'OT' | 'NT';

/** Structural metadata only -- book names/order/chapter counts, not scripture text. */
export interface BibleBook {
  /** Stable slug id, e.g. "genesis", "1-samuel", "song-of-solomon". */
  id: string;
  name: string;
  testament: BibleTestament;
  /** 1-66, canonical Protestant-canon order (39 OT + 27 NT). */
  order: number;
  chapterCount: number;
}

export interface BibleVerse {
  number: number;
  text: string;
}

export interface BibleChapter {
  bookId: string;
  bookName: string;
  chapterNumber: number;
  language: BibleLanguage;
  verses: BibleVerse[];
  /**
   * True for every chapter today (see this file's top comment). Kept
   * per-chapter, not a module-wide constant, so a future data source
   * that's real for some books/languages and not others (e.g. WEB
   * integrated for English while Telugu is still pending) can be
   * represented and labeled correctly without a type change.
   */
  isPlaceholder: boolean;
}
