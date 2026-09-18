/**
 * Bible module types -- Day 8, updated once English text was sourced.
 *
 * See /BIBLE_LICENSING.md at the repo root for the current licensing
 * status. English renders real World English Bible (public domain) verse
 * text -- see webBible.ts's doc comment for the source/license. Telugu
 * renders real Indian Revised Version (IRV) 2019 verse text (CC BY-SA
 * 4.0) -- see teluguBible.ts's doc comment for the source/license. Two
 * Telugu chapters (Joel 3, Malachi 4) have no real verse text in the
 * source and still render synthetic placeholder text (placeholderData.ts)
 * for just those chapters. Book names, canonical ordering, and chapter
 * counts (books.ts) are NOT scripture text -- they're factual/structural
 * metadata -- so those have always been real and accurate, independent of
 * verse-text sourcing.
 *
 * `getChapter()`/`loadChapter()` in dataSource.ts are the single seam
 * every screen goes through; a future licensed Telugu translation is a
 * change to that one function's data source, not to these types or to
 * any screen.
 */

/**
 * A language the Bible TEXT exists in. This is a data-access key: it
 * selects which bundled translation a lookup reads, so it only ever has
 * one value per read and 'bilingual' is deliberately not part of it.
 */
export type BibleLanguage = 'en' | 'te';

/**
 * What the reader is set to SHOW -- a user preference, not a data key.
 *
 * 'bilingual' pairs both translations through the M1 alignment policy
 * (see ./alignment.ts), which is why it cannot be a BibleLanguage: a
 * bilingual read fetches two chapters and then decides whether they may
 * be paired verse by verse.
 */
export type BibleMode = BibleLanguage | 'bilingual';

/**
 * The language a book NAME, chapter label or search result reference is
 * printed in.
 *
 * For a single-language mode this is simply that language. For bilingual
 * mode the verses carry both translations, so the surrounding labels
 * follow the reader's own APP language instead -- the label is chrome,
 * not scripture, and a Telugu-reading member should not be handed English
 * book names just because they asked to see both texts.
 */
export function bookNameLanguageFor(
  mode: BibleMode,
  appLanguage: BibleLanguage
): BibleLanguage {
  return mode === 'bilingual' ? appLanguage : mode;
}

export type BibleTestament = 'OT' | 'NT';

/** Structural metadata only -- book names/order/chapter counts, not scripture text. */
export interface BibleBook {
  /**
   * Stable slug id, e.g. "genesis", "1-samuel", "song-of-solomon".
   * INTERNAL IDENTIFIER -- never localized and never shown to a user.
   * Route params and the verse-data keys depend on it.
   */
  id: string;
  /** English display name. */
  name: string;
  /**
   * Telugu display name. Added during the V1 tester-feedback pass: the
   * Bible tab's landing screen listed 66 ENGLISH book names even with the
   * Telugu Bible selected, which is what made the Telugu Bible look like
   * it was not being used -- the Telugu verse text underneath had been
   * correct all along. Read it through books.ts's getBookName(), never
   * directly, so a third language is one change in one place.
   */
  nameTe: string;
  testament: BibleTestament;
  /** 1-66, canonical Protestant-canon order (39 OT + 27 NT). */
  order: number;
  chapterCount: number;
}

export interface BibleVerse {
  /** First verse number this unit covers. Canonical; never localized. */
  number: number;
  /**
   * Last verse number this unit covers, when the translation MERGES
   * several verses into a single unit. Absent for an ordinary verse.
   *
   * The Telugu IRV merges 100 verses this way -- Luke 1:39-40 is one
   * translated unit. V1's import dropped the source's `<range>` markers
   * entirely, so the reader showed verse 39 then verse 41 and looked as
   * though scripture were missing; the text was always there, attached
   * to the first verse of the range. Recording the end of the range is
   * what lets the reader honestly print "39-40" instead of losing a
   * number. See scripts/import-telugu-bible.mjs.
   */
  endNumber?: number;
  text: string;
}

export interface BibleChapter {
  bookId: string;
  bookName: string;
  chapterNumber: number;
  language: BibleLanguage;
  verses: BibleVerse[];
  /**
   * True when this chapter has no text in the selected translation, in
   * which case `verses` is empty.
   *
   * Exactly one chapter is in this state: Malachi 4 in Telugu, whose
   * Hebrew-numbered slots are empty in the source corpus. V1 filled it
   * (and Joel 3) with SYNTHETIC placeholder text from a now-deleted
   * module -- invented scripture, behind a warning badge. V2 says
   * plainly that the passage is not in this translation and offers the
   * other one instead.
   */
  unavailableInTranslation: boolean;
}
