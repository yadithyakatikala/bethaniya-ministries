/**
 * The 66-book Protestant Bible canon -- structural metadata only (id,
 * name, testament, canonical order, chapter count). This is NOT
 * scripture text and is not subject to /BIBLE_LICENSING.md's
 * restrictions: book names and chapter counts are objective, universally
 * published facts about a translation-independent canon structure, not
 * copyrightable expression -- see types.ts's doc comment. Chapter counts
 * below sum to 929 (OT) + 260 (NT) = 1189, the well-known total chapter
 * count for this canon; books.test.ts checks this as a data-integrity
 * guard.
 */
import type { BibleBook } from './types';

export const OLD_TESTAMENT_BOOKS: BibleBook[] = [
  { id: 'genesis', name: 'Genesis', testament: 'OT', order: 1, chapterCount: 50 },
  { id: 'exodus', name: 'Exodus', testament: 'OT', order: 2, chapterCount: 40 },
  { id: 'leviticus', name: 'Leviticus', testament: 'OT', order: 3, chapterCount: 27 },
  { id: 'numbers', name: 'Numbers', testament: 'OT', order: 4, chapterCount: 36 },
  { id: 'deuteronomy', name: 'Deuteronomy', testament: 'OT', order: 5, chapterCount: 34 },
  { id: 'joshua', name: 'Joshua', testament: 'OT', order: 6, chapterCount: 24 },
  { id: 'judges', name: 'Judges', testament: 'OT', order: 7, chapterCount: 21 },
  { id: 'ruth', name: 'Ruth', testament: 'OT', order: 8, chapterCount: 4 },
  { id: '1-samuel', name: '1 Samuel', testament: 'OT', order: 9, chapterCount: 31 },
  { id: '2-samuel', name: '2 Samuel', testament: 'OT', order: 10, chapterCount: 24 },
  { id: '1-kings', name: '1 Kings', testament: 'OT', order: 11, chapterCount: 22 },
  { id: '2-kings', name: '2 Kings', testament: 'OT', order: 12, chapterCount: 25 },
  {
    id: '1-chronicles',
    name: '1 Chronicles',
    testament: 'OT',
    order: 13,
    chapterCount: 29,
  },
  {
    id: '2-chronicles',
    name: '2 Chronicles',
    testament: 'OT',
    order: 14,
    chapterCount: 36,
  },
  { id: 'ezra', name: 'Ezra', testament: 'OT', order: 15, chapterCount: 10 },
  { id: 'nehemiah', name: 'Nehemiah', testament: 'OT', order: 16, chapterCount: 13 },
  { id: 'esther', name: 'Esther', testament: 'OT', order: 17, chapterCount: 10 },
  { id: 'job', name: 'Job', testament: 'OT', order: 18, chapterCount: 42 },
  { id: 'psalms', name: 'Psalms', testament: 'OT', order: 19, chapterCount: 150 },
  { id: 'proverbs', name: 'Proverbs', testament: 'OT', order: 20, chapterCount: 31 },
  {
    id: 'ecclesiastes',
    name: 'Ecclesiastes',
    testament: 'OT',
    order: 21,
    chapterCount: 12,
  },
  {
    id: 'song-of-solomon',
    name: 'Song of Solomon',
    testament: 'OT',
    order: 22,
    chapterCount: 8,
  },
  { id: 'isaiah', name: 'Isaiah', testament: 'OT', order: 23, chapterCount: 66 },
  { id: 'jeremiah', name: 'Jeremiah', testament: 'OT', order: 24, chapterCount: 52 },
  {
    id: 'lamentations',
    name: 'Lamentations',
    testament: 'OT',
    order: 25,
    chapterCount: 5,
  },
  { id: 'ezekiel', name: 'Ezekiel', testament: 'OT', order: 26, chapterCount: 48 },
  { id: 'daniel', name: 'Daniel', testament: 'OT', order: 27, chapterCount: 12 },
  { id: 'hosea', name: 'Hosea', testament: 'OT', order: 28, chapterCount: 14 },
  { id: 'joel', name: 'Joel', testament: 'OT', order: 29, chapterCount: 3 },
  { id: 'amos', name: 'Amos', testament: 'OT', order: 30, chapterCount: 9 },
  { id: 'obadiah', name: 'Obadiah', testament: 'OT', order: 31, chapterCount: 1 },
  { id: 'jonah', name: 'Jonah', testament: 'OT', order: 32, chapterCount: 4 },
  { id: 'micah', name: 'Micah', testament: 'OT', order: 33, chapterCount: 7 },
  { id: 'nahum', name: 'Nahum', testament: 'OT', order: 34, chapterCount: 3 },
  { id: 'habakkuk', name: 'Habakkuk', testament: 'OT', order: 35, chapterCount: 3 },
  { id: 'zephaniah', name: 'Zephaniah', testament: 'OT', order: 36, chapterCount: 3 },
  { id: 'haggai', name: 'Haggai', testament: 'OT', order: 37, chapterCount: 2 },
  { id: 'zechariah', name: 'Zechariah', testament: 'OT', order: 38, chapterCount: 14 },
  { id: 'malachi', name: 'Malachi', testament: 'OT', order: 39, chapterCount: 4 },
];

export const NEW_TESTAMENT_BOOKS: BibleBook[] = [
  { id: 'matthew', name: 'Matthew', testament: 'NT', order: 40, chapterCount: 28 },
  { id: 'mark', name: 'Mark', testament: 'NT', order: 41, chapterCount: 16 },
  { id: 'luke', name: 'Luke', testament: 'NT', order: 42, chapterCount: 24 },
  { id: 'john', name: 'John', testament: 'NT', order: 43, chapterCount: 21 },
  { id: 'acts', name: 'Acts', testament: 'NT', order: 44, chapterCount: 28 },
  { id: 'romans', name: 'Romans', testament: 'NT', order: 45, chapterCount: 16 },
  {
    id: '1-corinthians',
    name: '1 Corinthians',
    testament: 'NT',
    order: 46,
    chapterCount: 16,
  },
  {
    id: '2-corinthians',
    name: '2 Corinthians',
    testament: 'NT',
    order: 47,
    chapterCount: 13,
  },
  { id: 'galatians', name: 'Galatians', testament: 'NT', order: 48, chapterCount: 6 },
  { id: 'ephesians', name: 'Ephesians', testament: 'NT', order: 49, chapterCount: 6 },
  { id: 'philippians', name: 'Philippians', testament: 'NT', order: 50, chapterCount: 4 },
  { id: 'colossians', name: 'Colossians', testament: 'NT', order: 51, chapterCount: 4 },
  {
    id: '1-thessalonians',
    name: '1 Thessalonians',
    testament: 'NT',
    order: 52,
    chapterCount: 5,
  },
  {
    id: '2-thessalonians',
    name: '2 Thessalonians',
    testament: 'NT',
    order: 53,
    chapterCount: 3,
  },
  { id: '1-timothy', name: '1 Timothy', testament: 'NT', order: 54, chapterCount: 6 },
  { id: '2-timothy', name: '2 Timothy', testament: 'NT', order: 55, chapterCount: 4 },
  { id: 'titus', name: 'Titus', testament: 'NT', order: 56, chapterCount: 3 },
  { id: 'philemon', name: 'Philemon', testament: 'NT', order: 57, chapterCount: 1 },
  { id: 'hebrews', name: 'Hebrews', testament: 'NT', order: 58, chapterCount: 13 },
  { id: 'james', name: 'James', testament: 'NT', order: 59, chapterCount: 5 },
  { id: '1-peter', name: '1 Peter', testament: 'NT', order: 60, chapterCount: 5 },
  { id: '2-peter', name: '2 Peter', testament: 'NT', order: 61, chapterCount: 3 },
  { id: '1-john', name: '1 John', testament: 'NT', order: 62, chapterCount: 5 },
  { id: '2-john', name: '2 John', testament: 'NT', order: 63, chapterCount: 1 },
  { id: '3-john', name: '3 John', testament: 'NT', order: 64, chapterCount: 1 },
  { id: 'jude', name: 'Jude', testament: 'NT', order: 65, chapterCount: 1 },
  { id: 'revelation', name: 'Revelation', testament: 'NT', order: 66, chapterCount: 22 },
];

export const BIBLE_BOOKS: BibleBook[] = [...OLD_TESTAMENT_BOOKS, ...NEW_TESTAMENT_BOOKS];

const BOOKS_BY_ID = new Map(BIBLE_BOOKS.map((book) => [book.id, book]));

export function getBookById(bookId: string): BibleBook | undefined {
  return BOOKS_BY_ID.get(bookId);
}
