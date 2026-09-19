/**
 * The Verse of the Day, ready to render.
 *
 * This hook is the only place the three sources meet:
 *
 *   the override    a live listener on `daily_verses` for the canonical
 *                   Indian date (../../services/firebase/dailyVerses.ts,
 *                   unchanged -- M5 only tells it which date to ask for)
 *   the automation  one-time fetches of the configuration and the pool
 *                   (./votdAutomation.ts)
 *   the corpus      the bundled Bible, read synchronously, no network
 *
 * All of the deciding happens in ./votdResolver.ts, which is pure and
 * heavily tested. What is left here is genuinely just plumbing: subscribe,
 * fetch, derive.
 *
 * ---------------------------------------------------------------------
 * A FAILED READ IS NOT AN ERROR STATE
 * ---------------------------------------------------------------------
 * If Firestore cannot be reached -- no signal, which is the common case
 * this app is built for -- the hook does not report an error. It resolves
 * the bundled fallback and reports `source: 'fallback'`, because a Bible
 * app that shows "could not load" where the verse of the day belongs has
 * failed at its one job. `status: 'empty'` is reserved for the case where
 * even the fallback cannot be resolved, which should not happen and is
 * guarded by a test.
 */
import { useEffect, useMemo, useState } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { usePreferences } from '../../context/PreferencesContext';
import {
  subscribeToTodaysDailyVerse,
  type TodaysDailyVerse,
} from '../../services/firebase/dailyVerses';
import { indiaDateKey } from './votdDate';
import { useIndiaDateKey } from './useIndiaDateKey';
import { loadVotdAutomation, type VotdAutomation } from './votdAutomation';
import {
  resolveVerseOfTheDay,
  type VotdContent,
  type VotdOverride,
} from './votdResolver';

export type VerseOfTheDayState =
  | { status: 'loading' }
  /** Nothing could be resolved at all -- the caller shows EmptyState. */
  | { status: 'empty' }
  | { status: 'ready'; content: VotdContent; dateKey: string };

/** `undefined` while in flight; `null` once it has answered with nothing. */
type Pending<T> = T | null | undefined;

function toOverride(verse: TodaysDailyVerse): VotdOverride {
  return {
    id: verse.id,
    date: verse.date,
    reference: verse.reference,
    text: verse.text,
    imageUrl: verse.imageUrl,
  };
}

export function useVerseOfTheDay(): VerseOfTheDayState {
  const { bibleMode, appLanguage } = usePreferences();
  const dateKey = useIndiaDateKey();

  const [override, setOverride] = useState<Pending<TodaysDailyVerse>>(undefined);
  /**
   * Carries the date it was loaded FOR, rather than being reset to
   * `undefined` when the date rolls over. Two reasons, and the second is
   * the real one: resetting means a synchronous setState in an effect
   * (cascading renders), and a stamped result can simply be disregarded
   * once it is for yesterday -- there is no window in which last night's
   * pool could be used to pick this morning's verse.
   */
  const [loaded, setLoaded] = useState<{
    dateKey: string;
    automation: VotdAutomation | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToTodaysDailyVerse(
      (next) => {
        if (!cancelled) setOverride(next);
      },
      // An override that cannot be read is treated as "there is no
      // override", not as a failure: the automated verse is a perfectly
      // good answer and the member never needs to know.
      (_error: FirestoreError) => {
        if (!cancelled) setOverride(null);
      },
      // THE CANONICAL DATE, not the device's. This is the whole point:
      // before M5 which verse you saw depended on where you were standing.
      indiaDateKey
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadVotdAutomation(dateKey)
      .then((automation) => {
        if (!cancelled) setLoaded({ dateKey, automation });
      })
      .catch(() => {
        // Offline, or a member whose rules deny the read. Either way the
        // bundled fallback covers it.
        if (!cancelled) setLoaded({ dateKey, automation: null });
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  // Anything loaded for a previous date is not an answer for this one.
  const settled = loaded?.dateKey === dateKey ? loaded : null;

  return useMemo<VerseOfTheDayState>(() => {
    // An override that has arrived wins immediately -- there is no reason
    // to wait on a fetch whose answer cannot change the outcome.
    if (override === undefined) return { status: 'loading' };
    if (override === null && settled === null) return { status: 'loading' };

    const content = resolveVerseOfTheDay(
      dateKey,
      override ? toOverride(override) : null,
      settled?.automation?.config ?? null,
      settled?.automation?.pool ?? null,
      bibleMode,
      appLanguage
    );
    return content ? { status: 'ready', content, dateKey } : { status: 'empty' };
  }, [override, settled, dateKey, bibleMode, appLanguage]);
}
