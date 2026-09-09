import { MAX_SEARCH_RESULTS, searchBible } from '../search';

describe('searchBible', () => {
  it('returns an empty array for an empty query', () => {
    expect(searchBible('', 'en')).toEqual([]);
  });

  it('returns an empty array for a whitespace-only query', () => {
    expect(searchBible('   ', 'en')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchBible('xyznonexistentquery', 'en')).toEqual([]);
  });

  it('matches verse text case-insensitively and partially (real WEB text)', () => {
    const results = searchBible('BEGINNING god created', 'en');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.matchSource).toBe('text');
      expect(result.text.toLowerCase()).toContain('beginning god created');
    }
  });

  it('caps results at MAX_SEARCH_RESULTS for a very broad query', () => {
    const results = searchBible('the', 'en');
    expect(results.length).toBe(MAX_SEARCH_RESULTS);
  });

  it('matches by book name via the reference when the text does not match', () => {
    const results = searchBible('genesis', 'en');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.matchSource).toBe('reference');
      expect(result.bookId).toBe('genesis');
      expect(result.reference.toLowerCase()).toContain('genesis');
    }
  });

  it('matches a specific chapter:verse reference', () => {
    const results = searchBible('Genesis 1:1', 'en');
    expect(results.some((r) => r.reference === 'Genesis 1:1')).toBe(true);
  });

  it('returns results in canonical book/chapter/verse order', () => {
    const results = searchBible('genesis', 'en');
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];
      const prevKey = prev.chapterNumber * 1000 + prev.verseNumber;
      const currKey = curr.chapterNumber * 1000 + curr.verseNumber;
      expect(currKey).toBeGreaterThanOrEqual(prevKey);
    }
  });

  it('searches Telugu placeholder text when language is te', () => {
    const results = searchBible('డెవలప్‌మెంట్', 'te');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchSource).toBe('text');
  });

  it('reports a correct matchStart/matchLength for a text match', () => {
    const results = searchBible('beginning', 'en');
    const [first] = results;
    expect(first).toBeDefined();
    const extracted = first.text
      .toLowerCase()
      .slice(first.matchStart, first.matchStart + first.matchLength);
    expect(extracted).toBe('beginning');
  });
});
