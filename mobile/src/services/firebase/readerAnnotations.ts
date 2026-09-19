/**
 * The reader's private per-verse annotations: highlights, bookmarks and
 * notes.
 *
 * =====================================================================
 * OWNERSHIP
 * =====================================================================
 * All three collections live under `users/{uid}/` and are governed by
 * firestore.rules' `isOwner(userId)` -- exactly the shape ./prayers.ts
 * established for a member's own private data. There is no admin
 * override and no shared read: a member's notes are theirs alone, and
 * nothing here is a public commenting system.
 *
 * =====================================================================
 * DETERMINISTIC DOCUMENT IDS
 * =====================================================================
 * The document id IS the verse it annotates:
 *
 *     `${translationId}_${bookId}_${chapter}_${verse}`   e.g. te_1-samuel_17_45
 *
 * so writing is idempotent by construction. Tapping "Bookmark" twice
 * cannot create two bookmark documents for one verse, re-colouring a
 * highlight replaces the one that is there, and a note has exactly one
 * home. The alternative -- addDoc() plus a "does one already exist?"
 * query before every write -- would cost a read per action and still
 * race with itself on a slow connection.
 *
 * The id is derived from CANONICAL identifiers only (the book slug from
 * ../../features/bible/books.ts and integers), never from a localized
 * book name. See that module: `nameTe` is display text, `id` is the
 * identifier.
 *
 * =====================================================================
 * WHY translationId IS NEVER 'bilingual'
 * =====================================================================
 * `BibleMode` has three values, but an annotation is attached to a verse
 * in ONE translation -- the Telugu IRV's verse 17:45 and the WEB's are
 * different text, and in 41 chapters they are not even the same verse
 * (see ../../features/bible/alignment.ts). So `translationId` is a
 * `BibleLanguage`, and a reader in bilingual mode records against the
 * primary Bible language while DISPLAYING the annotations of both
 * translations it has on screen.
 *
 * =====================================================================
 * ONE LISTENER PER COLLECTION, NOT ONE PER CHAPTER
 * =====================================================================
 * Each subscribe*() below streams the member's whole (small) collection
 * once and the reader indexes it in memory by verse. A per-chapter query
 * would re-read documents on every chapter turn, needs a composite index
 * for its equality filters, and would leave the reader unable to answer
 * "is this verse bookmarked?" anywhere outside the open chapter. One
 * listener costs one initial read batch and then only deltas, which is
 * the cheaper side of the Spark-plan tradeoff.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './app';
import type { BibleLanguage } from '../../features/bible/types';
import type { HighlightColor } from '../../theme/tokens';

/**
 * Which bundled translation an annotation belongs to. Deliberately the
 * data-access key, not the reader's mode -- see this file's header.
 */
export type TranslationId = BibleLanguage;

/** Everything needed to name one verse in one translation. */
export interface VerseRef {
  translationId: TranslationId;
  /** Canonical book slug -- never a localized name. */
  bookId: string;
  chapter: number;
  verse: number;
}

/**
 * The deterministic document id for a verse -- also the reader's
 * in-memory key for "this verse".
 *
 * '_' separates the fields because book slugs already use '-' as their
 * word separator (`song-of-solomon`). Nothing ever parses this string
 * back apart: it is a key, and every field it encodes is stored on the
 * document as well.
 */
export function verseKey(ref: VerseRef): string {
  return `${ref.translationId}_${ref.bookId}_${ref.chapter}_${ref.verse}`;
}

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

/**
 * Reads the verse reference back off a document defensively. A document
 * whose stored fields are not a usable reference is DROPPED rather than
 * surfaced as a half-built annotation -- the reader would otherwise try
 * to paint a highlight at chapter NaN.
 */
function toVerseRef(data: Record<string, unknown>): VerseRef | null {
  const { translationId, bookId, chapter, verse } = data;
  if (translationId !== 'en' && translationId !== 'te') return null;
  if (typeof bookId !== 'string' || bookId.length === 0) return null;
  if (!Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  const chapterNumber = chapter as number;
  const verseNumber = verse as number;
  if (chapterNumber < 1 || verseNumber < 1) return null;
  return { translationId, bookId, chapter: chapterNumber, verse: verseNumber };
}

// ---------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------

/** `users/{uid}/highlights/{verseKey}`. */
export interface Highlight extends VerseRef {
  id: string;
  /** One of the four named tints -- see ../../theme/tokens.ts. */
  colour: HighlightColor;
  createdAt: Date | null;
}

const HIGHLIGHT_COLOURS: readonly HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

function isHighlightColour(value: unknown): value is HighlightColor {
  return HIGHLIGHT_COLOURS.includes(value as HighlightColor);
}

function toHighlight(id: string, data: Record<string, unknown>): Highlight | null {
  const ref = toVerseRef(data);
  if (!ref || !isHighlightColour(data.colour)) return null;
  return { id, ...ref, colour: data.colour, createdAt: toDate(data.createdAt) };
}

export function subscribeToHighlights(
  uid: string,
  onNext: (highlights: Highlight[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'highlights'),
    (snapshot) => {
      const highlights = snapshot.docs
        .map((d) => toHighlight(d.id, d.data()))
        .filter((h): h is Highlight => h !== null);
      onNext(highlights);
    },
    onError
  );
}

/**
 * Sets (or replaces) the highlight on one verse.
 *
 * `createdAt` is rewritten on a colour change: re-colouring is a fresh
 * decision about the verse, not an edit to a record the member cares
 * about the age of. Notes, where the age does matter, preserve it (see
 * saveVerseNote below).
 */
export async function setHighlight(
  uid: string,
  ref: VerseRef,
  colour: HighlightColor
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'highlights', verseKey(ref)), {
    translationId: ref.translationId,
    bookId: ref.bookId,
    chapter: ref.chapter,
    verse: ref.verse,
    colour,
    createdAt: serverTimestamp(),
  });
}

export async function removeHighlight(uid: string, ref: VerseRef): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'highlights', verseKey(ref)));
}

// ---------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------

/** `users/{uid}/bookmarks/{verseKey}`. */
export interface Bookmark extends VerseRef {
  id: string;
  createdAt: Date | null;
}

function toBookmark(id: string, data: Record<string, unknown>): Bookmark | null {
  const ref = toVerseRef(data);
  if (!ref) return null;
  return { id, ...ref, createdAt: toDate(data.createdAt) };
}

export function subscribeToBookmarks(
  uid: string,
  onNext: (bookmarks: Bookmark[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'bookmarks'),
    (snapshot) => {
      const bookmarks = snapshot.docs
        .map((d) => toBookmark(d.id, d.data()))
        .filter((b): b is Bookmark => b !== null);
      // Newest first, sorted here rather than with orderBy(): a document
      // whose createdAt has not yet resolved server-side would be
      // EXCLUDED by an orderBy on that field, so a just-added bookmark
      // would briefly vanish from the reader.
      bookmarks.sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      );
      onNext(bookmarks);
    },
    onError
  );
}

/** Idempotent: the deterministic id means a second call rewrites one document. */
export async function addBookmark(uid: string, ref: VerseRef): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'bookmarks', verseKey(ref)), {
    translationId: ref.translationId,
    bookId: ref.bookId,
    chapter: ref.chapter,
    verse: ref.verse,
    createdAt: serverTimestamp(),
  });
}

export async function removeBookmark(uid: string, ref: VerseRef): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'bookmarks', verseKey(ref)));
}

// ---------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------

/**
 * `users/{uid}/verseNotes/{verseKey}`.
 *
 * WHY A SEPARATE COLLECTION. The milestone brief sketches bookmarks with
 * an optional `note` field. Notes live on their own instead, because
 * folding them together makes two wrong things possible: removing a
 * bookmark would silently destroy a written note, and a member could not
 * write a note without also bookmarking the verse. firestore.rules still
 * ACCEPTS a `note` string on a bookmark document, so the sketched schema
 * remains valid for any client that writes it -- nothing here does.
 */
export interface VerseNote extends VerseRef {
  id: string;
  text: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function toVerseNote(id: string, data: Record<string, unknown>): VerseNote | null {
  const ref = toVerseRef(data);
  if (!ref || typeof data.text !== 'string' || data.text.length === 0) return null;
  return {
    id,
    ...ref,
    text: data.text,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeToVerseNotes(
  uid: string,
  onNext: (notes: VerseNote[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'verseNotes'),
    (snapshot) => {
      const notes = snapshot.docs
        .map((d) => toVerseNote(d.id, d.data()))
        .filter((n): n is VerseNote => n !== null);
      onNext(notes);
    },
    onError
  );
}

/**
 * Writes a note, creating or replacing the one note that verse can have.
 *
 * `existingCreatedAt` is passed by the caller because it already holds
 * the subscribed note -- preserving the original creation time this way
 * costs nothing, where a merge-write plus a read-back would cost a
 * Firestore read on every keystroke-flush.
 */
export async function saveVerseNote(
  uid: string,
  ref: VerseRef,
  text: string,
  existingCreatedAt?: Date | null
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('saveVerseNote: refusing to store an empty note');
  }
  await setDoc(doc(db, 'users', uid, 'verseNotes', verseKey(ref)), {
    translationId: ref.translationId,
    bookId: ref.bookId,
    chapter: ref.chapter,
    verse: ref.verse,
    text: trimmed,
    createdAt: existingCreatedAt
      ? Timestamp.fromDate(existingCreatedAt)
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVerseNote(uid: string, ref: VerseRef): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'verseNotes', verseKey(ref)));
}
