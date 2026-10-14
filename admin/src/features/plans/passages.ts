/**
 * Reading and checking the Scripture passages of a reading-plan day.
 *
 * =====================================================================
 * WHAT A PASSAGE IS
 * =====================================================================
 * A day names one or more passages -- "Psalm 23", "John 3:16-21",
 * "Genesis 1:1-2:3" -- stored in the day's single `scriptureReference`
 * string, separated by "; ". The phone app shows that string as written and
 * opens the Bible at the FIRST passage (mobile/src/features/plans/
 * planReference.ts). So two things have to be true of whatever is stored:
 *
 *   1. it must be a passage that EXISTS -- "John 3:99" and "Psalm 151"
 *      would make a day whose Read button quietly does nothing;
 *   2. it must be written the way the phone can read it -- "Jn 3:16" is a
 *      perfectly good reference to a person and opens nothing in the app.
 *
 * This module checks both against ../daily-verses/bibleStructure.ts, the
 * verse count of every chapter of the 66 books, derived from the Bible
 * bundled in the app (structure only, no scripture text).
 *
 * THE GRAMMAR is the one the phone reads, no wider:
 *
 *     Book 23            a whole chapter
 *     Book 3-5           several chapters
 *     Book 3:16          one verse
 *     Book 3:16-21       verses within a chapter
 *     Book 1:1-2:3       across a chapter boundary
 *
 * BOOK NAMES are the names the app prints, in English ("Song of Solomon",
 * "1 Corinthians") or in Telugu ("కీర్తనల గ్రంథము"), plus the English
 * spellings people actually write ("Psalm", "Song of Songs", "Revelations").
 * A reference is written back in the language it was typed in, so a
 * Telugu plan keeps Telugu book names. Abbreviations are refused with a
 * sentence that says so, rather than accepted and then not opening.
 *
 * mobile/src/features/plans/__tests__/plan-reference-vectors.json is
 * replayed by both packages' tests, so a reading this module accepts is
 * one the phone opens at the same place.
 */
import { BIBLE_STRUCTURE, verseCountFor } from '../daily-verses/bibleStructure';

/** Where one passage starts and ends, and how it should be written. */
export interface Passage {
  bookId: string;
  /** The book's name in the language the passage was written in. */
  bookName: string;
  startChapter: number;
  /** null when the passage starts at the beginning of a whole-chapter reference. */
  startVerse: number | null;
  endChapter: number;
  /** null when the passage runs to the end of its last chapter. */
  endVerse: number | null;
  /** The passage written the one canonical way. This is what gets stored. */
  text: string;
  /** How many verses it covers. */
  verseCount: number;
}

export type PassageResult =
  { ok: true; passage: Passage } | { ok: false; message: string };

/**
 * Spellings people write that are not the catalogue name. Kept identical to
 * the phone's own table (mobile/src/features/plans/planReference.ts) --
 * accepting one the phone does not know would make a Read button that does
 * nothing.
 */
const ALIASES: Record<string, string> = {
  psalm: 'psalms',
  'song of songs': 'song-of-solomon',
  'songs of solomon': 'song-of-solomon',
  revelations: 'revelation',
};

interface Spelling {
  bookId: string;
  chapterCount: number;
  /** How the book is named when it is written back. */
  name: string;
  /** English or Telugu, so "Psalm" is not forced onto a Telugu reference. */
  script: 'en' | 'te';
}

/** Every accepted spelling (NFC, lowercase) -> the book it names. */
const BY_SPELLING = new Map<string, Spelling>();
for (const book of BIBLE_STRUCTURE) {
  const chapterCount = book.verseCounts.length;
  BY_SPELLING.set(book.name.normalize('NFC').toLowerCase(), {
    bookId: book.id,
    chapterCount,
    name: book.name,
    script: 'en',
  });
  BY_SPELLING.set(book.nameTe.normalize('NFC').toLowerCase(), {
    bookId: book.id,
    chapterCount,
    name: book.nameTe,
    script: 'te',
  });
}
for (const [alias, id] of Object.entries(ALIASES)) {
  const book = BIBLE_STRUCTURE.find((entry) => entry.id === id);
  if (book) {
    BY_SPELLING.set(alias, {
      bookId: book.id,
      chapterCount: book.verseCounts.length,
      name: book.name,
      script: 'en',
    });
  }
}

/** Abbreviations that look right and the app cannot open. */
const KNOWN_ABBREVIATION =
  /^(gen|ex|exod|lev|num|deut|dt|josh|judg|jdg|sam|kgs|chr|neh|esth?|ps|pss|prov|pr|eccl?|ecc|song|sos|isa|jer|lam|ezek|dan|hos|obad|mic|nah|hab|zeph|hag|zech|mal|matt?|mt|mk|lk|jn|rom|cor|gal|eph|phil|col|thess|tim|tit|heb|jas|jm|pet|pt|rev)$/i;

/** Hyphen, en dash, em dash and minus sign all mean "to". */
function tidy(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** "Psalm" for one psalm, as people say it; otherwise the book's name. */
function writtenName(
  spelling: Spelling,
  startChapter: number,
  endChapter: number
): string {
  if (
    spelling.script === 'en' &&
    spelling.bookId === 'psalms' &&
    startChapter === endChapter
  ) {
    return 'Psalm';
  }
  return spelling.name;
}

function wrongBook(bookText: string): string {
  if (
    KNOWN_ABBREVIATION.test(bookText) ||
    KNOWN_ABBREVIATION.test(bookText.split(' ')[0] ?? '')
  ) {
    return `"${bookText}" is an abbreviation. Write the book's full name, for example "John" or "1 Corinthians".`;
  }
  // "I John", "II Kings": the likeliest slip once a church writes numerals.
  const roman = /^(i{1,3}) (.+)$/i.exec(bookText);
  if (roman) {
    const numbered = BY_SPELLING.get(
      `${(roman[1] ?? '').length} ${(roman[2] ?? '').toLowerCase()}`
    );
    if (numbered) return `Write "${numbered.name}" with a number, not "${bookText}".`;
  }
  return `"${bookText}" is not a book of the Bible. Check the spelling, for example "1 Corinthians" or "Song of Solomon".`;
}

/** Reads one passage, or says in a sentence what is wrong with it. */
export function parsePassage(input: string): PassageResult {
  const text = tidy(input);
  if (text.length === 0) {
    return { ok: false, message: 'Enter a passage, for example "John 3:16-21".' };
  }

  // Book, then chapter, then an optional ":verse", then an optional "-end".
  const match = /^(.+?) (\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/.exec(text);
  if (!match) {
    return {
      ok: false,
      message:
        'Write a book, a chapter and optionally verses, for example "Psalm 23" or "John 3:16-21".',
    };
  }

  const [, bookText = '', chapterText = '', verseText, endText, endVerseText] = match;
  const spelling = BY_SPELLING.get(bookText.toLowerCase());
  if (!spelling) return { ok: false, message: wrongBook(bookText) };

  const { chapterCount } = spelling;
  const startChapter = Number(chapterText);
  const startVerse = verseText === undefined ? null : Number(verseText);

  // "Jude 5" means chapter 5, which Jude does not have -- the likeliest
  // slip in a one-chapter book, so it gets its own advice.
  if (startChapter > chapterCount) {
    return {
      ok: false,
      message:
        chapterCount === 1
          ? `${spelling.name} has only 1 chapter. For verse ${startChapter}, write "${spelling.name} 1:${startChapter}".`
          : `${spelling.name} has ${chapterCount} chapters.`,
    };
  }
  if (startChapter < 1) return { ok: false, message: 'Chapters start at 1.' };

  const startVerses = verseCountFor(spelling.bookId, startChapter);
  if (startVerse !== null && (startVerse < 1 || startVerse > startVerses)) {
    return {
      ok: false,
      message: `${spelling.name} ${startChapter} has ${startVerses} ${plural(startVerses, 'verse', 'verses')}.`,
    };
  }

  let endChapter = startChapter;
  let endVerse: number | null = startVerse;

  if (endText !== undefined) {
    const end = Number(endText);
    if (endVerseText !== undefined) {
      // "1:1-2:3" -- a range that crosses a chapter boundary.
      if (startVerse === null) {
        return {
          ok: false,
          message: `Write the first verse too, for example "${spelling.name} ${startChapter}:1-${end}:${endVerseText}".`,
        };
      }
      endChapter = end;
      endVerse = Number(endVerseText);
    } else if (startVerse === null) {
      // "3-5" -- several whole chapters.
      endChapter = end;
      endVerse = null;
    } else {
      // "3:16-21" -- verses within one chapter.
      endChapter = startChapter;
      endVerse = end;
    }
  }

  if (endChapter < 1 || endChapter > chapterCount) {
    return {
      ok: false,
      message:
        chapterCount === 1
          ? `${spelling.name} has only 1 chapter.`
          : `${spelling.name} has ${chapterCount} chapters.`,
    };
  }
  const endVerses = verseCountFor(spelling.bookId, endChapter);
  if (endVerse !== null && (endVerse < 1 || endVerse > endVerses)) {
    return {
      ok: false,
      message: `${spelling.name} ${endChapter} has ${endVerses} ${plural(endVerses, 'verse', 'verses')}.`,
    };
  }

  const endsBeforeStart =
    endChapter < startChapter ||
    (endChapter === startChapter &&
      startVerse !== null &&
      endVerse !== null &&
      endVerse < startVerse);
  if (endsBeforeStart) {
    return { ok: false, message: 'A passage has to end after it begins.' };
  }

  // How many verses it covers: every verse in the chapters between, plus the
  // partial first and last chapters.
  let verseCount = 0;
  for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
    const total = verseCountFor(spelling.bookId, chapter);
    const from = chapter === startChapter && startVerse !== null ? startVerse : 1;
    const to = chapter === endChapter && endVerse !== null ? endVerse : total;
    verseCount += to - from + 1;
  }

  const name = writtenName(spelling, startChapter, endChapter);
  return {
    ok: true,
    passage: {
      bookId: spelling.bookId,
      bookName: spelling.name,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      text: formatPassage(name, startChapter, startVerse, endChapter, endVerse),
      verseCount,
    },
  };
}

function formatPassage(
  name: string,
  startChapter: number,
  startVerse: number | null,
  endChapter: number,
  endVerse: number | null
): string {
  if (startVerse === null) {
    return endChapter === startChapter
      ? `${name} ${startChapter}`
      : `${name} ${startChapter}-${endChapter}`;
  }
  if (endChapter !== startChapter) {
    return `${name} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
  }
  if (endVerse === null || endVerse === startVerse) {
    return `${name} ${startChapter}:${startVerse}`;
  }
  return `${name} ${startChapter}:${startVerse}-${endVerse}`;
}

/** The separator between passages in the stored string. */
export const PASSAGE_SEPARATOR = '; ';

/** The longest stored `scriptureReference` -- firestore.rules' isValidPlanDay(). */
export const SCRIPTURE_REFERENCE_MAX_LENGTH = 200;

/** Splits a stored `scriptureReference` into its passages (as typed). */
export function splitPassages(reference: string): string[] {
  return reference
    .split(/;/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Joins passages for storing. */
export function joinPassages(passages: readonly string[]): string {
  return passages
    .map((passage) => passage.trim())
    .filter((passage) => passage.length > 0)
    .join(PASSAGE_SEPARATOR);
}

export interface PassageListCheck {
  /** One result per non-empty passage, in order. */
  results: PassageResult[];
  /** The whole list as it would be stored, canonical where valid, as typed otherwise. */
  stored: string;
  /** Why the list cannot be saved, or null. */
  problem: string | null;
  /** Total verses across the passages (valid ones only). */
  verseCount: number;
}

/**
 * Checks a day's whole list of passages: at least one, each real, and all of
 * them together short enough to store.
 */
export function checkPassageList(passages: readonly string[]): PassageListCheck {
  const typed = passages.map((passage) => passage.trim()).filter((p) => p.length > 0);
  const results = typed.map(parsePassage);
  const stored = joinPassages(
    results.map((result, index) =>
      result.ok ? result.passage.text : (typed[index] ?? '')
    )
  );
  const verseCount = results.reduce(
    (sum, result) => sum + (result.ok ? result.passage.verseCount : 0),
    0
  );

  let problem: string | null = null;
  if (typed.length === 0) {
    problem = 'Add at least one passage.';
  } else if (results.some((result) => !result.ok)) {
    problem = 'Fix the passages marked below.';
  } else if (stored.length > SCRIPTURE_REFERENCE_MAX_LENGTH) {
    problem = `The passages together can be at most ${SCRIPTURE_REFERENCE_MAX_LENGTH} characters. Remove one or shorten them.`;
  }

  return { results, stored, problem, verseCount };
}
