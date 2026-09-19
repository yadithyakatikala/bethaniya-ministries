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
