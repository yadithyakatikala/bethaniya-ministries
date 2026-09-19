/**
 * The Prophet Verse currently due, fetched once rather than watched.
 *
 * ---------------------------------------------------------------------
 * WHEN IT REFRESHES, AND WHY NOT MORE OFTEN
 * ---------------------------------------------------------------------
 * On mount, and again whenever the canonical Indian date rolls over
 * (which ../daily-verses/useIndiaDateKey.ts already notices for the Verse
 * of the Day, so both sections of the Home screen turn over together).
 *
 * It does NOT poll. A verse an administrator schedules for six in the
 * evening therefore appears on the next app open rather than at the
 * stroke of six for an app that happens to be sitting open -- which on a
 * phone is a difference of minutes. Polling for it would cost a Firestore
 * read a minute per device, which on this project's plan is the whole
 * daily budget spent on a field that changes once a week.
 *
 * A failed read is reported as `empty`, not as an error: the Prophet
 * Verse is a secondary block on the Home screen, and an error panel where
 * a devotional should be is worse than the section simply not being
 * there. The Verse of the Day above it has its own bundled fallback and
 * is unaffected.
 */
import { useEffect, useState } from 'react';
import {
  fetchCurrentProphetVerse,
  type ProphetVerse,
} from '../../services/firebase/prophetVerses';
import { useIndiaDateKey } from '../daily-verses/useIndiaDateKey';

export type ProphetVerseState =
  | { status: 'loading' }
  /** Nothing is published and due -- the section renders nothing at all. */
  | { status: 'empty' }
  | { status: 'ready'; verse: ProphetVerse };

export function useProphetVerse(): ProphetVerseState {
  const dateKey = useIndiaDateKey();
  /** Stamped with the date it was loaded for, so a stale day's answer is
   *  disregarded without a synchronous setState in the effect below. */
  const [loaded, setLoaded] = useState<{
    dateKey: string;
    verse: ProphetVerse | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentProphetVerse()
      .then((verse) => {
        if (!cancelled) setLoaded({ dateKey, verse });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ dateKey, verse: null });
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  if (loaded === null || loaded.dateKey !== dateKey) return { status: 'loading' };
  return loaded.verse ? { status: 'ready', verse: loaded.verse } : { status: 'empty' };
}
