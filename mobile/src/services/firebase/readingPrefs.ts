/**
 * The reader's own display settings -- typeface, size, line height,
 * column width and bilingual layout.
 *
 * PATH. `users/{uid}/readingPrefs/reader`. The milestone brief writes
 * this as `users/{uid}/readingPrefs`, which is three path segments and
 * therefore a Firestore COLLECTION, not a document -- a document path
 * must have an even number of segments. So the collection is named
 * exactly as specified and holds one document under a fixed id.
 *
 * WHAT IS NOT HERE: the theme. A reader-only light/dark/system value
 * would be a second theme store beside the `themePreference` that
 * Settings, the navigator chrome and every screen already read through
 * ../../context/PreferencesContext.tsx -- and two stores means the
 * reader and Settings can disagree about what the app looks like. The
 * reader's Light / Dark / System control therefore drives that one
 * existing preference, which M4 extends with 'system'. See
 * ./userProfile.ts's ThemePreference.
 *
 * EVERY FIELD IS A NAMED STEP, never a raw number: the stored value is
 * a short key from ../../theme/tokens.ts's `readingScale`, so a synced
 * document can never carry an unreadable 4pt font or a 3000dp measure,
 * and firestore.rules re-validates the same closed sets server-side.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './app';
import {
  readingScale,
  type ReadingDensity,
  type ReadingFont,
  type ReadingMeasure,
  type ReadingSize,
} from '../../theme/tokens';
import type { BilingualLayout } from '../../features/bible/alignment';

/** The single document id inside the `readingPrefs` collection. */
export const READING_PREFS_DOC_ID = 'reader';

export interface ReadingPrefs {
  font: ReadingFont;
  size: ReadingSize;
  /** A density step, applied as a multiplier of `size`. */
  lineHeight: ReadingDensity;
  /** The maximum width of the text column. */
  width: ReadingMeasure;
  /** How the two translations stack in bilingual mode. */
  layout: BilingualLayout;
}

/**
 * The defaults a reader who has never opened the settings sheet gets.
 * Taken from the M3 reading tokens rather than restated, so there is one
 * answer to "what is the default size?".
 */
export const DEFAULT_READING_PREFS: ReadingPrefs = {
  font: 'serif',
  size: readingScale.defaultSize as ReadingSize,
  lineHeight: readingScale.defaultLineHeight as ReadingDensity,
  width: readingScale.defaultMeasure as ReadingMeasure,
  layout: 'stacked',
};

const FONTS: readonly ReadingFont[] = ['serif', 'sans'];
const SIZES = Object.keys(readingScale.size) as ReadingSize[];
const DENSITIES = Object.keys(readingScale.lineHeight) as ReadingDensity[];
const MEASURES = Object.keys(readingScale.measure) as ReadingMeasure[];
const LAYOUTS: readonly BilingualLayout[] = ['stacked', 'sideBySide'];

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Validates each field independently and falls back to the default for
 * anything missing or unrecognised, so a partially-written document (or
 * one from a future build carrying a step this build does not know)
 * still yields a complete, usable set rather than nothing.
 */
export function toReadingPrefs(data: Record<string, unknown> | undefined): ReadingPrefs {
  if (!data) return DEFAULT_READING_PREFS;
  return {
    font: oneOf(FONTS, data.font) ?? DEFAULT_READING_PREFS.font,
    size: oneOf(SIZES, data.size) ?? DEFAULT_READING_PREFS.size,
    lineHeight: oneOf(DENSITIES, data.lineHeight) ?? DEFAULT_READING_PREFS.lineHeight,
    width: oneOf(MEASURES, data.width) ?? DEFAULT_READING_PREFS.width,
    layout: oneOf(LAYOUTS, data.layout) ?? DEFAULT_READING_PREFS.layout,
  };
}

/** `onNext` receives `null` while no document exists yet. */
export function subscribeToReadingPrefs(
  uid: string,
  onNext: (prefs: ReadingPrefs | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'readingPrefs', READING_PREFS_DOC_ID),
    (snapshot) => onNext(snapshot.exists() ? toReadingPrefs(snapshot.data()) : null),
    onError
  );
}

/**
 * Merges the changed fields into the document, creating it if absent --
 * setDoc with merge rather than updateDoc, because the first change a
 * member ever makes has no document to update.
 */
export async function saveReadingPrefs(
  uid: string,
  fields: Partial<ReadingPrefs>
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (fields.font !== undefined) update.font = fields.font;
  if (fields.size !== undefined) update.size = fields.size;
  if (fields.lineHeight !== undefined) update.lineHeight = fields.lineHeight;
  if (fields.width !== undefined) update.width = fields.width;
  if (fields.layout !== undefined) update.layout = fields.layout;

  await setDoc(doc(db, 'users', uid, 'readingPrefs', READING_PREFS_DOC_ID), update, {
    merge: true,
  });
}
