import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { saveReadingPosition } from '../../../services/firebase/readingPosition';
import type { TranslationId } from '../../../services/firebase/readerAnnotations';

/**
 * How long the reader must sit still before the position is written.
 *
 * Scrolling a chapter fires scroll events continuously; writing each one
 * would be thousands of Firestore writes per chapter, which on the Spark
 * plan is both the daily quota and the point. Two and a half seconds is
 * long enough that a flick through a chapter costs one write, and short
 * enough that a reader who stops to read has their place saved before
 * they put the phone down.
 */
export const POSITION_WRITE_DELAY_MS = 2500;

/**
 * Remembers where the member is reading.
 *
 * WHAT IT DOES NOT DO: decide what the reader shows. The reader opens
 * the book and chapter it was navigated to, always -- explicit
 * navigation wins, which is why nothing here redirects anything. The
 * saved document is what a "Continue reading" entry point reads (see
 * ../BooksListScreen.tsx).
 *
 * THREE THINGS KEEP THE WRITE COUNT DOWN:
 *   1. a trailing debounce, so a scroll costs one write when it settles;
 *   2. a comparison against the last value actually written, so
 *      re-reporting the same verse writes nothing;
 *   3. nothing at all while signed out -- there is no document to own.
 *
 * A pending position is flushed when the chapter changes or the reader
 * unmounts, so leaving mid-scroll still saves the place.
 */
export function useReadingPosition(params: {
  translationId: TranslationId;
  bookId: string;
  chapter: number;
}) {
  const { translationId, bookId, chapter } = params;
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<number | null>(null);
  const lastWrittenRef = useRef<string | null>(null);

  /**
   * `target` is passed in rather than read from a ref, because the
   * cleanup that flushes on a chapter change runs AFTER the render that
   * changed it -- a ref would already hold the new chapter and the
   * pending verse would be written against the wrong one.
   */
  const flush = useCallback(
    (target: {
      uid: string | null;
      translationId: TranslationId;
      bookId: string;
      chapter: number;
    }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const verse = pendingRef.current;
      pendingRef.current = null;
      if (verse === null || !target.uid) return;

      const signature = `${target.translationId}:${target.bookId}:${target.chapter}:${verse}`;
      if (signature === lastWrittenRef.current) return;
      lastWrittenRef.current = signature;

      void saveReadingPosition(target.uid, {
        translationId: target.translationId,
        bookId: target.bookId,
        chapter: target.chapter,
        verse,
      }).catch((error) => {
        // The place in a book is not worth an error banner, and Firestore
        // queues the write offline anyway. Clearing the signature lets the
        // next settle retry it.
        lastWrittenRef.current = null;
        console.warn('[readingPosition] save failed:', error);
      });
    },
    []
  );

  /** Called by the reader as the topmost visible verse changes. */
  const reportVisibleVerse = useCallback(
    (verse: number) => {
      if (!uid) return;
      pendingRef.current = verse;
      if (timerRef.current) clearTimeout(timerRef.current);
      const target = { uid, translationId, bookId, chapter };
      timerRef.current = setTimeout(() => flush(target), POSITION_WRITE_DELAY_MS);
    },
    [uid, translationId, bookId, chapter, flush]
  );

  // Flush on a chapter change (the reader is leaving this chapter) and on
  // unmount (it is leaving the reader).
  useEffect(() => {
    const target = { uid, translationId, bookId, chapter };
    return () => flush(target);
  }, [flush, uid, bookId, chapter, translationId]);

  const flushReadingPosition = useCallback(
    () => flush({ uid, translationId, bookId, chapter }),
    [flush, uid, translationId, bookId, chapter]
  );

  return { reportVisibleVerse, flushReadingPosition };
}
