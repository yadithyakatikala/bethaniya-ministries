/**
 * The bilingual alignment policy.
 *
 * ---------------------------------------------------------------------
 * THE ONE RULE
 * ---------------------------------------------------------------------
 * This module must NEVER put an English verse beside a Telugu verse
 * unless it can prove they are the same verse. Everything else here
 * exists to make that guarantee cheap to check and impossible to
 * accidentally break.
 *
 * Correctness of scripture beats visual tidiness: where the two
 * traditions divide text differently, the reader is told so and the two
 * chapters are shown independently, rather than being force-fitted into
 * rows that would be wrong.
 *
 * ---------------------------------------------------------------------
 * WHY THREE PRESENTATIONS AND NOT ONE
 * ---------------------------------------------------------------------
 * `./versificationData.ts` (generated from the bundled Bibles by
 * scripts/derive-versification.mjs) classifies every chapter:
 *
 *   'aligned'    1147 chapters. Both translations cover exactly the same
 *                verse numbers, so pairing is unambiguous -> `paired`.
 *
 *   'divergent'  41 chapters. The Telugu IRV follows Hebrew/Masoretic
 *                chapter division here; e.g. English Numbers 16 runs to
 *                verse 50 while Telugu Numbers 16 stops at 35 and the
 *                remainder sits in Telugu chapter 17. Verse N is NOT
 *                reliably verse N, so we refuse to pair -> `chapterLevel`
 *                with a visible notice. Upgrading these to true pairing
 *                needs an authoritative Paratext/SIL versification table,
 *                which is not bundled -- see /BIBLE_LICENSING.md.
 *
 *   'absent'     1 chapter (English Malachi 4). The Telugu source has no
 *                text for it at all -> `englishOnly`. V1 rendered
 *                SYNTHETIC PLACEHOLDER text here; inventing scripture is
 *                not an option, so V2 says plainly that the passage is
 *                not in this translation.
 *
 * ---------------------------------------------------------------------
 * MERGED VERSE RANGES
 * ---------------------------------------------------------------------
 * The Telugu IRV merges 100 verses into ranges -- Luke 1:39-40 is one
 * translated unit, for instance. The bundled data records that as a span
 * covering both numbers (see scripts/import-telugu-bible.mjs), so a
 * merged span still pairs unambiguously: it takes the English verses it
 * covers, joined, and carries the label "39-40". Nothing is dropped and
 * no number silently disappears, which is exactly what went wrong in V1.
 */
import { alignmentFor, type ChapterAlignment } from './versificationData';
import type { BibleVerse } from './types';

/**
 * One translated unit of Telugu text. `end` is greater than `start` only
 * for a merged range.
 */
export interface VerseSpan {
  start: number;
  end: number;
  text: string;
}

/** A row of the bilingual reader: one Telugu unit beside its English counterpart(s). */
export interface PairedRow {
  /** What to print in the margin -- "16" or "39-40". */
  label: string;
  /** First verse number this row covers. Canonical, never localized. */
  start: number;
  /** Last verse number this row covers; equals `start` unless merged. */
  end: number;
  /** The English verse text, joined with a space when the row covers several. */
  english: string;
  telugu: string;
}

export type BilingualPresentation =
  /** Safe verse-by-verse pairing. */
  | { kind: 'paired'; rows: PairedRow[] }
  /**
   * The chapters exist in both translations but divide their text
   * differently, so each side is shown with its own verse numbers and
   * nothing is paired. The reader MUST surface `notice`.
   */
  | {
      kind: 'chapterLevel';
      notice: 'numberingDiffers';
      english: BibleVerse[];
      telugu: VerseSpan[];
    }
  /** No Telugu text exists for this chapter. */
  | { kind: 'englishOnly'; notice: 'notInTranslation'; english: BibleVerse[] };

/** How the two languages are stacked on screen. Presentation only -- never affects pairing. */
export type BilingualLayout = 'stacked' | 'sideBySide';

function labelFor(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

/**
 * Decides how one chapter may be presented bilingually.
 *
 * `englishVerses` and `teluguSpans` are the raw bundled data for the SAME
 * canonical (bookOrder, chapter). Passing data for a different chapter is
 * a programming error this function cannot detect, which is why the
 * caller is `dataSource.ts` and not a screen.
 *
 * Defensive beyond the classification: even for a chapter the generated
 * data calls 'aligned', every span is re-checked against the English
 * verses actually present. If a span reaches past the English text --
 * which would mean the bundled data and the generated classification have
 * drifted apart -- this degrades to `chapterLevel` rather than emitting a
 * row it cannot substantiate. The generated file is regenerated from the
 * same data, so the two should never disagree; if they ever do, the
 * failure mode is a less tidy screen, never a wrong verse.
 */
export function buildBilingualChapter(
  bookOrder: number,
  chapter: number,
  englishVerses: BibleVerse[],
  teluguSpans: VerseSpan[] | null
): BilingualPresentation {
  const classification: ChapterAlignment = alignmentFor(bookOrder, chapter);

  if (classification === 'absent' || !teluguSpans || teluguSpans.length === 0) {
    return { kind: 'englishOnly', notice: 'notInTranslation', english: englishVerses };
  }

  if (classification === 'divergent') {
    return {
      kind: 'chapterLevel',
      notice: 'numberingDiffers',
      english: englishVerses,
      telugu: teluguSpans,
    };
  }

  const byNumber = new Map(englishVerses.map((verse) => [verse.number, verse.text]));
  const rows: PairedRow[] = [];

  for (const span of teluguSpans) {
    const covered: string[] = [];
    for (let verse = span.start; verse <= span.end; verse += 1) {
      const text = byNumber.get(verse);
      // The English side does not have a verse this Telugu span claims to
      // cover. Refuse to pair the whole chapter rather than guess.
      if (text === undefined) {
        return {
          kind: 'chapterLevel',
          notice: 'numberingDiffers',
          english: englishVerses,
          telugu: teluguSpans,
        };
      }
      covered.push(text);
    }
    rows.push({
      label: labelFor(span.start, span.end),
      start: span.start,
      end: span.end,
      english: covered.join(' '),
      telugu: span.text,
    });
  }

  // Every English verse must be accounted for exactly once. A shortfall
  // means the Telugu spans do not cover the chapter, so pairing would
  // silently hide English text.
  const pairedCount = rows.reduce((total, row) => total + (row.end - row.start + 1), 0);
  if (pairedCount !== englishVerses.length) {
    return {
      kind: 'chapterLevel',
      notice: 'numberingDiffers',
      english: englishVerses,
      telugu: teluguSpans,
    };
  }

  return { kind: 'paired', rows };
}

/**
 * Formats a verse for sharing or copying, with its reference.
 *
 * `bookName` is a DISPLAY name and must be resolved by the caller through
 * books.ts's getBookName() for the reader's current language -- it is
 * never an identifier. See mobile/src/features/bible/books.ts.
 */
export function formatVerseForSharing(options: {
  bookName: string;
  chapter: number;
  label: string;
  text: string;
  translationName: string;
}): string {
  const { bookName, chapter, label, text, translationName } = options;
  return `"${text.trim()}"\n\n${bookName} ${chapter}:${label} (${translationName})`;
}
