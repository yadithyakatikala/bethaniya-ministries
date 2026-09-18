import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBilingualChapter, getChapter, loadChapter } from '../dataSource';

describe('getChapter', () => {
  it('returns the real WEB text for a valid English book/chapter', () => {
    const chapter = getChapter('genesis', 1, 'en');
    expect(chapter).not.toBeNull();
    expect(chapter?.bookId).toBe('genesis');
    expect(chapter?.bookName).toBe('Genesis');
    expect(chapter?.chapterNumber).toBe(1);
    expect(chapter?.language).toBe('en');
    expect(chapter?.unavailableInTranslation).toBe(false);
    expect(chapter?.verses.length).toBeGreaterThan(0);
    expect(chapter?.verses[0]?.text).toBe(
      'In the beginning God created the heavens and the earth.'
    );
  });

  it('returns the real Telugu IRV 2019 text for a valid Telugu book/chapter', () => {
    const chapter = getChapter('genesis', 1, 'te');
    expect(chapter).not.toBeNull();
    expect(chapter?.bookId).toBe('genesis');
    expect(chapter?.language).toBe('te');
    expect(chapter?.unavailableInTranslation).toBe(false);
    expect(chapter?.verses.length).toBeGreaterThan(0);
    expect(chapter?.verses[0]?.text).toBe('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.');
  });

  it('returns different text for English (WEB) vs Telugu (IRV 2019)', () => {
    const en = getChapter('genesis', 1, 'en');
    const te = getChapter('genesis', 1, 'te');
    expect(en?.verses[0]?.text).not.toBe(te?.verses[0]?.text);
  });

  it('returns real WEB text for the last book/chapter/verse (Revelation 22)', () => {
    const chapter = getChapter('revelation', 22, 'en');
    expect(chapter).not.toBeNull();
    expect(chapter?.unavailableInTranslation).toBe(false);
    expect(chapter?.verses[chapter!.verses.length - 1]?.text).toBe(
      'The grace of the Lord Jesus Christ be with all the saints. Amen.'
    );
  });

  it('reports Malachi 4 as absent from the Telugu translation, without inventing verses', () => {
    // V1 returned GENERATED placeholder text here behind a warning badge.
    // A Bible app must not render invented scripture, so this is now an
    // empty chapter that says so -- see dataSource.ts.
    const malachi4 = getChapter('malachi', 4, 'te');
    expect(malachi4).not.toBeNull();
    expect(malachi4?.unavailableInTranslation).toBe(true);
    expect(malachi4?.verses).toEqual([]);
  });

  it('still has real Telugu text for Joel 3, which V1 wrongly treated as a gap', () => {
    // Joel 3 DOES have Telugu text; V1's import lost it. The chapter is
    // classified 'divergent' for bilingual purposes (the IRV follows
    // Hebrew chapter division in Joel), but single-language reading works.
    const joel3 = getChapter('joel', 3, 'te');
    expect(joel3).not.toBeNull();
    expect(joel3?.unavailableInTranslation).toBe(false);
    expect(joel3?.verses.length).toBeGreaterThan(0);
  });

  it('keeps a merged verse range as one unit carrying both ends (Luke 1:39-40)', () => {
    // The defect this whole import rewrite exists to fix: V1 dropped the
    // source's <range> markers, so the reader jumped 39 -> 41.
    const luke1 = getChapter('luke', 1, 'te');
    const merged = luke1?.verses.find((verse) => verse.number === 39);
    expect(merged).toMatchObject({ number: 39, endNumber: 40 });
    expect(merged?.text.length).toBeGreaterThan(0);
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

/**
 * The bilingual seam.
 *
 * The pairing RULES are proved exhaustively over all 1189 chapters in
 * ./alignment.test.ts. What is checked here is that this data source
 * feeds the policy the right two chapters and passes its verdict through
 * untouched -- including the verdicts that decline to pair, which are the
 * ones a well-meaning "just zip the two arrays" regression would erase.
 */
describe('getBilingualChapter', () => {
  it('pairs an aligned chapter verse for verse, carrying both texts', () => {
    const result = getBilingualChapter('genesis', 1);
    expect(result).not.toBeNull();
    expect(result?.bookId).toBe('genesis');
    expect(result?.chapterNumber).toBe(1);

    const presentation = result?.presentation;
    if (presentation?.kind !== 'paired') throw new Error('expected paired');
    expect(presentation.rows[0].label).toBe('1');
    expect(presentation.rows[0].english).toBe(
      'In the beginning God created the heavens and the earth.'
    );
    expect(presentation.rows[0].telugu).toMatch(/[ఀ-౿]/);
    // Every row carries text on both sides -- a paired verdict must never
    // be returned with a blank column.
    for (const row of presentation.rows) {
      expect(row.english.length).toBeGreaterThan(0);
      expect(row.telugu.length).toBeGreaterThan(0);
    }
  });

  it('labels a merged Telugu range with both ends (Luke 1:39-40)', () => {
    const result = getBilingualChapter('luke', 1);
    const presentation = result?.presentation;
    if (presentation?.kind !== 'paired') throw new Error('expected paired');

    const merged = presentation.rows.find((row) => row.end > row.start);
    expect(merged).toBeDefined();
    expect(merged?.label).toBe(`${merged?.start}-${merged?.end}`);
    expect(presentation.rows.some((row) => row.label === '39-40')).toBe(true);
  });

  it('declines to pair a divergent chapter, reporting why (Genesis 31)', () => {
    // One of the 41 chapters the Hebrew and English traditions divide
    // differently. Forcing rows here would place the wrong Telugu verse
    // beside an English one -- the exact failure the policy exists for.
    const presentation = getBilingualChapter('genesis', 31)?.presentation;
    if (presentation?.kind !== 'chapterLevel') throw new Error('expected chapterLevel');
    expect(presentation.notice).toBe('numberingDiffers');
    expect(presentation.english.length).toBeGreaterThan(0);
    expect(presentation.telugu.length).toBeGreaterThan(0);
  });

  it('returns English alone, flagged, for the one chapter Telugu lacks', () => {
    const presentation = getBilingualChapter('malachi', 4)?.presentation;
    if (presentation?.kind !== 'englishOnly') throw new Error('expected englishOnly');
    expect(presentation.notice).toBe('notInTranslation');
    expect(presentation.english.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown book or an out-of-range chapter', () => {
    expect(getBilingualChapter('not-a-book', 1)).toBeNull();
    expect(getBilingualChapter('jude', 2)).toBeNull();
    expect(getBilingualChapter('genesis', 0)).toBeNull();
  });
});
