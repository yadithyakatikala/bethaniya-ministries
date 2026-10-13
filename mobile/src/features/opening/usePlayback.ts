import { useEffect, useRef, useState } from 'react';

/**
 * The longest a single frame may advance the clock, in seconds.
 *
 * The film is driven by elapsed time, so a stall -- the JavaScript thread
 * busy mounting the first screen under it, say -- could otherwise jump it
 * straight past whole beats. Capping each step makes a stall DELAY the film
 * instead of skipping it: a slow phone sees every beat, just later.
 */
export const MAX_STEP_SECONDS = 0.1;

/**
 * Seconds of film played so far, advancing on every animation frame until
 * `duration`, when `onDone` fires once. Stops cleanly on unmount or when
 * `active` goes false.
 */
export function usePlayback({
  duration,
  active,
  onDone,
}: {
  duration: number;
  active: boolean;
  onDone: () => void;
}): number {
  const [seconds, setSeconds] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last: number | null = null;
    let elapsed = 0;

    const tick = (now: number): void => {
      if (last !== null) {
        elapsed += Math.min(MAX_STEP_SECONDS, Math.max(0, (now - last) / 1000));
      }
      last = now;
      if (elapsed >= duration) {
        setSeconds(duration);
        onDoneRef.current();
        return;
      }
      setSeconds(elapsed);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, duration]);

  return seconds;
}
