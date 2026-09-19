/**
 * The current moment, refreshed on an interval.
 *
 * WHY A HOOK RATHER THAN `new Date()` IN THE RENDER. Reading the clock
 * while rendering is impure -- the same component with the same props
 * produces a different answer each time, which React's own rules forbid
 * and this project's lint enforces. It is also wrong for the thing that
 * needs it: whether a scheduled Prophet Verse has become due changes on
 * its own, with no re-render to trigger it, so the page has to be told.
 *
 * A minute is the right granularity: nothing here is second-accurate, and
 * a tick costs a comparison and no network call.
 */
import { useEffect, useState } from 'react';

export const CLOCK_TICK_MS = 60_000;

export function useNow(intervalMs: number = CLOCK_TICK_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
