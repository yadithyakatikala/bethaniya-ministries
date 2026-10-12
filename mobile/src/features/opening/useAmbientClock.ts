import { useEffect, useState } from 'react';
import { MAX_STEP_SECONDS } from './usePlayback';

/**
 * A slow clock for things that sway.
 *
 * The school moves a few points a second, so it does not need the screen's
 * full frame rate -- and redrawing ninety shapes at 60 fps while somebody
 * types a name would spend battery on motion nobody can see. This ticks at
 * `fps` (20 by default), carries on from `start` so the sway continues
 * from wherever the chapter left it, and stops when `active` is false.
 */
export function useAmbientClock({
  active,
  start,
  fps = 20,
}: {
  active: boolean;
  start: number;
  fps?: number;
}): number {
  const [seconds, setSeconds] = useState(start);

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last: number | null = null;
    let clock = start;
    let sinceDraw = 0;
    const interval = 1 / fps;

    const tick = (now: number): void => {
      if (last !== null) {
        const step = Math.min(MAX_STEP_SECONDS, Math.max(0, (now - last) / 1000));
        clock += step;
        sinceDraw += step;
        if (sinceDraw >= interval) {
          // Keep the remainder, so the average rate is `fps` rather than
          // whatever the display's frame length rounds it up to (15 on a
          // 60 Hz screen, if the accumulator were simply reset).
          sinceDraw %= interval;
          setSeconds(clock);
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, start, fps]);

  return seconds;
}
