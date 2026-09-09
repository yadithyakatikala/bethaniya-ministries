/**
 * Bible module types -- Day 8, updated once English text was sourced.
 *
 * See /BIBLE_LICENSING.md at the repo root for the current licensing
 * status. English now renders real World English Bible (public domain)
 * verse text -- see webBible.ts's doc comment for the source/license.
 * Telugu still renders synthetic placeholder text (placeholderData.ts);
 * no Telugu source has been confirmed usable yet. Book names, canonical
 * ordering, and chapter counts (books.ts) are NOT scripture text --
 * they're factual/structural metadata -- so those have always been real
 * and accurate, independent of verse-text sourcing.
 *
 * `getChapter()`/`loadChapter()` in dataSource.ts are the single seam
 * every screen goes through; a future licensed Telugu translation is a
 * change to that one function's data source, not to these types or to
 * any screen.
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
