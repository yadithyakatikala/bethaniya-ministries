#!/usr/bin/env node
/**
 * Derives the app's BUILT-IN YEAR -- 365 verse references, one for every
 * day a year can hold.
 *
 * ---------------------------------------------------------------------
 * WHY 365 REFERENCES AND NOT A SCHEDULE
 * ---------------------------------------------------------------------
 * The Verse of the Day has been automatic since M5: the app works out
 * which verse today's is from the date, a seed and a pool version, with
 * no stored "today's pick" and nothing to publish each morning (see
 * mobile/src/features/daily-verses/votdSelection.ts). The rotation steps
 * through a pool of `n` entries by a stride coprime with `n`, so it
 * visits every entry exactly once before any repeat: AN n-ENTRY POOL IS
 * AN n-DAY CYCLE.
 *
 * What was missing was not the machinery. It was the verses. The app
 * shipped with twelve built-in references, so a church that had not
 * curated a pool of its own got a twelve-day cycle -- the same verse
 * every twelfth morning. This file supplies 365 of them instead, and the
 * unchanged algorithm turns them into a year.
 *
 * NO NEW SCHEDULING SYSTEM IS INTRODUCED HERE. There is no day-number
 * column, no per-date document, and nothing for an administrator to
 * create. The only thing that changed is how many verses the existing
 * rotation has to rotate through.
 *
 * ---------------------------------------------------------------------
 * WHY THE LIST IS VALIDATED RATHER THAN TRUSTED
 * ---------------------------------------------------------------------
 * A reference that does not resolve is not a visible error -- it is a
 * morning on which the congregation silently gets nothing, or the wrong
 * thing. So every entry below is checked against BOTH bundled corpora
 * before a line is written:
 *
 *   web-en.json   the chapter exists and has that verse number
 *   irv-te.json   the chapter exists and some translated unit covers
 *                 that verse number (Telugu merges verses, so the test
 *                 is a span test, not an equality)
 *
 * A church member reading in Telugu must not get an empty card on the
 * days an English-only reference came up, which is why the Telugu check
 * is a hard failure rather than a warning. One otherwise well-known
 * reference is absent for exactly this reason -- Joel 2:28, which the
 * Telugu tradition numbers as part of chapter 3.
 *
 * NO SCRIPTURE TEXT IS COPIED. The generated file holds 365 references:
 * a book slug, two numbers and the English display name. The words
 * themselves are resolved from the bundled corpus at render time, by the
 * same code path every other verse in the app goes through.
 *
 * ---------------------------------------------------------------------
 * THE LIST ITSELF
 * ---------------------------------------------------------------------
 * Well-known, devotional, and spread across the canon: 60 of the 66
 * books are represented. It is deliberately NOT a reading plan and not a
 * lectionary -- the order below is simply canonical, and the rotation
 * reorders it anyway. A church that wants its own selection curates the
 * pool in the dashboard, which takes precedence over every line here.
 *
 * Regenerate:  node scripts/derive-votd-year.mjs
 * Verify:      node scripts/derive-votd-year.mjs --check
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const EN = resolve(REPO, 'mobile/src/features/bible/data/web-en.json');
const TE = resolve(REPO, 'mobile/src/features/bible/data/irv-te.json');
const BOOKS = resolve(REPO, 'mobile/src/features/bible/books.ts');

/**
 * Both copies are written, byte for byte identical -- the admin
 * dashboard needs the same year as the phone in order to show the
 * schedule, and the two packages share no code. The generated module has
 * no imports precisely so the two files can be compared directly;
 * admin/src/features/daily-verses/__tests__/votdYear.test.ts reads the
 * mobile copy off disk and fails if they drift.
 */
const OUTPUTS = [
  resolve(REPO, 'mobile/src/features/daily-verses/votdYear.ts'),
  resolve(REPO, 'admin/src/features/daily-verses/votdYear.ts'),
];

/** The curated year, in canonical order. Referenced, never quoted. */
const YEAR = [
  'genesis 1:1',
  'genesis 1:27',
  'genesis 2:3',
  'genesis 8:22',
  'genesis 12:2',
  'genesis 15:1',
  'genesis 18:14',
  'genesis 28:15',
  'genesis 31:49',
  'genesis 50:20',
  'exodus 14:14',
  'exodus 15:2',
  'exodus 20:12',
  'exodus 23:25',
  'exodus 33:14',
  'leviticus 19:18',
  'leviticus 26:12',
  'numbers 6:24',
  'numbers 6:26',
  'deuteronomy 4:29',
  'deuteronomy 6:5',
  'deuteronomy 8:3',
  'deuteronomy 28:6',
  'deuteronomy 30:19',
  'deuteronomy 31:6',
  'deuteronomy 33:27',
  'joshua 1:8',
  'joshua 1:9',
  'joshua 24:15',
  'ruth 1:16',
  'ruth 2:12',
  '1-samuel 2:2',
  '1-samuel 15:22',
  '1-samuel 16:7',
  '2-samuel 22:2',
  '2-samuel 22:31',
  '1-kings 8:23',
  '1-kings 18:21',
  '2-kings 6:16',
  '1-chronicles 4:10',
  '1-chronicles 16:11',
  '1-chronicles 16:34',
  '1-chronicles 29:11',
  '2-chronicles 7:14',
  '2-chronicles 16:9',
  '2-chronicles 20:15',
  'ezra 8:22',
  'nehemiah 1:11',
  'nehemiah 4:14',
  'nehemiah 9:6',
  'job 1:21',
  'job 5:9',
  'job 19:25',
  'job 23:10',
  'job 28:28',
  'job 42:2',
  'psalms 1:1',
  'psalms 1:3',
  'psalms 3:3',
  'psalms 5:3',
  'psalms 9:9',
  'psalms 9:10',
  'psalms 16:11',
  'psalms 18:2',
  'psalms 19:1',
  'psalms 19:14',
  'psalms 23:1',
  'psalms 23:2',
  'psalms 23:3',
  'psalms 23:4',
  'psalms 25:4',
  'psalms 27:1',
  'psalms 27:4',
  'psalms 27:14',
  'psalms 29:11',
  'psalms 31:24',
  'psalms 32:8',
  'psalms 34:1',
  'psalms 34:4',
  'psalms 34:8',
  'psalms 34:18',
  'psalms 37:4',
  'psalms 37:5',
  'psalms 37:7',
  'psalms 40:1',
  'psalms 42:11',
  'psalms 46:1',
  'psalms 46:5',
  'psalms 46:10',
  'psalms 51:10',
  'psalms 55:22',
  'psalms 56:3',
  'psalms 59:16',
  'psalms 62:1',
  'psalms 63:1',
  'psalms 63:3',
  'psalms 68:19',
  'psalms 73:26',
  'psalms 84:11',
  'psalms 86:15',
  'psalms 90:12',
  'psalms 91:1',
  'psalms 91:2',
  'psalms 91:11',
  'psalms 94:19',
  'psalms 96:1',
  'psalms 100:4',
  'psalms 100:5',
  'psalms 103:1',
  'psalms 103:8',
  'psalms 103:12',
  'psalms 107:1',
  'psalms 116:1',
  'psalms 118:6',
  'psalms 118:24',
  'psalms 119:9',
  'psalms 119:105',
  'psalms 119:114',
  'psalms 121:1',
  'psalms 121:3',
  'psalms 121:7',
  'psalms 126:3',
  'psalms 127:1',
  'psalms 133:1',
  'psalms 138:8',
  'psalms 139:1',
  'psalms 139:14',
  'psalms 143:8',
  'psalms 145:9',
  'psalms 145:18',
  'psalms 147:3',
  'psalms 150:6',
  'proverbs 1:7',
  'proverbs 3:5',
  'proverbs 3:6',
  'proverbs 3:9',
  'proverbs 4:23',
  'proverbs 10:12',
  'proverbs 11:25',
  'proverbs 13:20',
  'proverbs 16:3',
  'proverbs 16:9',
  'proverbs 16:24',
  'proverbs 17:17',
  'proverbs 18:10',
  'proverbs 18:24',
  'proverbs 19:21',
  'proverbs 22:6',
  'proverbs 27:17',
  'proverbs 28:13',
  'proverbs 30:5',
  'proverbs 31:25',
  'ecclesiastes 3:1',
  'ecclesiastes 3:11',
  'ecclesiastes 4:12',
  'ecclesiastes 7:8',
  'song-of-solomon 2:1',
  'isaiah 1:18',
  'isaiah 6:8',
  'isaiah 9:6',
  'isaiah 12:2',
  'isaiah 25:1',
  'isaiah 26:3',
  'isaiah 30:21',
  'isaiah 33:2',
  'isaiah 40:8',
  'isaiah 40:31',
  'isaiah 41:10',
  'isaiah 41:13',
  'isaiah 43:1',
  'isaiah 43:2',
  'isaiah 43:19',
  'isaiah 49:15',
  'isaiah 53:5',
  'isaiah 54:10',
  'isaiah 55:6',
  'isaiah 55:8',
  'isaiah 58:11',
  'isaiah 60:1',
  'isaiah 61:3',
  'jeremiah 1:5',
  'jeremiah 17:7',
  'jeremiah 17:14',
  'jeremiah 29:11',
  'jeremiah 29:13',
  'jeremiah 32:17',
  'jeremiah 33:3',
  'lamentations 3:22',
  'lamentations 3:23',
  'lamentations 3:25',
  'ezekiel 36:26',
  'daniel 2:20',
  'daniel 3:17',
  'daniel 6:23',
  'daniel 12:3',
  'hosea 14:4',
  'joel 2:13',
  'amos 5:24',
  'jonah 2:2',
  'jonah 2:9',
  'micah 6:8',
  'micah 7:18',
  'nahum 1:7',
  'habakkuk 3:19',
  'zephaniah 3:17',
  'zechariah 4:6',
  'zechariah 9:9',
  'malachi 3:6',
  'malachi 3:10',
  'matthew 5:6',
  'matthew 5:14',
  'matthew 5:16',
  'matthew 5:44',
  'matthew 6:9',
  'matthew 6:24',
  'matthew 6:33',
  'matthew 6:34',
  'matthew 7:12',
  'matthew 10:30',
  'matthew 11:28',
  'matthew 16:24',
  'matthew 18:20',
  'matthew 19:26',
  'matthew 21:22',
  'matthew 22:39',
  'matthew 28:19',
  'matthew 28:20',
  'mark 9:23',
  'mark 10:27',
  'mark 11:24',
  'mark 12:30',
  'mark 16:15',
  'luke 1:37',
  'luke 4:18',
  'luke 6:38',
  'luke 9:23',
  'luke 10:27',
  'luke 12:7',
  'luke 18:27',
  'luke 19:10',
  'john 1:1',
  'john 1:12',
  'john 3:16',
  'john 3:17',
  'john 4:24',
  'john 8:12',
  'john 8:32',
  'john 10:10',
  'john 10:11',
  'john 11:25',
  'john 13:34',
  'john 14:1',
  'john 14:6',
  'john 14:15',
  'john 14:27',
  'john 15:5',
  'john 15:7',
  'john 16:33',
  'john 20:29',
  'acts 1:8',
  'acts 4:12',
  'acts 16:31',
  'acts 17:28',
  'acts 20:35',
  'romans 1:16',
  'romans 5:1',
  'romans 5:8',
  'romans 6:23',
  'romans 8:1',
  'romans 8:28',
  'romans 8:31',
  'romans 8:38',
  'romans 10:9',
  'romans 10:13',
  'romans 12:2',
  'romans 12:12',
  'romans 15:13',
  '1-corinthians 1:9',
  '1-corinthians 2:9',
  '1-corinthians 10:13',
  '1-corinthians 13:4',
  '1-corinthians 13:13',
  '1-corinthians 15:58',
  '1-corinthians 16:14',
  '2-corinthians 1:3',
  '2-corinthians 3:17',
  '2-corinthians 4:16',
  '2-corinthians 5:7',
  '2-corinthians 5:17',
  '2-corinthians 9:7',
  '2-corinthians 12:9',
  'galatians 2:20',
  'galatians 5:1',
  'galatians 5:22',
  'galatians 5:23',
  'galatians 6:9',
  'ephesians 1:7',
  'ephesians 2:8',
  'ephesians 2:10',
  'ephesians 3:20',
  'ephesians 4:29',
  'ephesians 4:32',
  'ephesians 5:2',
  'ephesians 6:10',
  'philippians 1:6',
  'philippians 2:3',
  'philippians 2:13',
  'philippians 3:14',
  'philippians 4:6',
  'philippians 4:7',
  'philippians 4:8',
  'philippians 4:13',
  'philippians 4:19',
  'colossians 1:17',
  'colossians 3:2',
  'colossians 3:15',
  'colossians 3:16',
  'colossians 3:23',
  '1-thessalonians 5:16',
  '1-thessalonians 5:17',
  '1-thessalonians 5:18',
  '2-thessalonians 3:3',
  '2-thessalonians 3:16',
  '1-timothy 4:12',
  '1-timothy 6:6',
  '2-timothy 1:7',
  '2-timothy 2:15',
  '2-timothy 3:16',
  'titus 2:11',
  'titus 3:5',
  'hebrews 4:12',
  'hebrews 4:16',
  'hebrews 10:23',
  'hebrews 10:24',
  'hebrews 11:1',
  'hebrews 12:1',
  'hebrews 12:2',
  'hebrews 13:5',
  'hebrews 13:8',
  'james 1:2',
  'james 1:5',
  'james 1:12',
  'james 1:17',
  'james 4:7',
  'james 4:8',
  '1-peter 1:3',
  '1-peter 3:15',
  '1-peter 4:10',
  '1-peter 5:7',
  '1-peter 5:8',
  '2-peter 3:9',
  '2-peter 3:18',
  '1-john 1:9',
  '1-john 3:1',
  '1-john 4:4',
  '1-john 4:16',
  '1-john 4:19',
  '1-john 5:14',
  '2-john 1:6',
  'jude 1:24',
  'revelation 3:20',
  'revelation 4:11',
  'revelation 5:13',
  'revelation 21:4',
  'revelation 22:13',];

const EXPECTED_LENGTH = 365;

/** id/name/order/chapterCount, read from the app's own book table. */
function readBooks() {
  const source = readFileSync(BOOKS, 'utf8');
  const books = new Map();
  const entry =
    /id:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',[\s\S]*?order:\s*(\d+),\s*\n\s*chapterCount:\s*(\d+),/g;
  let match;
  while ((match = entry.exec(source)) !== null) {
    books.set(match[1], {
      id: match[1],
      name: match[2],
      order: Number(match[3]),
      chapterCount: Number(match[4]),
    });
  }
  if (books.size !== 66) {
    throw new Error(`Parsed ${books.size} books from ${BOOKS}, expected 66.`);
  }
  return books;
}

const books = readBooks();
const en = JSON.parse(readFileSync(EN, 'utf8'));
const te = JSON.parse(readFileSync(TE, 'utf8'));

if (YEAR.length !== EXPECTED_LENGTH) {
  throw new Error(`The year holds ${YEAR.length} references, expected ${EXPECTED_LENGTH}.`);
}

const seen = new Set();
const entries = YEAR.map((line, index) => {
  const match = /^([a-z0-9-]+) (\d+):(\d+)$/.exec(line);
  if (!match) throw new Error(`Malformed reference: "${line}".`);
  const [, bookId, rawChapter, rawVerse] = match;
  const chapter = Number(rawChapter);
  const verse = Number(rawVerse);

  const book = books.get(bookId);
  if (!book) throw new Error(`Unknown book slug "${bookId}" in "${line}".`);
  if (chapter < 1 || chapter > book.chapterCount) {
    throw new Error(`${book.name} has no chapter ${chapter} ("${line}").`);
  }

  // A repeat would shrink the year: the pool is de-duplicated by
  // reference before the rotation runs, so 365 lines with a duplicate
  // among them is a 364-day cycle.
  const key = `${bookId}:${chapter}:${verse}`;
  if (seen.has(key)) throw new Error(`Duplicate reference "${line}".`);
  seen.add(key);

  const enChapter = en[String(book.order)]?.[String(chapter)];
  if (!Array.isArray(enChapter) || enChapter.length === 0) {
    throw new Error(`The English corpus has no ${book.name} ${chapter}.`);
  }
  if (verse < 1 || verse > enChapter.length) {
    throw new Error(
      `${book.name} ${chapter} has ${enChapter.length} verses in English, not ${verse}.`
    );
  }

  const teChapter = te[String(book.order)]?.[String(chapter)];
  if (!Array.isArray(teChapter) || teChapter.length === 0) {
    throw new Error(`The Telugu corpus has no ${book.name} ${chapter}.`);
  }
  // [start, end, text] -- a merged unit covers a range of verse numbers.
  if (!teChapter.some(([start, end]) => verse >= start && verse <= end)) {
    throw new Error(
      `The Telugu corpus does not cover ${book.name} ${chapter}:${verse}. ` +
        `Choose a different reference rather than shipping a day that is blank in Telugu.`
    );
  }

  return {
    id: `year-${String(index + 1).padStart(3, '0')}`,
    reference: `${book.name} ${chapter}:${verse}`,
    bookId,
    chapter,
    verse,
    order: index,
  };
});

const rows = entries
  .map(
    (entry) =>
      `  { id: '${entry.id}', reference: '${entry.reference}', bookId: '${entry.bookId}', chapter: ${entry.chapter}, verse: ${entry.verse}, order: ${entry.order}, active: true },`
  )
  .join('\n');

const bookCount = new Set(entries.map((entry) => entry.bookId)).size;

const generated = `/**
 * GENERATED by scripts/derive-votd-year.mjs -- do not edit by hand.
 *
 * THE APP'S BUILT-IN YEAR: ${EXPECTED_LENGTH} verse references, drawn from ${bookCount} of the
 * 66 books, every one of them checked to resolve in both the English and
 * the Telugu bundled corpus.
 *
 * ---------------------------------------------------------------------
 * WHY THIS MAKES THE VERSE OF THE DAY A ${EXPECTED_LENGTH}-DAY SYSTEM
 * ---------------------------------------------------------------------
 * It does not, by itself. The rotation does -- and it always did. Given a
 * pool of \`n\` entries, votdSelection.ts steps through them by a stride
 * coprime with \`n\`, which visits every entry exactly once before any
 * repeat. An n-entry pool IS an n-day cycle. Nothing schedules a verse
 * to a date; every device works the same answer out from the date, the
 * seed and the pool version.
 *
 * So ${EXPECTED_LENGTH} references is ${EXPECTED_LENGTH} days, and the list below is the whole of
 * what a church has to have in order to get a full year without anyone
 * creating anything. Before it existed the app carried twelve built-in
 * references, which is why the Verse of the Day looked like it was
 * repeating.
 *
 * ---------------------------------------------------------------------
 * PRECEDENCE
 * ---------------------------------------------------------------------
 * This year is the LAST resort, not the first:
 *
 *   1. a verse an administrator set by hand for that exact date
 *   2. the church's own curated pool, if it has one
 *   3. this year
 *
 * A church that curates its own pool replaces this list entirely -- and
 * gets a cycle as long as that pool, which the dashboard states plainly
 * on the pool itself. This is also what a phone with no signal falls
 * back to, which is the other reason it is bundled rather than seeded
 * into Firestore.
 *
 * NO SCRIPTURE TEXT HERE. Only references. The words are resolved from
 * the bundled corpus at render time, through the same path as every
 * other verse in the app.
 *
 * Regenerate:  node scripts/derive-votd-year.mjs
 * Verify:      node scripts/derive-votd-year.mjs --check
 */

/** One day's reference. Structurally a \`VersePoolEntry\`; kept import-free so the two copies of this file can be compared byte for byte. */
export interface VotdYearEntry {
  id: string;
  reference: string;
  bookId: string;
  chapter: number;
  verse: number;
  order: number;
  active: boolean;
}

/** How many days the built-in year covers. */
export const VOTD_YEAR_LENGTH = ${EXPECTED_LENGTH};

/**
 * The fixed configuration the built-in year is rotated with.
 *
 * Fixed, and deliberately NOT the church's own seed: the built-in year
 * is what a phone with no signal falls back to, and it has to land on
 * the same verse whether or not that phone ever managed to read the
 * settings document. It lives in this generated file so that the phone
 * and the dashboard cannot drift into rotating the same year
 * differently -- which would quietly make the dashboard's schedule a
 * lie.
 */
export const VOTD_YEAR_CONFIG: { enabled: boolean; seed: string; poolVersion: number } = {
  enabled: true,
  seed: 'maranatha-fallback',
  poolVersion: 1,
};

export const VOTD_YEAR: readonly VotdYearEntry[] = [
${rows}
];

/** A fresh, mutable copy -- the rotation sorts its pool in place. */
export function bundledVerseYear(): VotdYearEntry[] {
  return VOTD_YEAR.map((entry) => ({ ...entry }));
}
`;

if (process.argv.includes('--check')) {
  let stale = false;
  for (const out of OUTPUTS) {
    if (readFileSync(out, 'utf8') !== generated) {
      console.error(`\n${out} is STALE.\nRun: node scripts/derive-votd-year.mjs\n`);
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log(`${OUTPUTS.length} copies of the built-in year are up to date.`);
  process.exit(0);
}

for (const out of OUTPUTS) writeFileSync(out, generated);

console.log('');
console.log('Verse of the Day -- built-in year');
console.log(`  references       ${entries.length}`);
console.log(`  books covered    ${bookCount} of 66`);
console.log(`  checked against  web-en.json and irv-te.json`);
for (const out of OUTPUTS) console.log(`  written          ${out}`);
console.log('');
