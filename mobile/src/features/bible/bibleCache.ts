/**
 * Offline cache for previously-loaded Bible chapters -- Day 8's "Cache
 * previously successfully loaded chapters and read from cache when
 * appropriate" requirement. AsyncStorage-backed, same local-only pattern
 * as ../songs/favorites.ts (already a mobile dependency since Day 2, no
 * new dependency needed).
 *
 * The cache key MUST include book, chapter, AND language -- without the
 * language segment, switching the language toggle after a chapter is
 * cached would silently serve the wrong language's (stale) text instead
 * of a fresh lookup. This is deliberately "previously loaded chapters
 * only" -- there is no pre-population/bulk-download of the whole Bible
 * into cache anywhere in this module.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BibleChapter, BibleLanguage } from './types';

const CACHE_KEY_PREFIX = 'bible_chapter_cache';

function cacheKey(
  bookId: string,
  chapterNumber: number,
  language: BibleLanguage
): string {
  return `${CACHE_KEY_PREFIX}:${language}:${bookId}:${chapterNumber}`;
}

function isBibleChapter(value: unknown): value is BibleChapter {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<BibleChapter>).bookId === 'string' &&
    typeof (value as Partial<BibleChapter>).chapterNumber === 'number' &&
    typeof (value as Partial<BibleChapter>).language === 'string' &&
    Array.isArray((value as Partial<BibleChapter>).verses)
  );
}

export async function getCachedChapter(
  bookId: string,
  chapterNumber: number,
  language: BibleLanguage
): Promise<BibleChapter | null> {
  const raw = await AsyncStorage.getItem(cacheKey(bookId, chapterNumber, language));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isBibleChapter(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setCachedChapter(chapter: BibleChapter): Promise<void> {
  await AsyncStorage.setItem(
    cacheKey(chapter.bookId, chapter.chapterNumber, chapter.language),
    JSON.stringify(chapter)
  );
}
