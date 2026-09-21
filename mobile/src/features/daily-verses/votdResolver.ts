/**
 * Which verse is today's, and what it says.
 *
 * Two steps, kept apart on purpose:
 *
 *   1. resolveVotdReference  -- WHICH verse. Pure, no Bible data, no
 *      Firestore. Decides between the admin's override, the automated
 *      pool, and the bundled fallback.
 *   2. resolveVotdScripture  -- WHAT IT SAYS. Reads the bundled corpus
 *      through the existing seam and, in bilingual mode, the existing M1
 *      alignment policy.
 *
 * Splitting them is what makes the admin's date preview possible without
 * the admin dashboard needing the Bible corpus, and what keeps the
 * selection logic testable without fixtures.
 *
 * =====================================================================
 * PRIORITY
 * =====================================================================
 *   1. OVERRIDE   daily_verses/{date}, if one exists for the date.
 *   2. POOL       the automated selection, if automation is enabled and
 *                 the pool has a usable entry.
 *   3. FALLBACK   a small bundled set of references, selected by the
 *                 same algorithm. This is what the app shows when
 *                 Firestore is unreachable -- on a phone with no signal,
 *                 a member still gets a real verse.
 *
 * An override carries the ADMIN'S OWN TEXT and is rendered verbatim. It
 * predates the bundled Bible (see ./DailyVerseCard.tsx's history and
 * admin/src/types' DailyVerse), so its text may be a paraphrase, a
 * different translation, or a verse range -- resolving it from the
 * corpus instead would silently rewrite what an administrator wrote.
 * Only the automated and fallback paths resolve scripture from the
 * corpus.
 *
 * NOTHING HERE INVENTS TEXT. If a reference cannot be resolved, the
 * caller gets null and shows the shared empty/error state.
 */
import { getBilingualChapter, getChapter } from '../bible/dataSource';
import { getBookById, getBookName } from '../bible/books';
import { primaryBibleLanguage } from '../../context/languagePreferences';
import { bookNameLanguageFor, type BibleLanguage, type BibleMode } from '../bible/types';
import {
  DEFAULT_VOTD_CONFIG,
  selectVerseForDate,
  type VersePoolEntry,
  type VotdConfig,
} from './votdSelection';
import { VOTD_YEAR, VOTD_YEAR_CONFIG, bundledVerseYear } from './votdYear';

/** Where a displayed verse came from. Surfaced in the admin preview. */
export type VotdSource = 'override' | 'pool' | 'fallback';

/** An admin-authored override for one date -- text included. */
export interface VotdOverride {
  id: string;
  date: string;
  reference: string;
  text: string;
  imageUrl: string | null;
}

export interface VotdReference {
  bookId: string;
  chapter: number;
  verse: number;
}

export type VotdSelection =
  | { source: 'override'; override: VotdOverride }
  | { source: 'pool' | 'fallback'; reference: VotdReference; poolReference: string };

/**
 * The bundled year -- the app's own 365 references.
 *
 * WHY IT EXISTS. Firestore is not available on a phone in a village with
 * no signal, and a Bible app that shows an error where the verse of the
 * day should be has failed at its one job. These are real references in
 * the bundled corpus -- resolved through the same code path as
 * everything else, so nothing here is invented or hardcoded text.
 *
 * WHY IT IS 365 LONG. It used to be twelve, which was the wrong length
 * for what it is actually used for. The rotation below visits every
 * entry exactly once before repeating, so the pool's length IS the
 * cycle's length: twelve references meant a church without a pool of its
 * own saw the same verse every twelfth morning, and the Verse of the Day
 * looked broken rather than automatic. A year's worth makes the default
 * behaviour a full year. See ./votdYear.ts and
 * scripts/derive-votd-year.mjs -- every entry is checked to resolve in
 * both bundled translations before it ships.
 *
 * It is still the LAST resort. A verse set by hand for a date wins, then
 * the church's own pool, then this.
 */
export const FALLBACK_REFERENCES: VotdReference[] = VOTD_YEAR.map((entry) => ({
  bookId: entry.bookId,
  chapter: entry.chapter,
  verse: entry.verse,
}));

/**
 * The fallback uses a fixed configuration, so it is the same everywhere.
 *
 * It comes from ./votdYear.ts, which the admin dashboard carries a
 * byte-identical copy of: the dashboard's schedule has to rotate the
 * built-in year exactly as the phone does, or it is showing a pastor
 * days that will not happen.
 */
export const FALLBACK_CONFIG: VotdConfig = VOTD_YEAR_CONFIG;

function fallbackPool(): VersePoolEntry[] {
  return bundledVerseYear();
}

/**
 * Decides WHICH verse today's is. Pure: no Firestore, no Bible data.
 *
 * `override` is whatever the caller found at `daily_verses/{dateKey}`,
 * or null. `pool` and `config` are null when Firestore could not be
 * reached, which is precisely the case the fallback exists for.
 */
export function resolveVotdReference(
  dateKey: string,
  override: VotdOverride | null,
  config: VotdConfig | null,
  pool: VersePoolEntry[] | null
): VotdSelection | null {
  if (
    override &&
    override.reference.trim().length > 0 &&
    override.text.trim().length > 0
  ) {
    return { source: 'override', override };
  }

  if (config?.enabled && pool && pool.length > 0) {
    const entry = selectVerseForDate(dateKey, config, pool);
    if (entry) {
      return {
        source: 'pool',
        reference: { bookId: entry.bookId, chapter: entry.chapter, verse: entry.verse },
        poolReference: entry.reference,
      };
    }
  }

  const fallback = selectVerseForDate(dateKey, FALLBACK_CONFIG, fallbackPool());
  if (!fallback) return null;
  return {
    source: 'fallback',
    reference: {
      bookId: fallback.bookId,
      chapter: fallback.chapter,
      verse: fallback.verse,
    },
    poolReference: fallback.reference,
  };
}

/**
 * Why only the English side is available, carried verbatim from the M1
 * policy's own `notice` values (../bible/alignment.ts).
 *
 * The two reasons are NOT interchangeable, and collapsing them would make
 * the card say something false: 'notInTranslation' means the Telugu Bible
 * has no text here at all, while 'numberingDiffers' means it has the text
 * but divides the chapter differently, so verse N is not verse N.
 */
export type VotdEnglishOnlyNotice = 'notInTranslation' | 'numberingDiffers';

/**
 * The text of one verse, in whichever mode the reader is in.
 *
 * `paired` and `englishOnly` come from the M1 alignment policy, NOT from
 * pairing two lookups here -- a verse whose chapter the two traditions
 * divide differently must not be shown side by side, and Malachi 4 has
 * no Telugu text at all. See ../bible/alignment.ts.
 */
export type VotdScripture =
  | { kind: 'single'; language: BibleLanguage; label: string; text: string }
  | { kind: 'paired'; label: string; english: string; telugu: string }
  /** The Telugu side cannot be shown beside this verse. Never filled in. */
  | {
      kind: 'englishOnly';
      label: string;
      english: string;
      notice: VotdEnglishOnlyNotice;
    };

/** "39-40" for a merged Telugu unit, "16" for an ordinary verse. */
function labelFor(start: number, end?: number): string {
  return end && end > start ? `${start}-${end}` : String(start);
}

export function resolveVotdScripture(
  reference: VotdReference,
  bibleMode: BibleMode
): VotdScripture | null {
  const { bookId, chapter, verse } = reference;
  if (!getBookById(bookId)) return null;

  if (bibleMode === 'bilingual') {
    const bilingual = getBilingualChapter(bookId, chapter);
    if (!bilingual) return null;
    const presentation = bilingual.presentation;

    if (presentation.kind === 'paired') {
      const row = presentation.rows.find((r) => verse >= r.start && verse <= r.end);
      return row
        ? { kind: 'paired', label: row.label, english: row.english, telugu: row.telugu }
        : null;
    }

    // `chapterLevel` (the two traditions divide this chapter differently)
    // and `englishOnly` (Telugu has no text) both resolve to the English
    // verse alone -- pairing either would put the wrong Telugu beside it --
    // but they are reported SEPARATELY, because the card has to say which
    // of the two it is and the two sentences are not interchangeable. The
    // notice is the policy's own, not a second opinion formed here.
    const english = presentation.english.find((v) => v.number === verse);
    return english
      ? {
          kind: 'englishOnly',
          label: labelFor(english.number, english.endNumber),
          english: english.text,
          notice: presentation.notice,
        }
      : null;
  }

  const language = primaryBibleLanguage(bibleMode);
  const loaded = getChapter(bookId, chapter, language);
  if (!loaded || loaded.unavailableInTranslation) {
    // The selected translation has no text for this chapter (Malachi 4
    // in Telugu). Say nothing rather than showing the other language
    // without warning.
    return null;
  }
  // A Telugu unit may cover several verse numbers, so the match is a
  // range test rather than an equality.
  const found = loaded.verses.find(
    (v) => verse >= v.number && verse <= (v.endNumber ?? v.number)
  );
  return found
    ? {
        kind: 'single',
        language,
        label: labelFor(found.number, found.endNumber),
        text: found.text,
      }
    : null;
}

/**
 * The reference as a member reads it -- "John 3:16".
 *
 * The book name follows `bookNameLanguageFor()`, the same rule the Bible
 * reader uses: in a single-language mode it belongs to the scripture, in
 * bilingual mode the labels are chrome and follow the interface. Never
 * built from the stored `reference` string, which is a display value an
 * administrator typed and may not match the reader's language.
 */
export function formatVotdReference(
  reference: VotdReference,
  label: string,
  bibleMode: BibleMode,
  appLanguage: BibleLanguage
): string | null {
  const book = getBookById(reference.bookId);
  if (!book) return null;
  const nameLanguage = bookNameLanguageFor(bibleMode, appLanguage);
  return `${getBookName(book, nameLanguage)} ${reference.chapter}:${label}`;
}

/**
 * Which script an OVERRIDE's text is written in, so it can be set in the
 * right typeface.
 *
 * Only overrides need this. Corpus text arrives with its language
 * attached; an override is free-form, typed by an administrator who may
 * well have typed Telugu, and Telugu set in a Latin serif is unreadable
 * -- the bundled Noto Serif has no Telugu glyphs, so the platform
 * substitutes whatever it happens to have. Detecting the script is the
 * only honest option, since nothing records it.
 *
 * PRESENCE of a Telugu codepoint, not a majority of them: a Telugu verse
 * containing an English proper name is still Telugu, and the Telugu face
 * sets Latin perfectly well while the reverse is not true.
 *
 * Written as an explicit scan of the Telugu Unicode block rather than a
 * regular expression, so the range is legible as two numbers instead of
 * two characters that are hard to tell apart in a diff.
 */
const TELUGU_BLOCK_START = 0x0c00;
const TELUGU_BLOCK_END = 0x0c7f;

export function detectScriptLanguage(text: string): BibleLanguage {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= TELUGU_BLOCK_START && code <= TELUGU_BLOCK_END) return 'te';
  }
  return 'en';
}

/** How the card lays the verse out. */
export type VotdBody =
  | { kind: 'text'; language: BibleLanguage; text: string }
  | { kind: 'paired'; english: string; telugu: string }
  /** Telugu genuinely has no text here, or this chapter cannot be paired --
   *  `notice` says which, and the two sentences differ. */
  | { kind: 'englishOnly'; english: string; notice: VotdEnglishOnlyNotice };

/**
 * The reference in the pieces the M4 sharing builders take.
 *
 * Present only for a verse resolved from the bundled corpus. An override
 * has a reference string an administrator typed -- possibly "Isaiah 53:5
 * (NIV)", possibly a range -- which cannot be taken apart, and must not
 * be guessed at. See ./votdSharing.ts.
 */
export interface VotdCitation {
  bookName: string;
  chapter: number;
  label: string;
}

/** Everything the card needs, and nothing it does not. */
export interface VotdContent {
  source: VotdSource;
  /** The reference as printed. An override's is the administrator's own. */
  reference: string;
  body: VotdBody;
  /** Overrides only; the automated paths carry no image. */
  imageUrl: string | null;
  /** What a pool/fallback verse resolved to -- "16", or "39-40". */
  label: string | null;
  /** Null for an override. */
  citation: VotdCitation | null;
}

function overrideContent(override: VotdOverride): VotdContent {
  return {
    source: 'override',
    reference: override.reference.trim(),
    body: {
      kind: 'text',
      language: detectScriptLanguage(override.text),
      text: override.text.trim(),
    },
    imageUrl: override.imageUrl,
    label: null,
    citation: null,
  };
}

function scriptureContent(
  selection: Extract<VotdSelection, { source: 'pool' | 'fallback' }>,
  bibleMode: BibleMode,
  appLanguage: BibleLanguage
): VotdContent | null {
  const scripture = resolveVotdScripture(selection.reference, bibleMode);
  if (!scripture) return null;
  const book = getBookById(selection.reference.bookId);
  if (!book) return null;
  const bookName = getBookName(book, bookNameLanguageFor(bibleMode, appLanguage));
  const reference = `${bookName} ${selection.reference.chapter}:${scripture.label}`;

  let body: VotdBody;
  if (scripture.kind === 'single') {
    body = { kind: 'text', language: scripture.language, text: scripture.text };
  } else if (scripture.kind === 'paired') {
    body = { kind: 'paired', english: scripture.english, telugu: scripture.telugu };
  } else {
    body = { kind: 'englishOnly', english: scripture.english, notice: scripture.notice };
  }

  return {
    source: selection.source,
    reference,
    body,
    imageUrl: null,
    label: scripture.label,
    citation: { bookName, chapter: selection.reference.chapter, label: scripture.label },
  };
}

/**
 * The whole decision, end to end: which verse, what it says, how it is
 * labelled. Pure -- the caller supplies whatever it managed to fetch.
 *
 * Returns null only when even the bundled fallback could not be resolved,
 * which is the caller's cue to show the shared empty state. It never
 * returns partial or invented content.
 *
 * ONE SUBTLETY. If the automated pool selects a reference the corpus
 * cannot resolve -- an administrator typed Psalm 151, say -- this does
 * NOT become an error. It falls through to the bundled fallback FOR THE
 * SAME DATE, so every device still agrees and the congregation still gets
 * a verse. The admin preview reports the source, which is how that
 * mistake becomes visible instead of silent.
 */
export function resolveVerseOfTheDay(
  dateKey: string,
  override: VotdOverride | null,
  config: VotdConfig | null,
  pool: VersePoolEntry[] | null,
  bibleMode: BibleMode,
  appLanguage: BibleLanguage
): VotdContent | null {
  const selection = resolveVotdReference(dateKey, override, config, pool);
  if (!selection) return null;
  if (selection.source === 'override') return overrideContent(selection.override);

  const content = scriptureContent(selection, bibleMode, appLanguage);
  if (content) return content;
  // Already the fallback and still unresolvable: there is nothing left to
  // try, and inventing something is not an option.
  if (selection.source === 'fallback') return null;

  const fallback = resolveVotdReference(dateKey, null, null, null);
  return fallback && fallback.source !== 'override'
    ? scriptureContent(fallback, bibleMode, appLanguage)
    : null;
}

export { DEFAULT_VOTD_CONFIG };
