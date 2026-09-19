/**
 * The canonical Indian date, kept current while the app is open.
 *
 * A phone is left open or backgrounded across midnight as a matter of
 * course, so anything keyed on "today" has to notice the rollover. Two
 * triggers, because neither alone is enough -- the same pair, for the
 * same reason, as ../../services/firebase/dailyVerses.ts's listener:
 *
 *   * a timer, for an app that simply sits in the foreground past
 *     midnight, where no lifecycle event ever arrives;
 *   * AppState, because a JS timer does not fire reliably in the
 *     background.
 *
 * The check is a string comparison and no Firestore read, so a
 * once-a-minute tick costs nothing. The state only changes on an actual
 * date change, so nothing re-renders in between.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { indiaDateKey, type DateKey } from './votdDate';

/** Matches ../../services/firebase/dailyVerses.ts's DATE_ROLLOVER_CHECK_MS. */
export const DATE_ROLLOVER_CHECK_MS = 60_000;

export function useIndiaDateKey(now: () => DateKey = indiaDateKey): DateKey {
  const [dateKey, setDateKey] = useState<DateKey>(now);

  useEffect(() => {
    // setDateKey with the same string is a no-op for React, so this needs
    // no "has it changed" bookkeeping of its own.
    const check = () => setDateKey(now());
    const timer = setInterval(check, DATE_ROLLOVER_CHECK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [now]);

  return dateKey;
}
