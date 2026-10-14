import { describe, expect, it } from 'vitest';
// Read as raw text through Vite, as the Verse-of-the-Day guard does: this
// package's TypeScript is browser-only (tsconfig.app.json), so it does not
// pull in Node's fs just to read one fixture.
import vectorText from '../../../../../mobile/src/features/plans/__tests__/plan-reference-vectors.json?raw';
import { BIBLE_STRUCTURE } from '../../daily-verses/bibleStructure';
import {
  SCRIPTURE_REFERENCE_MAX_LENGTH,
  checkPassageList,
  joinPassages,
  parsePassage,
  splitPassages,
} from '../passages';

function ok(input: string) {
  const result = parsePassage(input);
  if (!result.ok) throw new Error(`expected "${input}" to parse: ${result.message}`);
  return result.passage;
}

function message(input: string): string {
  const result = parsePassage(input);
  if (result.ok) throw new Error(`expected "${input}" to be refused`);
  return result.message;
}

describe('reading a passage', () => {
  it.each([
    ['Psalm 23', 'Psalm 23', 6],
    ['psalm 23', 'Psalm 23', 6],
    ['Psalms 23', 'Psalm 23', 6],
    ['Psalms 1-3', 'Psalms 1-3', 26],
    ['PSALMS 1 - 3', 'Psalms 1-3', 26],
    ['John 3:16', 'John 3:16', 1],
    ['john 3:16-21', 'John 3:16-21', 6],
    ['John 3 : 16 – 21', 'John 3:16-21', 6],
    ['John 3:16—21', 'John 3:16-21', 6],
    ['John 3:16-3:20', 'John 3:16-20', 5],
    ['John 3:16-16', 'John 3:16', 1],
    ['Genesis 1:1-2:3', 'Genesis 1:1-2:3', 34],
    ['  1   John   4:7-12 ', '1 John 4:7-12', 6],
    ['Song of Songs 2:4', 'Song of Solomon 2:4', 1],
    ['Songs of Solomon 2', 'Song of Solomon 2', 17],
    ['Revelations 21:1-5', 'Revelation 21:1-5', 5],
    ['Jude 1:24-25', 'Jude 1:24-25', 2],
    ['Obadiah 1', 'Obadiah 1', 21],
  ])('%j is written %j and covers %i verses', (input, written, verses) => {
    const passage = ok(input);
    expect(passage.text).toBe(written);
    expect(passage.verseCount).toBe(verses);
  });

  it('says where it starts and ends', () => {
    expect(ok('Genesis 1:1-2:3')).toMatchObject({
      bookId: 'genesis',
      startChapter: 1,
      startVerse: 1,
      endChapter: 2,
      endVerse: 3,
    });
    expect(ok('Psalms 1-3')).toMatchObject({
      bookId: 'psalms',
      startChapter: 1,
      startVerse: null,
      endChapter: 3,
      endVerse: null,
    });
    expect(ok('1 Corinthians 13')).toMatchObject({ bookId: '1-corinthians' });
  });

  it('is exact about the end of a chapter', () => {
    expect(ok('Psalm 117:2').text).toBe('Psalm 117:2');
    expect(message('Psalm 117:3')).toBe('Psalms 117 has 2 verses.');
    expect(message('John 3:99')).toBe('John 3 has 36 verses.');
    expect(message('John 3:16-4:99')).toBe('John 4 has 54 verses.');
  });

  describe('Telugu book names', () => {
    const book = (id: string) => BIBLE_STRUCTURE.find((entry) => entry.id === id)!;

    it('reads a reference written with a Telugu name, and writes it back in Telugu', () => {
      const psalms = book('psalms').nameTe;
      const passage = ok(`${psalms} 23`);
      expect(passage.bookId).toBe('psalms');
      // One psalm is "Psalm" in English only; a Telugu reference keeps its own name.
      expect(passage.text).toBe(`${psalms} 23`);
      expect(passage.bookName).toBe(psalms);
      expect(passage.verseCount).toBe(6);
    });

    it('reads names with spaces and numbers in them', () => {
      expect(ok(`${book('1-samuel').nameTe} 17:1-11`).bookId).toBe('1-samuel');
      expect(ok(`${book('1-corinthians').nameTe} 13`).bookId).toBe('1-corinthians');
      expect(ok(`${book('2-john').nameTe} 1:6`).bookId).toBe('2-john');
    });

    it('does not confuse a numbered book with the book after its number', () => {
      expect(ok(`${book('1-john').nameTe} 4:8`).bookId).toBe('1-john');
      expect(ok(`${book('john').nameTe} 4:8`).bookId).toBe('john');
    });

    it('checks the chapter and verse limits in Telugu too, naming the book as typed', () => {
      const john = book('john').nameTe;
      expect(message(`${john} 22`)).toBe(`${john} has 21 chapters.`);
      expect(message(`${john} 3:99`)).toBe(`${john} 3 has 36 verses.`);
    });

    it('accepts the name however the Telugu is composed', () => {
      // The same word can arrive as different Unicode sequences from different
      // keyboards; what is stored is the app's own spelling.
      const decomposed = book('psalms').nameTe.normalize('NFD');
      expect(ok(`${decomposed} 23`).text).toBe(`${book('psalms').nameTe} 23`);
    });

    it('has a distinct Telugu name for every book', () => {
      const names = BIBLE_STRUCTURE.map((entry) => entry.nameTe);
      expect(new Set(names).size).toBe(66);
      for (const entry of BIBLE_STRUCTURE) {
        expect(ok(`${entry.nameTe} 1`).bookId).toBe(entry.id);
      }
    });
  });

  describe('refuses what does not exist or cannot be opened', () => {
    it('names the chapters a book has', () => {
      expect(message('Psalm 151')).toBe('Psalms has 150 chapters.');
      expect(message('John 22')).toBe('John has 21 chapters.');
      expect(message('Genesis 1-51')).toBe('Genesis has 50 chapters.');
    });

    it('gives the likeliest fix for a one-chapter book', () => {
      expect(message('Jude 5')).toBe(
        'Jude has only 1 chapter. For verse 5, write "Jude 1:5".'
      );
      expect(message('Obadiah 22')).toContain('Obadiah 1:22');
    });

    it('turns an abbreviation away rather than saving what the app cannot open', () => {
      expect(message('Jn 3:16')).toContain('abbreviation');
      expect(message('Gen 1:1')).toContain('full name');
      expect(message('Ps 23')).toContain('abbreviation');
      expect(message('Rom 8')).toContain('abbreviation');
    });

    it('turns a roman numeral into a number', () => {
      expect(message('I John 4:8')).toBe('Write "1 John" with a number, not "I John".');
      expect(message('II Kings 2:11')).toBe(
        'Write "2 Kings" with a number, not "II Kings".'
      );
    });

    it('says when it is not a book at all', () => {
      expect(message('Jhon 3:16')).toContain('not a book of the Bible');
      expect(message('Hezekiah 3')).toContain('not a book of the Bible');
    });

    it('refuses a passage that ends before it begins', () => {
      expect(message('John 3:21-16')).toBe('A passage has to end after it begins.');
      expect(message('Genesis 3-1')).toBe('A passage has to end after it begins.');
      expect(message('Genesis 2:5-1:3')).toBe('A passage has to end after it begins.');
    });

    it('refuses chapter 0 and verse 0', () => {
      expect(message('John 0')).toBe('Chapters start at 1.');
      expect(message('John 3:0')).toBe('John 3 has 36 verses.');
    });

    it('asks for the first verse when only the last is given across chapters', () => {
      expect(message('Genesis 1-2:3')).toContain('first verse');
    });

    it('explains the shape when it cannot read it at all', () => {
      expect(message('John')).toContain('a book, a chapter');
      expect(message('3:16')).toContain('a book, a chapter');
      expect(message('John 3:16:2')).toContain('a book, a chapter');
      expect(message('')).toContain('Enter a passage');
      expect(message('   ')).toContain('Enter a passage');
    });
  });

  it('knows every book, and the first and last verse of every chapter in the Bible', () => {
    expect(BIBLE_STRUCTURE).toHaveLength(66);
    for (const book of BIBLE_STRUCTURE) {
      const chapters = book.verseCounts.length;
      expect(parsePassage(`${book.name} 1`).ok).toBe(true);
      expect(parsePassage(`${book.name} ${chapters + 1}`).ok).toBe(false);
      for (let chapter = 1; chapter <= chapters; chapter += 1) {
        const last = book.verseCounts[chapter - 1] ?? 0;
        expect(parsePassage(`${book.name} ${chapter}:1`).ok).toBe(true);
        expect(parsePassage(`${book.name} ${chapter}:${last}`).ok).toBe(true);
        expect(parsePassage(`${book.name} ${chapter}:${last + 1}`).ok).toBe(false);
      }
    }
  });
});

describe('a list of passages', () => {
  it('splits and joins the stored string', () => {
    expect(splitPassages('Psalm 23; John 10:11-18')).toEqual([
      'Psalm 23',
      'John 10:11-18',
    ]);
    expect(splitPassages(' Psalm 23 ;; ; John 3:16 ')).toEqual(['Psalm 23', 'John 3:16']);
    expect(splitPassages('')).toEqual([]);
    expect(joinPassages([' Psalm 23 ', '', 'John 3:16'])).toBe('Psalm 23; John 3:16');
    expect(joinPassages([])).toBe('');
  });

  it('needs at least one passage', () => {
    expect(checkPassageList([]).problem).toBe('Add at least one passage.');
    expect(checkPassageList(['', '  ']).problem).toBe('Add at least one passage.');
  });

  it('stores the canonical text of valid passages', () => {
    const check = checkPassageList(['psalms 23', 'john 3:16 - 21']);
    expect(check.problem).toBeNull();
    expect(check.stored).toBe('Psalm 23; John 3:16-21');
    expect(check.verseCount).toBe(12);
    expect(check.results.every((result) => result.ok)).toBe(true);
  });

  it('keeps what was typed for a passage it cannot read, and says to fix it', () => {
    const check = checkPassageList(['Psalm 23', 'Jn 3:16']);
    expect(check.problem).toBe('Fix the passages marked below.');
    expect(check.stored).toBe('Psalm 23; Jn 3:16');
    expect(check.results.map((result) => result.ok)).toEqual([true, false]);
    expect(check.verseCount).toBe(6);
  });

  it('refuses a list too long to store', () => {
    const many = Array.from({ length: 20 }, () => 'Psalm 119:105-112');
    const check = checkPassageList(many);
    expect(check.stored.length).toBeGreaterThan(SCRIPTURE_REFERENCE_MAX_LENGTH);
    expect(check.problem).toContain(`${SCRIPTURE_REFERENCE_MAX_LENGTH} characters`);
  });

  it('accepts a list exactly as long as can be stored', () => {
    const reference = 'Psalm 119:105-112';
    const count = Math.floor(
      (SCRIPTURE_REFERENCE_MAX_LENGTH + 2) / (reference.length + 2)
    );
    const check = checkPassageList(Array.from({ length: count }, () => reference));
    expect(check.stored.length).toBeLessThanOrEqual(SCRIPTURE_REFERENCE_MAX_LENGTH);
    expect(check.problem).toBeNull();
  });
});

/**
 * THE CROSS-PACKAGE GUARD. The phone opens the Bible from the string stored
 * here, using its own parser; the two packages share no code, so both replay
 * the same vectors. A reading this dashboard accepts must be one the phone
 * opens at the same place.
 */
interface Vector {
  text: string;
  admin: boolean;
  mobile: { bookId: string; chapterNumber: number; verse?: number } | null;
}
const VECTORS = (JSON.parse(vectorText) as { vectors: Vector[] }).vectors;

describe('the reference vectors shared with the phone app', () => {
  it.each(VECTORS.map((vector) => [vector.text, vector] as const))(
    '%j is %s by the dashboard',
    (_text, vector) => {
      const check = checkPassageList(splitPassages(vector.text));
      expect(check.problem === null).toBe(vector.admin);
    }
  );

  it('starts every accepted reading where the phone will open it', () => {
    const accepted = VECTORS.filter((vector) => vector.admin);
    expect(accepted.length).toBeGreaterThan(10);
    for (const vector of accepted) {
      const first = parsePassage(splitPassages(vector.text)[0] ?? '');
      expect(first.ok).toBe(true);
      if (!first.ok || !vector.mobile) throw new Error(`no target for ${vector.text}`);
      expect(first.passage.bookId).toBe(vector.mobile.bookId);
      expect(first.passage.startChapter).toBe(vector.mobile.chapterNumber);
      expect(first.passage.startVerse ?? undefined).toBe(vector.mobile.verse);
    }
  });

  it('writes every accepted reading in a form the phone still opens at the same place', () => {
    // Round trip: the canonical text this module STORES, not the text that was
    // typed, is what the phone reads.
    for (const vector of VECTORS.filter((v) => v.admin)) {
      const stored = checkPassageList(splitPassages(vector.text)).stored;
      const again = checkPassageList(splitPassages(stored));
      expect(again.problem).toBeNull();
      expect(again.stored).toBe(stored);
    }
  });
});
