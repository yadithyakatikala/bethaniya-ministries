/**
 * Client-side validation for the VOTD configuration and the verse pool.
 *
 * Every rule here has a counterpart in firestore.rules, which is the real
 * boundary; this exists so a mistake is caught while the administrator is
 * still looking at the form rather than as a permission error afterwards.
 *
 * THE POOL RULE THAT MATTERS: a reference must actually exist. "Psalm
 * 151:1" or "John 3:99" in the pool would not be a visible error -- it
 * would be a day on which the congregation silently gets the bundled
 * fallback instead of the verse the church chose. ./bibleStructure.ts
 * carries the real verse counts, derived from the corpus the app ships, so
 * this can say exactly which chapter and how many verses it has.
 */
import { BIBLE_STRUCTURE, bookStructureById, verseCountFor } from './bibleStructure';

export const VOTD_SEED_MAX_LENGTH = 64;
export const VOTD_POOL_VERSION_MAX = 100000;
/** Matches firestore.rules' isValidVotdConfig() -- hashed, never rendered,
 *  but stored on a document every member reads on every app open. */
const SEED_PATTERN = /^[A-Za-z0-9 ._-]+$/;

export interface VotdConfigErrors {
  seed?: string;
  poolVersion?: string;
}

export function validateVotdConfig(input: {
  seed: string;
  poolVersion: number;
}): VotdConfigErrors {
  const errors: VotdConfigErrors = {};

  const seed = input.seed.trim();
  if (seed.length === 0) {
    errors.seed = 'A seed is required.';
  } else if (seed.length > VOTD_SEED_MAX_LENGTH) {
    errors.seed = `Seed must be ${VOTD_SEED_MAX_LENGTH} characters or fewer.`;
  } else if (!SEED_PATTERN.test(seed)) {
    errors.seed = 'Seed may use letters, numbers, spaces, dots, hyphens and underscores.';
  }

  if (!Number.isInteger(input.poolVersion) || input.poolVersion < 1) {
    errors.poolVersion = 'Pool version must be a whole number of 1 or more.';
  } else if (input.poolVersion > VOTD_POOL_VERSION_MAX) {
    errors.poolVersion = `Pool version must be ${VOTD_POOL_VERSION_MAX} or less.`;
  }

  return errors;
}

export interface VersePoolEntryErrors {
  bookId?: string;
  chapter?: string;
  verse?: string;
}

export function validateVersePoolEntry(input: {
  bookId: string;
  chapter: number;
  verse: number;
}): VersePoolEntryErrors {
  const errors: VersePoolEntryErrors = {};

  const book = bookStructureById(input.bookId);
  if (!book) {
    errors.bookId = 'Choose a book.';
    // Without a book there is nothing to check a chapter or verse against.
    return errors;
  }

  if (!Number.isInteger(input.chapter) || input.chapter < 1) {
    errors.chapter = 'Chapter must be a whole number of 1 or more.';
  } else if (input.chapter > book.verseCounts.length) {
    errors.chapter = `${book.name} has ${book.verseCounts.length} chapters.`;
  }

  const verseCount = verseCountFor(input.bookId, input.chapter);
  if (!Number.isInteger(input.verse) || input.verse < 1) {
    errors.verse = 'Verse must be a whole number of 1 or more.';
  } else if (verseCount > 0 && input.verse > verseCount) {
    errors.verse = `${book.name} ${input.chapter} has ${verseCount} verses.`;
  }

  return errors;
}

/**
 * The display reference for a pool entry, built from the structure table
 * rather than typed -- so the pool cannot contain "Jhon 3:16", and the
 * reference always agrees with the bookId/chapter/verse beside it.
 */
export function formatPoolReference(
  bookId: string,
  chapter: number,
  verse: number
): string {
  const book = bookStructureById(bookId);
  return book ? `${book.name} ${chapter}:${verse}` : '';
}

/** Every book, in canonical order -- what the book selector renders. */
export const BOOK_OPTIONS = BIBLE_STRUCTURE.map((book) => ({
  id: book.id,
  name: book.name,
  chapterCount: book.verseCounts.length,
}));

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some((value) => value !== undefined);
}
