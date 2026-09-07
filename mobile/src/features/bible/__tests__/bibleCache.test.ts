import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedChapter, setCachedChapter } from '../bibleCache';
import type { BibleChapter } from '../types';

const sampleEn: BibleChapter = {
  bookId: 'genesis',
  bookName: 'Genesis',
  chapterNumber: 1,
  language: 'en',
  verses: [{ number: 1, text: 'placeholder en text' }],
  isPlaceholder: true,
};

const sampleTe: BibleChapter = {
  bookId: 'genesis',
  bookName: 'Genesis',
  chapterNumber: 1,
  language: 'te',
  verses: [{ number: 1, text: 'placeholder te text' }],
  isPlaceholder: true,
};

describe('bibleCache', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null on a cache miss', async () => {
    expect(await getCachedChapter('genesis', 1, 'en')).toBeNull();
  });

  it('writes then reads back a cached chapter', async () => {
    await setCachedChapter(sampleEn);
    expect(await getCachedChapter('genesis', 1, 'en')).toEqual(sampleEn);
  });

  it('keeps English and Telugu cache entries for the same book/chapter separate', async () => {
    await setCachedChapter(sampleEn);
    await setCachedChapter(sampleTe);

    expect(await getCachedChapter('genesis', 1, 'en')).toEqual(sampleEn);
    expect(await getCachedChapter('genesis', 1, 'te')).toEqual(sampleTe);
  });

  it('does not confuse different chapters of the same book/language', async () => {
    const chapter2: BibleChapter = { ...sampleEn, chapterNumber: 2 };
    await setCachedChapter(sampleEn);
    await setCachedChapter(chapter2);

    expect(await getCachedChapter('genesis', 1, 'en')).toEqual(sampleEn);
    expect(await getCachedChapter('genesis', 2, 'en')).toEqual(chapter2);
  });

  it('recovers gracefully from corrupted stored JSON', async () => {
    await AsyncStorage.setItem('bible_chapter_cache:en:genesis:1', 'not-json');
    expect(await getCachedChapter('genesis', 1, 'en')).toBeNull();
  });
});
