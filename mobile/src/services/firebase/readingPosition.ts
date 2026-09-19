/**
 * Where the member last was in each translation.
 *
 * PATH. `users/{uid}/readingPosition/{translationId}` -- one document
 * per translation, because "where I was in the Telugu Bible" and "where
 * I was in the English Bible" are different answers and a member who
 * switches translations should not lose either.
 *
 * WRITES ARE THROTTLED BY THE CALLER, not here. This module is a thin
 * data layer; the reader's hook decides when a scroll has settled enough
 * to be worth a write (see
 * ../../features/bible/reader/useReadingPosition.ts). That split matters
 * for the Spark plan: a write per scroll frame would be thousands of
 * writes per chapter.
 *
 * EXPLICIT NAVIGATION WINS. Nothing in this module redirects the reader.
 * The saved position is offered from Home / the Bible tab as a
 * "continue reading" entry point; opening a specific book and chapter
 * goes exactly there and then overwrites the saved position. The reader
 * screen never reads this document to decide what to show.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './app';
import type { TranslationId } from './readerAnnotations';

export interface ReadingPosition {
  translationId: TranslationId;
  /** Canonical book slug -- never a localized name. */
  bookId: string;
  chapter: number;
  /** The topmost verse the reader had in view. 1 for the chapter start. */
  verse: number;
  updatedAt: Date | null;
}

function toReadingPosition(
  translationId: TranslationId,
  data: Record<string, unknown>
): ReadingPosition | null {
  const { bookId, chapter, verse } = data;
  if (typeof bookId !== 'string' || bookId.length === 0) return null;
  if (!Number.isInteger(chapter) || (chapter as number) < 1) return null;
  const verseNumber =
    Number.isInteger(verse) && (verse as number) >= 1 ? (verse as number) : 1;
  return {
    translationId,
    bookId,
    chapter: chapter as number,
    verse: verseNumber,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/** A one-shot read, for a "continue reading" card that does not need live updates. */
export async function getReadingPosition(
  uid: string,
  translationId: TranslationId
): Promise<ReadingPosition | null> {
  const snapshot = await getDoc(doc(db, 'users', uid, 'readingPosition', translationId));
  if (!snapshot.exists()) return null;
  return toReadingPosition(translationId, snapshot.data());
}

/** `onNext` receives `null` until the member has read anything in this translation. */
export function subscribeToReadingPosition(
  uid: string,
  translationId: TranslationId,
  onNext: (position: ReadingPosition | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'readingPosition', translationId),
    (snapshot) =>
      onNext(
        snapshot.exists() ? toReadingPosition(translationId, snapshot.data()) : null
      ),
    onError
  );
}

export async function saveReadingPosition(
  uid: string,
  position: {
    translationId: TranslationId;
    bookId: string;
    chapter: number;
    verse: number;
  }
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'readingPosition', position.translationId), {
    bookId: position.bookId,
    chapter: position.chapter,
    verse: position.verse,
    updatedAt: serverTimestamp(),
  });
}
