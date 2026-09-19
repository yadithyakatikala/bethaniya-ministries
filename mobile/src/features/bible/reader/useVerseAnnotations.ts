import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  addBookmark,
  deleteVerseNote,
  removeBookmark,
  removeHighlight,
  saveVerseNote,
  setHighlight,
  subscribeToBookmarks,
  subscribeToHighlights,
  subscribeToVerseNotes,
  verseKey,
  type Bookmark,
  type Highlight,
  type TranslationId,
  type VerseNote,
  type VerseRef,
} from '../../../services/firebase/readerAnnotations';
import type { HighlightColor } from '../../../theme/tokens';

/** What the reader needs to know about one verse. */
export interface VerseAnnotation {
  highlight: HighlightColor | null;
  bookmarked: boolean;
  note: VerseNote | null;
}

export const NO_ANNOTATION: VerseAnnotation = {
  highlight: null,
  bookmarked: false,
  note: null,
};

// Stable empty arrays, so the derived values below keep their identity
// between renders while signed out.
const EMPTY_HIGHLIGHTS: Highlight[] = [];
const EMPTY_BOOKMARKS: Bookmark[] = [];
const EMPTY_NOTES: VerseNote[] = [];

/**
 * The member's highlights, bookmarks and notes, indexed for the reader.
 *
 * SIGNED OUT IS A FIRST-CLASS STATE, not an error. Everything resolves
 * to "no annotations" and `canAnnotate` is false, so the reader shows
 * scripture normally and the action sheet explains that saving needs an
 * account -- rather than offering buttons that would fail.
 *
 * WHICH TRANSLATION AN ANNOTATION BELONGS TO. Always a single
 * translation, never 'bilingual' -- see
 * ../../../services/firebase/readerAnnotations.ts. In bilingual mode the
 * reader passes the PRIMARY Bible language, so a verse highlighted while
 * reading the Telugu Bible is still highlighted in the paired view. A
 * verse highlighted in the English-only reader is an English-translation
 * annotation and shows in that reader; it is not merged into the paired
 * view, because there would then be no single answer to which
 * translation a subsequent change belongs to.
 *
 * WRITE FAILURES ARE REPORTED, not swallowed: every action resolves to a
 * boolean, so the screen can say "that did not save" at the call site
 * where it knows which action the member took. Firestore's own offline
 * queue means most apparent failures are just latency, which is why
 * nothing here rolls the local view back.
 */
export function useVerseAnnotations() {
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const [loadedHighlights, setHighlights] = useState<Highlight[]>([]);
  const [loadedBookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loadedNotes, setNotes] = useState<VerseNote[]>([]);

  useEffect(() => {
    if (!uid) return undefined;
    // A read failure leaves the reader with no annotations rather than
    // no scripture: the page is still worth showing.
    const unsubscribers = [
      subscribeToHighlights(uid, setHighlights, () => setHighlights([])),
      subscribeToBookmarks(uid, setBookmarks, () => setBookmarks([])),
      subscribeToVerseNotes(uid, setNotes, () => setNotes([])),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [uid]);

  // DERIVED, not cleared in an effect: signing out must show no
  // annotations on the very next render, and clearing three pieces of
  // state from an effect body is both a cascading render and a frame in
  // which the previous member's highlights are still on screen.
  const highlights = uid ? loadedHighlights : EMPTY_HIGHLIGHTS;
  const bookmarks = uid ? loadedBookmarks : EMPTY_BOOKMARKS;
  const notes = uid ? loadedNotes : EMPTY_NOTES;

  const index = useMemo(() => {
    const byVerse = new Map<string, VerseAnnotation>();
    const entryFor = (key: string): VerseAnnotation => {
      const existing = byVerse.get(key);
      if (existing) return existing;
      const created: VerseAnnotation = { highlight: null, bookmarked: false, note: null };
      byVerse.set(key, created);
      return created;
    };
    for (const highlight of highlights)
      entryFor(highlight.id).highlight = highlight.colour;
    for (const bookmark of bookmarks) entryFor(bookmark.id).bookmarked = true;
    for (const note of notes) entryFor(note.id).note = note;
    return byVerse;
  }, [highlights, bookmarks, notes]);

  const annotationFor = useCallback(
    (translationId: TranslationId, bookId: string, chapter: number, verse: number) =>
      index.get(verseKey({ translationId, bookId, chapter, verse })) ?? NO_ANNOTATION,
    [index]
  );

  /**
   * Every write reports whether it landed, rather than flipping a shared
   * error flag the screen then has to watch. The caller already knows
   * which action the member just took, so it is the right place to say
   * "that did not save" -- and a boolean needs no effect to observe.
   *
   * Firestore's own offline queue means most apparent failures are just
   * latency, which is why nothing here rolls the local view back.
   */
  const run = useCallback(async (write: () => Promise<void>) => {
    try {
      await write();
      return true;
    } catch (error) {
      console.warn('[readerAnnotations] write failed:', error);
      return false;
    }
  }, []);

  /** `colour` of null removes the highlight. */
  const setVerseHighlight = useCallback(
    async (ref: VerseRef, colour: HighlightColor | null) => {
      if (!uid) return false;
      return run(() =>
        colour === null ? removeHighlight(uid, ref) : setHighlight(uid, ref, colour)
      );
    },
    [uid, run]
  );

  const toggleVerseBookmark = useCallback(
    async (ref: VerseRef) => {
      if (!uid) return false;
      const bookmarked = index.get(verseKey(ref))?.bookmarked ?? false;
      return run(() => (bookmarked ? removeBookmark(uid, ref) : addBookmark(uid, ref)));
    },
    [uid, run, index]
  );

  const setVerseNote = useCallback(
    async (ref: VerseRef, text: string) => {
      if (!uid) return false;
      const existing = index.get(verseKey(ref))?.note ?? null;
      return run(() => saveVerseNote(uid, ref, text, existing?.createdAt ?? null));
    },
    [uid, run, index]
  );

  const removeVerseNote = useCallback(
    async (ref: VerseRef) => {
      if (!uid) return false;
      return run(() => deleteVerseNote(uid, ref));
    },
    [uid, run]
  );

  return {
    /** False while signed out -- annotations need an owner. */
    canAnnotate: uid !== null,
    annotationFor,
    bookmarks,
    setVerseHighlight,
    toggleVerseBookmark,
    setVerseNote,
    removeVerseNote,
  };
}
