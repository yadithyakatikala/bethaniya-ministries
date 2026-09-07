/**
 * SYNTHETIC PLACEHOLDER DATA -- NOT A REAL BIBLE TRANSLATION, in either
 * language.
 *
 * These are NOT verbatim scripture quotations from any copyrighted or
 * licensed translation, and are not written to resemble scripture --
 * wording is a plain, obviously-synthetic "development content" template
 * so this file cannot be mistaken for, or accidentally shipped as,
 * licensed Bible text.
 *
 * Day 8 status (see /BIBLE_LICENSING.md for full detail):
 *   - English (WEB): the TRANSLATION's license is confirmed public
 *     domain, but a verifiable, bulk, license-confirmable source for its
 *     actual verse TEXT could not be safely obtained in this sandboxed
 *     environment -- see dataSource.ts's doc comment for exactly why.
 *     Reconstructing WEB text from memory was explicitly ruled out
 *     (unverifiable, and requirement K forbids guessing at scripture
 *     text). So English still renders placeholder text today, same as
 *     Telugu.
 *   - Telugu: licensing itself remains unresolved (BIBLE_LICENSING.md).
 *     Do not add real Telugu scripture text until that changes.
 *
 * PLACEHOLDER DATASET SIZE -- per FINAL_ARCHITECTURE_SPECIFICATION.md's
 * Day 8 section verbatim: "IF Bible source NOT verified: Use 100-200
 * placeholder verses + clear labeling" (also stated generally at line
 * 321). PLACEHOLDER_POOL_SIZE below is 150 distinct entries per
 * language, within that range. This is a bounded, reusable POOL of
 * distinct placeholder text, not a per-chapter count: the Day 8 approval
 * separately requires full, accurate 66-book/real-chapter-count
 * navigation (requirements C/D), so every real chapter of every real
 * book is still reachable -- what's bounded to 100-200 is the amount of
 * distinct placeholder TEXT that exists, which buildPlaceholderVerses()
 * below deterministically distributes across those chapters (different
 * chapters draw different pool entries), so navigation demonstrably
 * shows different content per chapter without pretending to have a full,
 * separate placeholder verse for all ~31,000 real Bible verses.
 *
 * Per FINAL_ARCHITECTURE_SPECIFICATION.md Section C, Option 3: placeholder
 * content is an explicitly sanctioned way to build and test the Bible
 * screens' UI/navigation/caching now, without blocking on Bible licensing
 * or sourcing.
 *
 * Only dataSource.ts reads this file -- screens never import it directly
 * (see dataSource.ts's getChapter()).
 */
import type { BibleLanguage, BibleVerse } from './types';

/** Within FINAL_ARCHITECTURE_SPECIFICATION.md's stated 100-200 range. */
export const PLACEHOLDER_POOL_SIZE = 150;

/** Verses shown per chapter -- a UI/nav-testing choice, not a claim about any book's real verse count. */
const VERSES_PER_CHAPTER = 3;

function padIndex(n: number): string {
  return String(n).padStart(3, '0');
}

function buildPool(language: BibleLanguage): string[] {
  return Array.from({ length: PLACEHOLDER_POOL_SIZE }, (_, i) => {
    const n = padIndex(i + 1);
    return language === 'te'
      ? `[డెవలప్‌మెంట్ ప్లేస్‌హోల్డర్ #${n} -- తెలుగు. ఇది గ్రంథం కాదు; నిజమైన అనువాదం పెండింగ్‌లో ఉంది, BIBLE_LICENSING.md చూడండి.]`
      : `[Development placeholder #${n} -- English. Not scripture; real translation pending, see BIBLE_LICENSING.md.]`;
  });
}

const PLACEHOLDER_POOLS: Record<BibleLanguage, string[]> = {
  en: buildPool('en'),
  te: buildPool('te'),
};

/**
 * Deterministically picks VERSES_PER_CHAPTER entries from the language's
 * placeholder pool for a given book order + chapter number, so different
 * chapters render different (still fully synthetic) text -- letting
 * Books -> Chapters -> Chapter navigation demonstrate real chapter/verse
 * behavior. Pure function of (bookOrder, chapterNumber, language): same
 * inputs always produce the same output, so caching and tests stay
 * predictable.
 */
export function buildPlaceholderVerses(
  bookOrder: number,
  chapterNumber: number,
  language: BibleLanguage
): BibleVerse[] {
  const pool = PLACEHOLDER_POOLS[language];
  const startIndex = (bookOrder * 31 + chapterNumber * 17) % pool.length;
  return Array.from({ length: VERSES_PER_CHAPTER }, (_, i) => ({
    number: i + 1,
    text: pool[(startIndex + i) % pool.length],
  }));
}
