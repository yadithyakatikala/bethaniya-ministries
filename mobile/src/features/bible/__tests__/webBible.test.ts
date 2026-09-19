import { BIBLE_BOOKS } from '../books';
import { getWebVerseTexts } from '../webBible';

/**
 * The English corpus, checked as DATA.
 *
 * WHY THIS FILE EXISTS. M4's visual QA put the reader on screen in the
 * bundled typefaces and the very first frame showed
 *
 *     God said, \"Let there be light,\" and there was light.
 *
 * -- a literal backslash before every quotation mark, on 4,503 of the
 * 31,102 verses. The import was faithful; the upstream scrollmapper JSON
 * double-escapes its own quotes, and nothing in the suite looked at the
 * characters the corpus actually contains. The backslash is not part of
 * the World English Bible, so it is stripped in ./data/web-en.json and
 * this file is what stops it (or anything like it) coming back.
 *
 * The Telugu side has the equivalent guard in ./teluguBible.test.ts.
 */
function everyVerse(): { ref: string; text: string }[] {
  const all: { ref: string; text: string }[] = [];
  for (const book of BIBLE_BOOKS) {
    for (let chapter = 1; chapter <= book.chapterCount; chapter += 1) {
      const verses = getWebVerseTexts(book.order, chapter);
      if (!verses) continue;
      verses.forEach((text, index) => {
        all.push({ ref: `${book.name} ${chapter}:${index + 1}`, text });
      });
    }
  }
  return all;
}

const VERSES = everyVerse();

describe('the bundled WEB corpus', () => {
  it('covers all 66 books and the canonical 31,102 verses', () => {
    expect(VERSES).toHaveLength(31102);
  });

  it('contains no escape characters left over from the import', () => {
    const offenders = VERSES.filter((v) => v.text.includes('\\'));
    expect(offenders.slice(0, 5)).toEqual([]);
    expect(offenders).toHaveLength(0);
  });

  it('prints ordinary quotation marks around reported speech', () => {
    // Genesis 1:3 is the verse the defect was found on.
    expect(getWebVerseTexts(1, 1)?.[2]).toBe(
      'God said, "Let there be light," and there was light.'
    );
  });

  it('leaves no stray translator footnote braces in the reading text', () => {
    // The importer strips WEB's curly-brace asides; a leftover brace
    // would put an editorial note in the middle of a verse.
    const offenders = VERSES.filter((v) => v.text.includes('{') || v.text.includes('}'));
    expect(offenders).toHaveLength(0);
  });

  it('has text for every verse except the seven the WEB itself omits', () => {
    /**
     * Luke 17:36, Acts 8:37, Acts 15:34, Acts 24:7 and Romans 16:25-27
     * consist ENTIRELY of a translator's note in the source: the
     * manuscripts this translation follows do not contain them. So the
     * verse number exists and the text does not, which is a fact about
     * the translation rather than a hole in the data -- and the reader
     * says so rather than printing a blank line (see
     * ../reader/ScriptureBody.tsx).
     */
    const empty = VERSES.filter((v) => v.text.trim().length === 0).map((v) => v.ref);
    expect(empty).toEqual([
      'Luke 17:36',
      'Acts 8:37',
      'Acts 15:34',
      'Acts 24:7',
      'Romans 16:25',
      'Romans 16:26',
      'Romans 16:27',
    ]);
  });

  it('is pure ASCII, which is what makes the Latin-only serif safe', () => {
    // ../../../theme/tokens.ts picks the scripture face by language on
    // the strength of this: a stray non-ASCII character here would be a
    // glyph Noto Serif might not carry.
    const offenders = VERSES.filter((v) => /[^\x20-\x7E]/.test(v.text));
    expect(offenders.slice(0, 5)).toEqual([]);
  });
});
