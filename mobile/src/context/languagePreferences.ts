/**
 * The two independent language preferences, and the migration off V1's
 * single one.
 *
 * ---------------------------------------------------------------------
 * WHY TWO
 * ---------------------------------------------------------------------
 * V1 had ONE value, `languagePreference`, and it meant two different
 * things at different times. It started life as "which Bible translation
 * to read" (../features/bible/languagePreference.ts, Day 8) and the V1
 * tester-feedback pass then also made it drive the whole UI language.
 * That made the product requirement impossible to express: the
 * congregation reads a Telugu Bible while wanting an English interface.
 * One value cannot be 'te' and 'en' at once.
 *
 * So there are now two, and they never influence each other:
 *
 *   appLanguage    'en' | 'te'                  default 'en'
 *   bibleMode      'en' | 'te' | 'bilingual'    default 'te'
 *
 * ---------------------------------------------------------------------
 * MIGRATION, AND WHY IT IS IDEMPOTENT BY CONSTRUCTION
 * ---------------------------------------------------------------------
 * A V1 install has `bible_language_preference` stored and neither new
 * key. Reading that state means: seed `bibleMode` from the old value
 * (their real Bible choice, whatever it was) and set `appLanguage` to
 * 'en', the V2 default -- NOT to the old value, which would hand a Telugu
 * Bible reader a Telugu interface they never asked for.
 *
 * There is no migration flag, because the presence of the new keys IS the
 * flag. Once `migrateAndLoad` has written them, the next call reads them
 * and the old value is no longer consulted for anything. An explicit V2
 * choice is therefore never overwritten by a later migration pass, no
 * matter how many times the app launches.
 *
 * ---------------------------------------------------------------------
 * THE OLD KEY IS KEPT AND KEPT CURRENT
 * ---------------------------------------------------------------------
 * `bible_language_preference` is still written whenever the Bible mode
 * changes to a single language, so a V1 build installed over this one
 * still finds a value it understands. For 'bilingual' -- which V1 has no
 * concept of -- the old key is left at whatever it already held rather
 * than being given a value V1 would misread as a deliberate choice.
 * Nothing is deleted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BibleLanguage, BibleMode } from '../features/bible/types';
import {
  getLanguagePreference as getV1BibleLanguage,
  setLanguagePreference as setV1BibleLanguage,
} from '../features/bible/languagePreference';

/** V2 keys. Their presence is what marks the migration as done. */
const APP_LANGUAGE_KEY = 'app_language_preference';
const BIBLE_MODE_KEY = 'bible_mode_preference';

/**
 * The product defaults, stated once. English interface, Telugu scripture
 * -- these are deliberately different values and neither is derived from
 * the other.
 */
export const DEFAULT_APP_LANGUAGE: BibleLanguage = 'en';
export const DEFAULT_BIBLE_MODE: BibleMode = 'te';

export interface LanguagePreferences {
  appLanguage: BibleLanguage;
  bibleMode: BibleMode;
}

function isAppLanguage(value: string | null): value is BibleLanguage {
  return value === 'en' || value === 'te';
}

function isBibleMode(value: string | null): value is BibleMode {
  return value === 'en' || value === 'te' || value === 'bilingual';
}

/**
 * Reads both preferences, migrating a V1 install on the way through.
 *
 * Returns what the app should use right now, and reports whether a
 * migration actually happened so a caller can log or test it. Writes only
 * when migrating: a V2 install with both keys present performs no writes
 * at all.
 */
export async function migrateAndLoadLanguagePreferences(): Promise<
  LanguagePreferences & { migrated: boolean }
> {
  const [storedApp, storedMode] = await Promise.all([
    AsyncStorage.getItem(APP_LANGUAGE_KEY),
    AsyncStorage.getItem(BIBLE_MODE_KEY),
  ]);

  const haveApp = isAppLanguage(storedApp);
  const haveMode = isBibleMode(storedMode);

  // Already on V2 (or already migrated): explicit choices win, untouched.
  if (haveApp && haveMode) {
    return { appLanguage: storedApp, bibleMode: storedMode, migrated: false };
  }

  // Partially written, or a fresh install, or a V1 install. The V1 Bible
  // value is the only thing worth salvaging; getV1BibleLanguage() already
  // falls back to 'te' when nothing is stored, which is also the V2
  // default, so a fresh install and a V1 install converge correctly here.
  const v1BibleLanguage = await getV1BibleLanguage();

  const appLanguage = haveApp ? storedApp : DEFAULT_APP_LANGUAGE;
  const bibleMode = haveMode ? storedMode : v1BibleLanguage;

  await Promise.all([
    haveApp ? Promise.resolve() : AsyncStorage.setItem(APP_LANGUAGE_KEY, appLanguage),
    haveMode ? Promise.resolve() : AsyncStorage.setItem(BIBLE_MODE_KEY, bibleMode),
  ]);

  return { appLanguage, bibleMode, migrated: true };
}

export async function setStoredAppLanguage(language: BibleLanguage): Promise<void> {
  await AsyncStorage.setItem(APP_LANGUAGE_KEY, language);
}

/**
 * Persists the Bible mode, and mirrors it to V1's key when it is a single
 * language so an older build still reads something sensible. See this
 * module's header for why 'bilingual' deliberately leaves V1's key alone.
 */
export async function setStoredBibleMode(mode: BibleMode): Promise<void> {
  await AsyncStorage.setItem(BIBLE_MODE_KEY, mode);
  if (mode !== 'bilingual') {
    await setV1BibleLanguage(mode);
  }
}

/**
 * Which single translation a bilingual-capable preference reads when only
 * one can be shown -- search results, a chapter's own fallback, anywhere
 * that is not the paired reader. Telugu is the product's primary Bible.
 */
export function primaryBibleLanguage(mode: BibleMode): BibleLanguage {
  return mode === 'bilingual' ? 'te' : mode;
}
