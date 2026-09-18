import {
  BIBLE_BOOKS,
  OLD_TESTAMENT_BOOKS,
  NEW_TESTAMENT_BOOKS,
  getBookById,
} from '../books';
import { bookNameLanguageFor } from '../types';

describe('BIBLE_BOOKS', () => {
  it('contains exactly 66 books', () => {
    expect(BIBLE_BOOKS.length).toBe(66);
  });

  it('splits into 39 Old Testament and 27 New Testament books, each tagged correctly', () => {
    expect(OLD_TESTAMENT_BOOKS.length).toBe(39);
    expect(NEW_TESTAMENT_BOOKS.length).toBe(27);
    expect(OLD_TESTAMENT_BOOKS.every((book) => book.testament === 'OT')).toBe(true);
    expect(NEW_TESTAMENT_BOOKS.every((book) => book.testament === 'NT')).toBe(true);
  });

  it('has unique book ids', () => {
    const ids = BIBLE_BOOKS.map((book) => book.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is ordered 1-66 with no gaps or duplicates, Genesis first and Revelation last', () => {
    const orders = BIBLE_BOOKS.map((book) => book.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    expect(BIBLE_BOOKS.find((book) => book.order === 1)?.id).toBe('genesis');
    expect(BIBLE_BOOKS.find((book) => book.order === 39)?.id).toBe('malachi');
    expect(BIBLE_BOOKS.find((book) => book.order === 40)?.id).toBe('matthew');
    expect(BIBLE_BOOKS.find((book) => book.order === 66)?.id).toBe('revelation');
  });

  it('has positive chapter counts summing to the known 1189-chapter total', () => {
    for (const book of BIBLE_BOOKS) {
      expect(book.chapterCount).toBeGreaterThan(0);
    }
    const otTotal = OLD_TESTAMENT_BOOKS.reduce((sum, book) => sum + book.chapterCount, 0);
    const ntTotal = NEW_TESTAMENT_BOOKS.reduce((sum, book) => sum + book.chapterCount, 0);
    expect(otTotal).toBe(929);
    expect(ntTotal).toBe(260);
    expect(otTotal + ntTotal).toBe(1189);
  });

  it('spot-checks well-known chapter counts', () => {
    expect(getBookById('genesis')?.chapterCount).toBe(50);
    expect(getBookById('psalms')?.chapterCount).toBe(150);
    expect(getBookById('john')?.chapterCount).toBe(21);
    expect(getBookById('revelation')?.chapterCount).toBe(22);
    expect(getBookById('philemon')?.chapterCount).toBe(1);
    expect(getBookById('jude')?.chapterCount).toBe(1);
  });
});

describe('getBookById', () => {
  it('returns the matching book for a known id', () => {
    expect(getBookById('genesis')?.name).toBe('Genesis');
  });

  it('returns undefined for an unknown id', () => {
    expect(getBookById('not-a-book')).toBeUndefined();
  });
});

/**
 * Which language a LABEL is written in -- see ../types.ts.
 *
 * This one function is what keeps "which scripture am I reading" and
 * "what language is the app in" from being confused at the point where
 * they meet: the book name above the verses.
 */
describe('bookNameLanguageFor', () => {
  it('follows the Bible in a single-language mode, whatever the interface is', () => {
    expect(bookNameLanguageFor('te', 'en')).toBe('te');
    expect(bookNameLanguageFor('te', 'te')).toBe('te');
    expect(bookNameLanguageFor('en', 'te')).toBe('en');
    expect(bookNameLanguageFor('en', 'en')).toBe('en');
  });

  it('follows the interface in bilingual mode, where the verses carry both', () => {
    // The label is chrome, not scripture: a Telugu-reading member asking
    // to see both texts should not be handed English book names.
    expect(bookNameLanguageFor('bilingual', 'te')).toBe('te');
    expect(bookNameLanguageFor('bilingual', 'en')).toBe('en');
  });
});
