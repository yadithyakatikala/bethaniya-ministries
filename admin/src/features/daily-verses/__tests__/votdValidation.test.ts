import { describe, expect, it } from 'vitest';
import {
  BIBLE_STRUCTURE,
  bookStructureById,
  referenceExists,
  verseCountFor,
} from '../bibleStructure';
import {
  BOOK_OPTIONS,
  formatPoolReference,
  hasErrors,
  validateVersePoolEntry,
  validateVotdConfig,
} from '../votdValidation';

/**
 * Pool validation exists to stop ONE specific failure: a reference in the
 * pool that the app cannot resolve. That is not a visible error -- it is
 * a day on which the congregation silently gets the app's built-in
 * fallback instead of the verse the church chose. So the tests here are
 * about the edges of the canon, not about form ergonomics.
 */
describe('the generated Bible structure', () => {
  it('covers the whole canon', () => {
    expect(BIBLE_STRUCTURE).toHaveLength(66);
    expect(BOOK_OPTIONS[0]).toMatchObject({ id: 'genesis', name: 'Genesis' });
    expect(BOOK_OPTIONS.at(-1)).toMatchObject({ id: 'revelation' });
  });

  it('knows the real verse counts, including the famous ones', () => {
    expect(verseCountFor('psalms', 119)).toBe(176);
    expect(verseCountFor('psalms', 117)).toBe(2);
    expect(verseCountFor('john', 3)).toBe(36);
    expect(bookStructureById('psalms')?.verseCounts).toHaveLength(150);
  });

  it('reports nothing for a book or chapter that does not exist', () => {
    expect(verseCountFor('book-of-mormon', 1)).toBe(0);
    expect(verseCountFor('psalms', 151)).toBe(0);
    expect(verseCountFor('psalms', 0)).toBe(0);
    expect(bookStructureById('nope')).toBeUndefined();
  });

  it('answers whether a whole reference exists', () => {
    expect(referenceExists('john', 3, 16)).toBe(true);
    expect(referenceExists('psalms', 119, 176)).toBe(true);
    expect(referenceExists('psalms', 119, 177)).toBe(false);
    expect(referenceExists('psalms', 151, 1)).toBe(false);
    expect(referenceExists('john', 3, 0)).toBe(false);
  });
});

describe('validating a pool entry', () => {
  it('accepts a real reference', () => {
    expect(validateVersePoolEntry({ bookId: 'john', chapter: 3, verse: 16 })).toEqual({});
  });

  it('rejects a chapter the book does not have, and says how many it has', () => {
    const errors = validateVersePoolEntry({ bookId: 'jude', chapter: 2, verse: 1 });
    expect(errors.chapter).toBe('Jude has 1 chapters.');
  });

  it('rejects a verse the chapter does not have, and says how many it has', () => {
    // Psalm 117 is the shortest chapter in the Bible. Asking for verse 3
    // must fail here rather than becoming a silent fallback day.
    const errors = validateVersePoolEntry({ bookId: 'psalms', chapter: 117, verse: 3 });
    expect(errors.verse).toBe('Psalms 117 has 2 verses.');
  });

  it('accepts the very last verse of the longest chapter', () => {
    expect(
      validateVersePoolEntry({ bookId: 'psalms', chapter: 119, verse: 176 })
    ).toEqual({});
  });

  it('asks for a book before complaining about numbers', () => {
    const errors = validateVersePoolEntry({ bookId: '', chapter: 0, verse: 0 });
    expect(errors.bookId).toBe('Choose a book.');
    expect(errors.chapter).toBeUndefined();
    expect(errors.verse).toBeUndefined();
  });

  it('rejects fractional and negative numbers', () => {
    expect(
      validateVersePoolEntry({ bookId: 'john', chapter: 3.5, verse: 16 }).chapter
    ).toBeDefined();
    expect(
      validateVersePoolEntry({ bookId: 'john', chapter: 3, verse: -1 }).verse
    ).toBeDefined();
  });

  it('builds the display reference rather than trusting a typed one', () => {
    // A typed "Jhon 3:16" would sit in the pool looking almost right.
    expect(formatPoolReference('john', 3, 16)).toBe('John 3:16');
    expect(formatPoolReference('song-of-solomon', 2, 1)).toBe('Song of Solomon 2:1');
    expect(formatPoolReference('nope', 1, 1)).toBe('');
  });
});

describe('validating the configuration', () => {
  it('accepts a sensible seed and version', () => {
    expect(validateVotdConfig({ seed: 'maranatha', poolVersion: 1 })).toEqual({});
    expect(validateVotdConfig({ seed: 'Lent 2026', poolVersion: 12 })).toEqual({});
  });

  it('refuses an empty seed, which would make every church share a sequence', () => {
    expect(validateVotdConfig({ seed: '   ', poolVersion: 1 }).seed).toBeDefined();
  });

  it('refuses a seed the rules would reject anyway', () => {
    expect(validateVotdConfig({ seed: '<script>', poolVersion: 1 }).seed).toBeDefined();
    expect(
      validateVotdConfig({ seed: 'a'.repeat(65), poolVersion: 1 }).seed
    ).toBeDefined();
  });

  it('refuses a version that is not a whole number of one or more', () => {
    expect(validateVotdConfig({ seed: 'x', poolVersion: 0 }).poolVersion).toBeDefined();
    expect(validateVotdConfig({ seed: 'x', poolVersion: 1.5 }).poolVersion).toBeDefined();
    expect(validateVotdConfig({ seed: 'x', poolVersion: NaN }).poolVersion).toBeDefined();
  });

  it('reports whether anything was wrong', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ seed: 'bad' })).toBe(true);
    expect(hasErrors({ seed: undefined })).toBe(false);
  });
});
