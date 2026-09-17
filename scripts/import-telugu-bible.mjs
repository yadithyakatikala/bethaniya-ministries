#!/usr/bin/env node
/**
 * Imports the Telugu Bible from its authoritative source into the app's
 * bundled data file, PRESERVING the two facts the V1 import silently
 * threw away.
 *
 * ---------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------
 * V1 imported the same corpus but kept only lines that carried text. The
 * source marks two other states, and dropping them produced a Bible that
 * looked broken:
 *
 *   `<range>`  The verse is part of a MERGED verse range -- its text sits
 *              on the first verse of the range. The Telugu IRV merges 100
 *              verses this way (e.g. Luke 1:39-40 is one translated
 *              unit). V1 dropped these lines, so the reader showed verse
 *              39 then verse 41 and the numbering appeared to skip. The
 *              SCRIPTURE WAS NEVER MISSING -- only the range metadata.
 *
 *   (empty)    The verse does not exist in this translation's
 *              versification. 202 canon slots are empty because the
 *              Telugu IRV follows Hebrew/Masoretic chapter division for
 *              some passages where the English tradition differs (e.g.
 *              English Joel 3 and Malachi 4 have no counterpart chapter).
 *              These are legitimately absent, not lost.
 *
 * ---------------------------------------------------------------------
 * SOURCE AND LICENCE (verified at import time, see --report)
 * ---------------------------------------------------------------------
 *   Corpus   BibleNLP/ebible  corpus/tel-tel2017.txt
 *   Index    BibleNLP/ebible  metadata/vref.txt   (line-aligned 1:1)
 *   Licence  metadata/licences.tsv row `tel2017`:
 *              ఇండియన్ రివైజ్డ్ వెర్షన్ (IRV) - తెలుగు -2019
 *              CC BY-SA 4.0
 *              © 2017, 2019 Bridge Connectivity Solutions
 *
 * The licence row is re-read and asserted on every run: if the upstream
 * licence ever changes, the import FAILS rather than silently
 * redistributing text under terms we have not checked.
 *
 * ---------------------------------------------------------------------
 * OUTPUT FORMAT
 * ---------------------------------------------------------------------
 *   { "<bookOrder>": { "<chapter>": [ [startVerse, endVerse, text], ... ] } }
 *
 * `endVerse` equals `startVerse` for an ordinary verse and is greater for
 * a merged range, so a reader can label "39-40" honestly. A verse number
 * covered by NO span is absent from this translation -- the reader must
 * say so rather than shifting the next verse up into its place.
 *
 * Verse identity is always (bookOrder, chapter, verse) -- never a
 * localized book name. See mobile/src/features/bible/books.ts.
 *
 * ---------------------------------------------------------------------
 * USAGE
 * ---------------------------------------------------------------------
 *   node scripts/import-telugu-bible.mjs --fetch          # download + import
 *   node scripts/import-telugu-bible.mjs --src <dir>      # use local files
 *   node scripts/import-telugu-bible.mjs --fetch --report  # don't write, just report
 *
 * Idempotent: re-running with the same source produces a byte-identical
 * file. Never deletes anything.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const RAW = 'https://raw.githubusercontent.com/BibleNLP/ebible/main';
const SOURCES = {
  'vref.txt': `${RAW}/metadata/vref.txt`,
  'tel-tel2017.txt': `${RAW}/corpus/tel-tel2017.txt`,
  'licences.tsv': `${RAW}/metadata/licences.tsv`,
};

const OUT = 'mobile/src/features/bible/data/irv-te.json';

/** USFM book codes in Protestant canon order -- index 0 is book order 1. */
const CANON = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT',
  'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP',
  'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];
const ORDER_OF = new Map(CANON.map((code, i) => [code, i + 1]));

/** The licence facts this import is allowed to redistribute under. */
const EXPECTED_LICENCE = {
  id: 'tel2017',
  type: 'by-sa',
  version: '4.0',
  holder: 'Bridge Connectivity Solutions',
};

const args = process.argv.slice(2);
const wantFetch = args.includes('--fetch');
const reportOnly = args.includes('--report');
const srcDirArg = args.indexOf('--src');
const srcDir = srcDirArg >= 0 ? args[srcDirArg + 1] : '.bible-src';

async function obtainSources() {
  if (!existsSync(srcDir)) mkdirSync(srcDir, { recursive: true });
  for (const [name, url] of Object.entries(SOURCES)) {
    const path = join(srcDir, name);
    if (existsSync(path) && !wantFetch) continue;
    if (!wantFetch) {
      fail(`missing ${path}\n  Run with --fetch, or download it yourself from:\n  ${url}`);
    }
    process.stderr.write(`fetching ${name}… `);
    const response = await fetch(url);
    if (!response.ok) fail(`HTTP ${response.status} for ${url}`);
    writeFileSync(path, await response.text());
    process.stderr.write('ok\n');
  }
}

function fail(message) {
  console.error(`\nIMPORT FAILED: ${message}\n`);
  process.exit(1);
}

/** Re-checks the upstream licence row before redistributing any text. */
function assertLicence() {
  const tsv = readFileSync(join(srcDir, 'licences.tsv'), 'utf8').split('\n');
  const header = tsv[0].split('\t');
  const col = (name) => header.indexOf(name);
  const row = tsv.find((line) => line.split('\t')[0] === EXPECTED_LICENCE.id);
  if (!row) fail(`no licence row for '${EXPECTED_LICENCE.id}' in licences.tsv`);
  const cells = row.split('\t');
  const actual = {
    type: cells[col('Licence Type')],
    version: cells[col('Licence Version')],
    holder: cells[col('Copyright Holder')],
  };
  for (const key of ['type', 'version', 'holder']) {
    if (actual[key] !== EXPECTED_LICENCE[key]) {
      fail(
        `upstream licence changed for ${EXPECTED_LICENCE.id}: ${key} is ` +
          `'${actual[key]}', expected '${EXPECTED_LICENCE[key]}'.\n` +
          `  Do NOT redistribute this text until the new terms are reviewed ` +
          `and /BIBLE_LICENSING.md is updated.`
      );
    }
  }
  return {
    title: cells[col('Vernacular Title')],
    link: cells[col('CC Licence Link')],
    years: cells[col('Copyright Years')],
    ...actual,
  };
}

function build() {
  const vref = readFileSync(join(srcDir, 'vref.txt'), 'utf8').split('\n');
  const corpus = readFileSync(join(srcDir, 'tel-tel2017.txt'), 'utf8').split('\n');
  if (vref.length !== corpus.length) {
    fail(`vref.txt (${vref.length} lines) and the corpus (${corpus.length}) are not aligned`);
  }

  const data = {};
  const stats = { text: 0, range: 0, absent: 0, nonCanon: 0 };
  /** Every `<range>` line, so the report can show what got merged. */
  const merges = [];
  /** Every empty canon slot, grouped, for the versification report. */
  const absences = [];

  // A `<range>` line extends the span opened by the most recent verse
  // that carried text -- but only within the same chapter, so a marker
  // can never reach back across a chapter boundary.
  let openSpan = null;
  let openKey = null;

  for (let i = 0; i < vref.length; i += 1) {
    const ref = vref[i].trim();
    if (!ref) continue;
    const [code, cv] = ref.split(' ');
    const order = ORDER_OF.get(code);
    if (!order) {
      stats.nonCanon += 1;
      continue;
    }
    const [chapterText, verseText] = cv.split(':');
    const chapter = Number(chapterText);
    const verse = Number(verseText);
    const key = `${order}:${chapter}`;
    const line = (corpus[i] ?? '').trim();

    if (key !== openKey) {
      openSpan = null;
      openKey = key;
    }

    if (line === '') {
      stats.absent += 1;
      absences.push(ref);
      openSpan = null;
      continue;
    }

    if (line === '<range>') {
      if (!openSpan) {
        fail(`<range>Range marker at ${ref} with no preceding verse text in the chapter`);
      }
      stats.range += 1;
      openSpan[1] = verse;
      merges.push(ref);
      continue;
    }

    if (line.startsWith('<') && line.endsWith('>')) {
      fail(`unrecognised marker ${JSON.stringify(line)} at ${ref}`);
    }

    data[order] ??= {};
    data[order][chapter] ??= [];
    openSpan = [verse, verse, line];
    data[order][chapter].push(openSpan);
    stats.text += 1;
  }

  return { data, stats, merges, absences };
}

/**
 * Structural checks. Any failure means the output must not be shipped.
 * Deliberately strict: a Bible that silently loses or reorders verses is
 * worse than an import that refuses to run.
 */
function validate(data) {
  const problems = [];
  for (let order = 1; order <= 66; order += 1) {
    const book = data[order];
    if (!book) {
      problems.push(`book ${order} (${CANON[order - 1]}) has no chapters at all`);
      continue;
    }
    for (const [chapterKey, spans] of Object.entries(book)) {
      const where = `${CANON[order - 1]} ${chapterKey}`;
      if (!spans.length) problems.push(`${where}: empty chapter`);
      let previousEnd = 0;
      for (const [start, end, text] of spans) {
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          problems.push(`${where}: non-integer span ${start}-${end}`);
        }
        if (end < start) problems.push(`${where}: span ${start}-${end} ends before it starts`);
        if (start <= previousEnd) {
          problems.push(`${where}: span ${start}-${end} overlaps or precedes ${previousEnd}`);
        }
        if (typeof text !== 'string' || text.length === 0) {
          problems.push(`${where}: verse ${start} has no text`);
        }
        previousEnd = end;
      }
    }
  }
  return problems;
}

// --- run ---------------------------------------------------------------
await obtainSources();
const licence = assertLicence();
const { data, stats, merges, absences } = build();
const problems = validate(data);

const chapters = Object.values(data).reduce((sum, book) => sum + Object.keys(book).length, 0);
const spans = Object.values(data).reduce(
  (sum, book) => sum + Object.values(book).reduce((n, c) => n + c.length, 0),
  0
);

console.log('');
console.log('Telugu Bible import');
console.log('  source   BibleNLP/ebible corpus/tel-tel2017.txt (line-aligned to vref.txt)');
console.log(`  title    ${licence.title}`);
console.log(`  licence  CC ${licence.type.toUpperCase()} ${licence.version} — ${licence.link}`);
console.log(`  holder   ${licence.holder}, ${licence.years}`);
console.log('');
console.log(`  chapters imported          ${chapters}`);
console.log(`  translated units (spans)   ${spans}`);
console.log(`  verses carrying text       ${stats.text}`);
console.log(`  verses merged via <range>  ${stats.range}`);
console.log(`  verses absent (versification) ${stats.absent}`);
console.log(`  non-canon slots skipped    ${stats.nonCanon}`);
console.log('');

const byBook = {};
for (const ref of absences) {
  const book = ref.split(' ')[0];
  byBook[book] = (byBook[book] || 0) + 1;
}
console.log('  absences by book: ' + JSON.stringify(byBook));
console.log(`  first merges: ${merges.slice(0, 6).join(', ')}`);
console.log('');

if (problems.length) {
  console.error(`VALIDATION FAILED — ${problems.length} problem(s):`);
  problems.slice(0, 40).forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('  validation: OK (no gaps, no overlaps, no empty text)');

if (reportOnly) {
  console.log('\n  --report given: nothing written.\n');
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
// Stable key order so re-running is byte-identical and diffs stay readable.
const ordered = {};
for (let order = 1; order <= 66; order += 1) {
  const book = data[order];
  ordered[order] = {};
  for (const chapter of Object.keys(book).map(Number).sort((a, b) => a - b)) {
    ordered[order][chapter] = book[chapter];
  }
}
writeFileSync(OUT, JSON.stringify(ordered));
console.log(`  written: ${OUT}\n`);
