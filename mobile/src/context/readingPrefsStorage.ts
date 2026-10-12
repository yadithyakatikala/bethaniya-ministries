/**
 * Local-only AsyncStorage for the Bible reader's display settings.
 *
 * Same two-tier shape as ./preferencesStorage.ts: AsyncStorage always
 * holds the latest value so the reader is correct while signed out and
 * offline, and ./ReadingPreferencesContext.tsx layers the Firestore sync
 * on top.
 *
 * ONE KEY, NOT FIVE. The five settings are always read and written
 * together (the settings sheet shows all of them), so they are stored as
 * one JSON object rather than five keys -- one read on app start instead
 * of five, and no way for the stored set to end up half-updated.
 * Everything that comes back out goes through `toReadingPrefs()`, which
 * validates each field independently and substitutes the default for
 * anything unrecognised, so a corrupt or partial blob degrades to
 * sensible defaults rather than throwing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_READING_PREFS,
  toReadingPrefs,
  type ReadingPrefs,
} from '../services/firebase/readingPrefs';

const READING_PREFS_KEY = 'reading_prefs';

/** Returns the stored settings, or the defaults when nothing usable is stored. */
export async function getStoredReadingPrefs(): Promise<ReadingPrefs> {
  const raw = await AsyncStorage.getItem(READING_PREFS_KEY);
  if (!raw) return DEFAULT_READING_PREFS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_READING_PREFS;
    }
    return toReadingPrefs(parsed as Record<string, unknown>);
  } catch {
    // Not valid JSON. Nothing to recover, and a reader that refuses to
    // open because a preference blob is corrupt would be the worse bug.
    return DEFAULT_READING_PREFS;
  }
}

export async function setStoredReadingPrefs(prefs: ReadingPrefs): Promise<void> {
  await AsyncStorage.setItem(READING_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * The reader's PAGE: the paper it is set on. `'sepia'` is the one reader-only
 * page; `null` means "the app's own light or dark" -- there is nothing to store
 * for it.
 *
 * Kept apart from the five settings above, and from the app's theme: it is
 * LOCAL TO THIS PHONE by design. `users/{uid}/readingPrefs/reader` is
 * validated server-side against closed sets (firestore.rules'
 * isValidReadingPrefs), so a sixth field there is a rules change; and
 * `themePreference` has a closed set of its own. A reading comfort that
 * differs between a member's phone and their tablet is not a defect, and is
 * not worth a rules deployment.
 */
export type ReaderPage = 'sepia' | null;

const READER_PAGE_KEY = 'reader_page_preference';

export async function getStoredReaderPage(): Promise<ReaderPage> {
  const raw = await AsyncStorage.getItem(READER_PAGE_KEY);
  // Anything unrecognised -- including a page a later build adds -- is "no page chosen".
  return raw === 'sepia' ? 'sepia' : null;
}

export async function setStoredReaderPage(page: ReaderPage): Promise<void> {
  if (page === null) await AsyncStorage.removeItem(READER_PAGE_KEY);
  else await AsyncStorage.setItem(READER_PAGE_KEY, page);
}
