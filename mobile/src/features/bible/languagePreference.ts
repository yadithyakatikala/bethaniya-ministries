/**
 * Local-only Bible language preference -- Day 8 scope. Mirrors
 * ../songs/favorites.ts's shape: a single value under one AsyncStorage
 * key, no cloud sync. Firestore/profile synchronization is explicitly
 * Day 9 scope (Profile/Settings), not built here -- see
 * FINAL_ARCHITECTURE_SPECIFICATION.md's Day 9 section.
 *
 * DEFAULT_LANGUAGE is Telugu ('te') per the V1 completion sprint's
 * requirement that Telugu be the default Bible language on first launch,
 * now that a real, licensed Telugu translation is imported (see
 * teluguBible.ts). This only affects a first launch with nothing stored
 * yet -- any previously (or newly) persisted user choice, English
 * included, is always read back and respected untouched.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BibleLanguage } from './types';

const LANGUAGE_KEY = 'bible_language_preference';
const DEFAULT_LANGUAGE: BibleLanguage = 'te';

function isBibleLanguage(value: string | null): value is BibleLanguage {
  return value === 'en' || value === 'te';
}

/** Returns the saved preference, or 'te' (default) if nothing valid is stored. */
export async function getLanguagePreference(): Promise<BibleLanguage> {
  const raw = await AsyncStorage.getItem(LANGUAGE_KEY);
  return isBibleLanguage(raw) ? raw : DEFAULT_LANGUAGE;
}

export async function setLanguagePreference(language: BibleLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}
