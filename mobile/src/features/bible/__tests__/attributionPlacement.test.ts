/**
 * Where the Bible licence notice is allowed to appear -- M7.
 *
 * =====================================================================
 * WHY A TEST THAT READS THE SOURCE TREE
 * =====================================================================
 * The requirement is not "the reader does not show attribution today".
 * It is that translation names and copyright lines never appear in
 * SCRIPTURE PRESENTATION anywhere -- not under a verse, not in the Verse
 * of the Day, not in a Prophet Verse, not on a share or a copy, not in a
 * prayer or a community message -- while remaining permanently visible in
 * the one place the licence actually requires: Settings' "Bible
 * translations" card.
 *
 * M6 already removed the block from the share payload, and the existing
 * ReaderScreen / verseSharing / DailyVerseCard tests assert its absence
 * from those specific payloads. What none of them can catch is the next
 * person adding `{TRANSLATION_NAMES[language]}` to a new verse card,
 * because that surface has no test yet. The failure mode this file exists
 * for is DUPLICATED ATTRIBUTION LOGIC: a second copy of the credit line,
 * added in good faith somewhere new, that no payload assertion covers.
 *
 * So this checks the property directly. The licence constants live in
 * ../translationCredits.ts and may be READ by exactly one screen. Any
 * other module that names a translation or quotes the copyright line --
 * in code, not in a comment -- fails this test and has to justify itself
 * by being added to ALLOWED_CODE below.
 *
 * =====================================================================
 * COMMENTS ARE STRIPPED FIRST, ON PURPOSE
 * =====================================================================
 * Several modules legitimately DOCUMENT the provenance of the text they
 * bundle -- ../webBible.ts says the WEB is public domain, ../teluguBible.ts
 * names the IRV's copyright holder, and ./reader/verseSharing.ts quotes
 * the removed block as the example of what a share must not look like.
 * That is documentation, and losing it would be worse than useless.
 *
 * Only executable source is scanned, so a doc comment may say anything
 * and a rendered string may not.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { CC_BY_SA_URL, TRANSLATION_ATTRIBUTION, TRANSLATION_NAMES } from '../translationCredits';

/** mobile/src, resolved from this file rather than from the cwd. */
const SRC_ROOT = join(__dirname, '..', '..', '..');

/**
 * The two modules that are allowed to carry the licence text in code.
 *
 * translationCredits.ts DEFINES it. SettingsScreen.tsx RENDERS it, and
 * is the legal location -- see /BIBLE_LICENSING.md. Nothing else.
 */
const ALLOWED_CODE = [
  join('features', 'bible', 'translationCredits.ts'),
  join('features', 'settings', 'SettingsScreen.tsx'),
];

/**
 * The strings that constitute attribution. Taken from the constants
 * themselves, so renaming a translation cannot quietly narrow this test.
 */
const LICENCE_FRAGMENTS = [
  TRANSLATION_NAMES.en,
  TRANSLATION_NAMES.te,
  TRANSLATION_ATTRIBUTION.te,
  CC_BY_SA_URL,
  'CC BY-SA',
  'Bridge Connectivity',
].filter((value): value is string => typeof value === 'string' && value.length > 0);

/**
 * Removes comments, leaving code.
 *
 * `//` is only treated as a line comment when it is NOT preceded by ':',
 * so the scheme in 'https://example.org' survives -- a mangled URL would
 * not cause a false pass here, but it would make the stripped output hard
 * to reason about when this test does fail.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function sourceFilesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      // Tests assert on the licence text by design, and data/ is the
      // Bible itself.
      if (entry === '__tests__' || entry === '__mocks__' || entry === 'data') continue;
      found.push(...sourceFilesUnder(full));
      continue;
    }
    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) found.push(full);
  }
  return found;
}

describe('the Bible licence notice lives in exactly one place', () => {
  const files = sourceFilesUnder(SRC_ROOT);

  it('finds a source tree to check', () => {
    // A path mistake would otherwise make every assertion below pass by
    // scanning nothing at all.
    expect(files.length).toBeGreaterThan(100);
  });

  it('is present in the Settings screen, which is the legal location', () => {
    const settings = readFileSync(
      join(SRC_ROOT, 'features', 'settings', 'SettingsScreen.tsx'),
      'utf8'
    );
    expect(stripComments(settings)).toContain('translationCreditLine');
  });

  it('appears in no other module’s code', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const relativePath = relative(SRC_ROOT, file);
      if (ALLOWED_CODE.includes(relativePath)) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const fragment of LICENCE_FRAGMENTS) {
        if (code.includes(fragment)) {
          offenders.push(`${relativePath.split(sep).join('/')}: ${fragment}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is not reachable from any module other than Settings', () => {
    // The import is the real chokepoint: a screen cannot render the
    // credit line without reaching for this module first.
    const importers: string[] = [];
    for (const file of files) {
      const relativePath = relative(SRC_ROOT, file);
      if (ALLOWED_CODE.includes(relativePath)) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      if (/from\s+['"][^'"]*translationCredits['"]/.test(code)) {
        importers.push(relativePath.split(sep).join('/'));
      }
    }
    expect(importers).toEqual([]);
  });
});
