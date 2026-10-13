import { BIBLE_BOOKS } from '../bible/books';

/** Where in the Bible a plan day's reading begins. */
export interface ReadingTarget {
  bookId: string;
  chapterNumber: number;
  /** The first verse of the passage, when the reference names one ("Luke 1:26-56" -> 26). */
  verse?: number;
}

/**
 * Spellings a church writes that are not a book's catalogue name. A plan says
 * "Psalm 23" (the catalogue says Psalms) and some write "Song of Songs".
 */
const ALIASES: Record<string, string> = {
  psalm: 'psalms',
  'song of songs': 'song-of-solomon',
  'songs of solomon': 'song-of-solomon',
  revelations: 'revelation',
};

/** Every way of naming a book, longest first so "1 John" is tried before "John". */
const NAMES: { name: string; bookId: string }[] = BIBLE_BOOKS.flatMap((book) => [
  { name: book.name.toLowerCase(), bookId: book.id },
  { name: book.nameTe.toLowerCase(), bookId: book.id },
]).concat(Object.entries(ALIASES).map(([name, bookId]) => ({ name, bookId })));
NAMES.sort((a, b) => b.name.length - a.name.length);

/**
 * Reads the passage a plan day points at and says where to open the Bible.
 *
 * A reference is a book, a chapter and perhaps verses: "Psalm 23",
 * "Luke 1:26-56", "Romans 8:1-17". Several passages ("Psalm 23; John 10:11-18")
 * open at the FIRST, which is where the day's reading begins. The book may be
 * written in English or in Telugu. Anything that is not a book the app has, or a
 * chapter that book has, is `null` -- the caller shows the reading as words and
 * offers nothing to open, rather than opening the wrong place.
 */
export function parsePlanReference(reference: string): ReadingTarget | null {
  const first = (reference.split(/[;,]/)[0] ?? '').trim().replace(/\s+/g, ' ');
  const lower = first.toLowerCase();
  for (const { name, bookId } of NAMES) {
    if (!lower.startsWith(`${name} `)) continue;
    const rest = first.slice(name.length).trim();
    const match = /^(\d+)(?::(\d+))?/.exec(rest);
    if (!match) return null;
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    const chapterNumber = Number(match[1]);
    if (!book || chapterNumber < 1 || chapterNumber > book.chapterCount) return null;
    return {
      bookId,
      chapterNumber,
      ...(match[2] ? { verse: Number(match[2]) } : {}),
    };
  }
  return null;
}
