#!/usr/bin/env node
/**
 * Derives, for every one of the 1189 canonical chapters, whether the
 * English and Telugu Bibles can be safely paired verse by verse.
 *
 * ---------------------------------------------------------------------
 * WHY THIS IS GENERATED, NOT HAND-WRITTEN
 * ---------------------------------------------------------------------
 * The bilingual reader must never put the wrong Telugu verse under an
 * English one. Deciding that per chapter is a question about the actual
 * bundled data, so it is answered BY the data at build time rather than
 * by a list somebody typed from memory. Re-running this after any Bible
 * import refreshes the answer; the alignment policy has no opinions of
 * its own.
 *
 * ---------------------------------------------------------------------
 * THE FOUR CLASSIFICATIONS
 * ---------------------------------------------------------------------
 *   aligned    Both translations cover exactly the same verse numbers.
 *              Verse-by-verse pairing is safe. (The Telugu side may still
 *              MERGE verses into ranges -- a range covering 39-40 still
 *              covers both numbers, so the pairing is unambiguous.)
 *
 *   divergent  The verse sets differ, because the Telugu IRV follows
 *              Hebrew/Masoretic chapter division where the English
 *              tradition differs. Example: English Numbers 16 runs to
 *              verse 50, Telugu Numbers 16 stops at 35 and the remaining
 *              text is in Telugu chapter 17.
 *
 *              Pairing verse N with verse N would be correct for the
 *              overlapping prefix and WRONG past it, and this script
 *              cannot prove where the remainder landed without an
 *              authoritative versification table (Paratext/SIL .vrs,
 *              not reachable from the build environment -- see
 *              /BIBLE_LICENSING.md). So these chapters are marked for
 *              chapter-level presentation instead: both chapters shown
 *              side by side, each with its own verse numbers, nothing
 *              paired. Honest, if less tightly aligned.
 *
 *   absent     The Telugu IRV has no text for this chapter at all.
 *              Exactly two chapters: English Joel 3 and Malachi 4, whose
 *              text is genuinely missing from the source corpus (their
 *              Hebrew-numbered slots are empty upstream). The reader must
 *              say so. V1 rendered SYNTHETIC PLACEHOLDER TEXT here, which
 *              is invented scripture and is removed in V2.
 *
 *   englishOnly  A chapter the Telugu side does not reach because its
 *              own chapter count for the book is lower.
 *
 * Verse identity is always (bookOrder, chapter, verse). Localized book
 * names are never identifiers.
 *
 * Usage:  node scripts/derive-versification.mjs [--check]
 *         --check exits non-zero if the generated file is stale.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const EN_PATH = 'mobile/src/features/bible/data/web-en.json';
const TE_PATH = 'mobile/src/features/bible/data/irv-te.json';
const OUT = 'mobile/src/features/bible/versificationData.ts';

const english = JSON.parse(readFileSync(EN_PATH, 'utf8'));
const telugu = JSON.parse(readFileSync(TE_PATH, 'utf8'));

/** Chapter counts come from the canon metadata, which is the authority. */
const booksSource = readFileSync('mobile/src/features/bible/books.ts', 'utf8');
const chapterCounts = new Map(
  [...booksSource.matchAll(/order:\s*(\d+),\s*chapterCount:\s*(\d+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ])
);
if (chapterCounts.size !== 66) {
  throw new Error(`parsed ${chapterCounts.size} books from books.ts, expected 66`);
}

/** Verse numbers a span list covers, inclusive of merged ranges. */
function coveredVerses(spans) {
  const covered = new Set();
  for (const [start, end] of spans) {
    for (let v = start; v <= end; v += 1) covered.add(v);
  }
  return covered;
}

const classifications = {};
const tally = { aligned: 0, divergent: 0, absent: 0, englishOnly: 0 };
const divergentDetail = [];
const absentChapters = [];
let mergedChapters = 0;

for (let order = 1; order <= 66; order += 1) {
  const chapterCount = chapterCounts.get(order);
  for (let chapter = 1; chapter <= chapterCount; chapter += 1) {
    const enVerses = english[String(order)]?.[String(chapter)];
    const teSpans = telugu[String(order)]?.[String(chapter)];
    const key = `${order}:${chapter}`;

    if (!enVerses) {
      throw new Error(`English Bible is missing ${key} — refusing to generate`);
    }
    const enCount = enVerses.length;

    if (!teSpans || teSpans.length === 0) {
      classifications[key] = 'absent';
      tally.absent += 1;
      absentChapters.push(key);
      continue;
    }

    const covered = coveredVerses(teSpans);
    const hasMerge = teSpans.some(([start, end]) => end > start);
    let identical = covered.size === enCount;
    if (identical) {
      for (let v = 1; v <= enCount; v += 1) {
        if (!covered.has(v)) {
          identical = false;
          break;
        }
      }
    }

    if (identical) {
      classifications[key] = 'aligned';
      tally.aligned += 1;
      if (hasMerge) mergedChapters += 1;
    } else {
      classifications[key] = 'divergent';
      tally.divergent += 1;
      const maxCovered = Math.max(...covered);
      divergentDetail.push({
        key,
        english: enCount,
        teluguCovers: maxCovered,
        overlap: Math.min(enCount, maxCovered),
      });
    }
  }
}

const header = `/**
 * GENERATED by scripts/derive-versification.mjs — do not edit by hand.
 *
 * For every canonical chapter, whether English and Telugu may be paired
 * verse by verse. See that script's header for what each value means and
 * why this is derived from the bundled data rather than hand-listed.
 *
 * Regenerate after any Bible import:
 *   node scripts/derive-versification.mjs
 * Verify it is current (CI / pre-commit):
 *   node scripts/derive-versification.mjs --check
 */

/** How a chapter's two translations may be presented together. */
export type ChapterAlignment =
  /** Same verse numbers in both. Verse-by-verse pairing is safe. */
  | 'aligned'
  /** Verse sets differ (Hebrew vs English chapter division). Chapter-level only. */
  | 'divergent'
  /** No Telugu text exists for this chapter in the source. */
  | 'absent';

/** Keyed \`\${bookOrder}:\${chapter}\`. Absent keys are 'aligned'. */
export const CHAPTER_ALIGNMENT: Readonly<Record<string, ChapterAlignment>> = Object.freeze({
`;

// Only the exceptions are emitted; 'aligned' is the default, which keeps
// the generated file small and makes the exceptional cases readable.
const exceptions = Object.entries(classifications)
  .filter(([, value]) => value !== 'aligned')
  .sort((a, b) => {
    const [ao, ac] = a[0].split(':').map(Number);
    const [bo, bc] = b[0].split(':').map(Number);
    return ao - bo || ac - bc;
  });

const body = exceptions.map(([key, value]) => `  '${key}': '${value}',`).join('\n');

const footer = `
});

/** Total canonical chapters covered by the derivation. */
export const TOTAL_CHAPTERS = ${tally.aligned + tally.divergent + tally.absent};

/** Chapters safe for verse-by-verse bilingual pairing. */
export const ALIGNED_CHAPTERS = ${tally.aligned};

/** Chapters where the two traditions divide text differently. */
export const DIVERGENT_CHAPTERS = ${tally.divergent};

/** Chapters with no Telugu text in the source at all. */
export const ABSENT_CHAPTERS = ${tally.absent};

/** Aligned chapters that nonetheless merge some verses into ranges. */
export const MERGED_RANGE_CHAPTERS = ${mergedChapters};

export function alignmentFor(bookOrder: number, chapter: number): ChapterAlignment {
  return CHAPTER_ALIGNMENT[\`\${bookOrder}:\${chapter}\`] ?? 'aligned';
}
`;

const generated = header + body + footer;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== generated) {
    console.error(
      `\n${OUT} is STALE.\nRun: node scripts/derive-versification.mjs\n`
    );
    process.exit(1);
  }
  console.log(`${OUT} is up to date.`);
  process.exit(0);
}

writeFileSync(OUT, generated);

console.log('');
console.log('Versification derivation');
console.log(`  chapters examined     ${tally.aligned + tally.divergent + tally.absent}`);
console.log(`  aligned (verse-pairable)  ${tally.aligned}`);
console.log(`     …of which merge ranges ${mergedChapters}`);
console.log(`  divergent (chapter-level) ${tally.divergent}`);
console.log(`  absent (no Telugu text)   ${tally.absent}  ${absentChapters.join(', ')}`);
console.log('');
console.log('  divergent chapters (english verses / telugu reaches):');
for (const d of divergentDetail) {
  console.log(`    ${d.key.padEnd(8)} en=${String(d.english).padStart(3)}  te=${String(d.teluguCovers).padStart(3)}`);
}
console.log('');
console.log(`  written: ${OUT}`);
console.log('');
