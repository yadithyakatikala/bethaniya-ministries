import { useEffect, useRef, useState } from 'react';

/** Eases at both ends. Local on purpose: the theme layer imports no feature module. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * A number that glides to `target`.
 *
 * For the handful of movements that are a value rather than a transform --
 * the school band shrinking to a strip when the keyboard opens, say, where
 * the height itself changes and so cannot ride the native driver. It moves
 * on the animation frame, eases at both ends, and when the target changes
 * mid-flight it carries on from where it is rather than jumping.
 *
 * `durationMs` of 0 (or less) arrives on the next frame: the "reduce
 * motion" answer to a glide is a cut, not a shorter glide.
 */
export function useTween(target: number, durationMs: number): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (current.current === target) return undefined;
    const from = current.current;
    let start: number | null = null;
    let frame = 0;
    const tick = (now: number): void => {
      if (start === null) start = now;
      const progress = durationMs <= 0 ? 1 : Math.min(1, (now - start) / durationMs);
      const next = from + (target - from) * smoothstep(progress);
      current.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
