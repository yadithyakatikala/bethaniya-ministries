/**
 * The Prophet Verse currently due, fetched rather than watched.
 *
 * ---------------------------------------------------------------------
 * WHEN IT REFRESHES -- M6 BUG 4
 * ---------------------------------------------------------------------
 * This hook used to read exactly twice: on mount, and again if the
 * canonical Indian date rolled over while the app was open. That second
 * trigger sounds like it covers "come back to the app and see the new
 * one", and it does not. ../daily-verses/useIndiaDateKey.ts does listen
 * for the app becoming active, but it only ever produces a NEW VALUE when
 * the DATE has changed -- returning to the app at ten past two on the same
 * afternoon yields the identical string, React treats the state as
 * unchanged, and this effect never re-runs. So a verse an administrator
 * published, edited or scheduled became visible only after midnight IST or
 * after the member force-quit and reopened the app, which on Android may
 * be weeks. That was BUG 4: not a cache holding stale content, but a fetch
 * that was never asked to happen again.
 *
 * It now refreshes on three triggers:
 *
 *   * mount;
 *   * the Indian date rolling over, as before, so the Home screen's two
 *     devotional sections still turn over together;
 *   * THE APP COMING TO THE FOREGROUND, at most once every
 *     REFRESH_AFTER_MS. This is the one that fixes the bug: an
 *     administrator publishes, the member switches back to the app, and
 *     the new verse is there.
 *
 * It still does NOT poll. The refresh is bound to a lifecycle event that
 * a person caused, not to a timer, so an app sitting untouched in the
 * foreground costs nothing, and flicking between two apps costs one read
 * a minute at worst rather than one per switch. A verse scheduled for six
 * in the evening therefore appears the next time the member opens the app
 * rather than at the stroke of six -- which is the right trade on a plan
 * whose whole daily read budget could otherwise go on a field that changes
 * about once a week.
 *
 * A REFRESH DOES NOT BLANK THE SECTION. `loaded` is kept until the new
 * answer arrives, so a foreground refresh shows the verse already on
 * screen rather than flashing the loading state at someone who just looked
 * back at their phone.
 *
 * A failed read is reported as `empty`, not as an error: the Prophet
 * Verse is a secondary block on the Home screen, and an error panel where
 * a devotional should be is worse than the section simply not being
 * there. The Verse of the Day above it has its own bundled fallback and
 * is unaffected. One failure is singled out in the log -- see
 * ../../services/firebase/prophetVerses.ts -- because a missing composite
 * index fails exactly like "nothing is published", and silence there
 * sends everyone hunting in the admin dashboard for a verse that is
 * already correctly saved.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

/**
 * The shortest gap between two foreground refreshes. Switching to another
 * app and straight back is one read, not two; a member who checks the app
 * through the day costs a handful.
 */
export const REFRESH_AFTER_MS = 60_000;

export function useProphetVerse(): ProphetVerseState {
  const dateKey = useIndiaDateKey();
  /** Stamped with the date it was loaded for, so a stale day's answer is
   *  disregarded without a synchronous setState in the effect below. */
  const [loaded, setLoaded] = useState<{
    dateKey: string;
    verse: ProphetVerse | null;
  } | null>(null);
  /** Bumped to ask for a re-read of the same day. Deliberately a counter
   *  and not the verse itself: the fetch stays in the effect below, so
   *  there is one place that reads and one place that decides to. */
  const [refreshToken, setRefreshToken] = useState(0);
  const lastFetchStartedAtRef = useRef(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (Date.now() - lastFetchStartedAtRef.current < REFRESH_AFTER_MS) return;
      setRefreshToken((token) => token + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    lastFetchStartedAtRef.current = Date.now();
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
  }, [dateKey, refreshToken]);

  if (loaded === null || loaded.dateKey !== dateKey) return { status: 'loading' };
  return loaded.verse ? { status: 'ready', verse: loaded.verse } : { status: 'empty' };
}
