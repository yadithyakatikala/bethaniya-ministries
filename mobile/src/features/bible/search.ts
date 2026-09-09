/**
 * Bible Search's data-source seam -- Day 9 decision 1 (Option A): "search
 * the entire locally-available placeholder dataset, not just cached
 * chapters." Every book/chapter is looked up via dataSource.ts's
 * getChapter() -- the exact same seam BooksListScreen/ChaptersListScreen/
 * ChapterScreen already go through (see dataSource.ts's own doc comment:
 * "screens must NOT directly access placeholder/WEB data") -- so this
 * file never imports placeholderData.ts directly either, and swapping in
 * a real translation later (WEB, or a licensed Telugu source) makes
 * search see the new text automatically, with zero changes here.
 *
 * getChapter() is pure and synchronous (no I/O, no cache), so searching
 * "the entire" dataset means iterating every real book/chapter
 * combination (66 books, 1189 chapters total -- see books.ts) and
 * checking each chapter's (placeholder-pool-backed) verses -- a few
 * thousand cheap string comparisons, well within what a single
 * synchronous pass can do per keystroke without a fuzzy-search
 * dependency (Day 9 decision 17 explicitly rules one out) or any
 * network/download step (decision 1: never make search depend on
 * downloading the whole Bible remotely).
 *
 * Matching is plain, case-insensitive substring matching -- against
 * either a verse's text or its reference ("Genesis 1:2"). English now
 * searches real World English Bible text (see webBible.ts); Telugu still
 * searches synthetic placeholder text (placeholderData.ts) until a
 * licensed Telugu source is found -- reference matching remains how a
 * user finds a specific Telugu passage by book name in the meantime. The
 * search architecture itself never changed when English's text source
 * did; only the strings being matched against read differently now.
 */
import { NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS } from './books';
import { getChapter } from './dataSource';
import type { BibleLanguage } from './types';

export interface BibleSearchResult {
  bookId: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  reference: string;
  text: string;
  /** Which field the query actually matched -- the screen only
   * highlights within this field. */
  matchSource: 'text' | 'reference';
  matchStart: number;
  matchLength: number;
}

const ALL_BOOKS = [...OLD_TESTAMENT_BOOKS, ...NEW_TESTAMENT_BOOKS];

/** Caps how many results a single (very broad, e.g. one-letter) query can
 * return -- a UI/performance safeguard, not a claim about relevance
 * ranking (results are returned in canonical book/chapter/verse order). */
export const MAX_SEARCH_RESULTS = 50;

export function searchBible(query: string, language: BibleLanguage): BibleSearchResult[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) return [];
  const needle = trimmedQuery.toLowerCase();
  const results: BibleSearchResult[] = [];

  for (const book of ALL_BOOKS) {
    for (let chapterNumber = 1; chapterNumber <= book.chapterCount; chapterNumber += 1) {
      const chapter = getChapter(book.id, chapterNumber, language);
      if (!chapter) continue;

      for (const verse of chapter.verses) {
        const reference = `${book.name} ${chapterNumber}:${verse.number}`;
        const textMatchStart = verse.text.toLowerCase().indexOf(needle);

        if (textMatchStart !== -1) {
          results.push({
            bookId: book.id,
            bookName: book.name,
            chapterNumber,
            verseNumber: verse.number,
            reference,
            text: verse.text,
            matchSource: 'text',
            matchStart: textMatchStart,
            matchLength: trimmedQuery.length,
          });
        } else {
          const referenceMatchStart = reference.toLowerCase().indexOf(needle);
          if (referenceMatchStart !== -1) {
            results.push({
              bookId: book.id,
              bookName: book.name,
              chapterNumber,
              verseNumber: verse.number,
              reference,
              text: verse.text,
              matchSource: 'reference',
              matchStart: referenceMatchStart,
              matchLength: trimmedQuery.length,
            });
          }
        }

        if (results.length >= MAX_SEARCH_RESULTS) return results;
      }
    }
  }

  return results;
}
