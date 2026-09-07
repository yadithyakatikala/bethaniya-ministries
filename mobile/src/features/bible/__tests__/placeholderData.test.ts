import { PLACEHOLDER_POOL_SIZE, buildPlaceholderVerses } from '../placeholderData';
import { BIBLE_BOOKS } from '../books';

describe('PLACEHOLDER_POOL_SIZE', () => {
  it('is within the 100-200 range required by FINAL_ARCHITECTURE_SPECIFICATION.md Day 8', () => {
    expect(PLACEHOLDER_POOL_SIZE).toBeGreaterThanOrEqual(100);
    expect(PLACEHOLDER_POOL_SIZE).toBeLessThanOrEqual(200);
  });
});

describe('buildPlaceholderVerses', () => {
  it('returns a fixed number of verses per chapter', () => {
    expect(buildPlaceholderVerses(1, 1, 'en')).toHaveLength(3);
  });

  it('is deterministic -- the same book/chapter/language always produces the same text', () => {
    const first = buildPlaceholderVerses(19, 23, 'en');
    const second = buildPlaceholderVerses(19, 23, 'en');
    expect(second).toEqual(first);
  });

  it('produces different text for different chapters, demonstrating real navigation behavior', () => {
    const chapter1 = buildPlaceholderVerses(19, 1, 'en');
    const chapter50 = buildPlaceholderVerses(19, 50, 'en');
    expect(chapter1[0]?.text).not.toBe(chapter50[0]?.text);
  });

  it('never produces the same text for English and Telugu', () => {
    const en = buildPlaceholderVerses(19, 23, 'en');
    const te = buildPlaceholderVerses(19, 23, 'te');
    for (const verse of en) {
      expect(te.map((v) => v.text)).not.toContain(verse.text);
    }
  });

  it('is obviously synthetic development content, not scripture, for every book', () => {
    for (const book of BIBLE_BOOKS) {
      const verses = buildPlaceholderVerses(book.order, 1, 'en');
      for (const verse of verses) {
        expect(verse.text).toMatch(
          /Development placeholder #\d{3} -- English\. Not scripture/
        );
      }
    }
  });

  it('draws from the bounded pool -- no generated verse text falls outside it', () => {
    const seen = new Set<string>();
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapterCount; chapter += 1) {
        for (const verse of buildPlaceholderVerses(book.order, chapter, 'en')) {
          seen.add(verse.text);
        }
      }
    }
    expect(seen.size).toBeLessThanOrEqual(PLACEHOLDER_POOL_SIZE);
    for (const text of seen) {
      expect(text).toMatch(/^\[Development placeholder #\d{3} -- English\./);
    }
  });
});
