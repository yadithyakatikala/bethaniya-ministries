import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChapter, loadChapter } from '../dataSource';

describe('getChapter', () => {
  it('returns the real WEB text for a valid English book/chapter', () => {
    const chapter = getChapter('genesis', 1, 'en');
    expect(chapter).not.toBeNull();
    expect(chapter?.bookId).toBe('genesis');
    expect(chapter?.bookName).toBe('Genesis');
    expect(chapter?.chapterNumber).toBe(1);
    expect(chapter?.language).toBe('en');
    expect(chapter?.isPlaceholder).toBe(false);
    expect(chapter?.verses.length).toBeGreaterThan(0);
    expect(chapter?.verses[0]?.text).toBe(
      'In the beginning God created the heavens and the earth.'
    );
  });

  it('returns a placeholder chapter for Telugu (still unresolved licensing)', () => {
    const chapter = getChapter('genesis', 1, 'te');
    expect(chapter).not.toBeNull();
    expect(chapter?.language).toBe('te');
    expect(chapter?.isPlaceholder).toBe(true);
    expect(chapter?.verses.length).toBeGreaterThan(0);
  });

  it('returns different text for English (real) vs Telugu (placeholder)', () => {
    const en = getChapter('genesis', 1, 'en');
    const te = getChapter('genesis', 1, 'te');
    expect(en?.verses[0]?.text).not.toBe(te?.verses[0]?.text);
  });

  it('returns real WEB text for the last book/chapter/verse (Revelation 22)', () => {
    const chapter = getChapter('revelation', 22, 'en');
    expect(chapter).not.toBeNull();
    expect(chapter?.isPlaceholder).toBe(false);
    expect(chapter?.verses[chapter!.verses.length - 1]?.text).toBe(
      'The grace of the Lord Jesus Christ be with all the saints. Amen.'
    );
  });

  it('returns null for an unknown book id', () => {
    expect(getChapter('not-a-book', 1, 'en')).toBeNull();
  });

  it('returns null for chapter numbers outside the valid range', () => {
    expect(getChapter('genesis', 0, 'en')).toBeNull();
    expect(getChapter('genesis', 51, 'en')).toBeNull();
    expect(getChapter('jude', 2, 'en')).toBeNull();
    expect(getChapter('jude', 1, 'en')).not.toBeNull();
  });
});

describe('loadChapter', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('writes a successfully loaded chapter to cache', async () => {
    const chapter = await loadChapter('genesis', 1, 'en');
    expect(chapter).not.toBeNull();
    const raw = await AsyncStorage.getItem('bible_chapter_cache:en:genesis:1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(chapter);
  });

  it('reads from cache on a subsequent call instead of regenerating', async () => {
    const first = await loadChapter('genesis', 1, 'en');
    const second = await loadChapter('genesis', 1, 'en');
    expect(second).toEqual(first);
  });

  it('returns null and writes nothing to cache for an invalid chapter', async () => {
    const result = await loadChapter('genesis', 999, 'en');
    expect(result).toBeNull();
    const raw = await AsyncStorage.getItem('bible_chapter_cache:en:genesis:999');
    expect(raw).toBeNull();
  });

  it('caches English and Telugu for the same book/chapter separately', async () => {
    const en = await loadChapter('genesis', 1, 'en');
    const te = await loadChapter('genesis', 1, 'te');
    expect(en?.language).toBe('en');
    expect(te?.language).toBe('te');
    expect(en?.verses[0]?.text).not.toBe(te?.verses[0]?.text);
  });
});
