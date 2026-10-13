/**
 * A hand-cranked animation-frame clock for tests.
 *
 * React Native's jest setup implements requestAnimationFrame with a zero
 * delay timeout, which a fake-timer clock can only run in an endless loop.
 * This replaces it (and Date.now, which Animated reads) with a clock the
 * test advances explicitly, one frame at a time.
 */
export interface FrameClock {
  readonly now: number;
  /** Advances time by `ms` and runs every callback queued before the step. */
  step(ms: number): void;
  /** Runs `count` frames of `ms` each. */
  run(count: number, ms?: number): void;
  pending(): number;
  restore(): void;
}

export function installFrameClock(): FrameClock {
  const g = globalThis as unknown as {
    requestAnimationFrame: (cb: (t: number) => void) => number;
    cancelAnimationFrame: (id: number) => void;
  };
  const originalRaf = g.requestAnimationFrame;
  const originalCaf = g.cancelAnimationFrame;
  const originalNow = Date.now;
  const queue = new Map<number, (t: number) => void>();
  let nextId = 1;
  let now = 1_000_000;

  g.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  g.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };
  Date.now = () => now;

  const clock: FrameClock = {
    get now() {
      return now;
    },
    step(ms) {
      now += ms;
      const due = [...queue.entries()];
      queue.clear();
      for (const [, cb] of due) cb(now);
    },
    run(count, ms = 16) {
      for (let i = 0; i < count; i++) clock.step(ms);
    },
    pending: () => queue.size,
    restore() {
      g.requestAnimationFrame = originalRaf;
      g.cancelAnimationFrame = originalCaf;
      Date.now = originalNow;
    },
  };
  return clock;
}
