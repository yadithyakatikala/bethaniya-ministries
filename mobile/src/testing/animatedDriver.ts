import { Animated } from 'react-native';

/**
 * A hand-completed replacement for Animated.timing and Animated.delay.
 *
 * Animated's native driver does not exist under Jest, and its JS fallback
 * is tied to timers a test cannot step. This swaps both for animations the
 * test completes explicitly, which makes the choreography observable --
 * what was started, for how long, and what happens when it ends -- without
 * depending on a clock.
 */
export interface StartedAnimation {
  kind: 'timing' | 'delay';
  toValue?: number;
  duration?: number;
  ms?: number;
  done: Animated.EndCallback | undefined;
  value?: Animated.Value;
}

export interface AnimatedDriver {
  /** Animations started and not yet completed, oldest first. */
  readonly started: StartedAnimation[];
  /** Completes the oldest one (as finished), running its callback. */
  completeNext(): void;
  restore(): void;
}

export function installAnimatedDriver(): AnimatedDriver {
  const started: StartedAnimation[] = [];
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(((
    value: Animated.Value,
    config: Animated.TimingAnimationConfig
  ) => ({
    start: (done?: Animated.EndCallback) => {
      started.push({
        kind: 'timing',
        toValue: config.toValue as number,
        duration: config.duration,
        done,
        value,
      });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  })) as unknown as typeof Animated.timing);
  const delay = jest.spyOn(Animated, 'delay').mockImplementation(((ms: number) => ({
    start: (done?: Animated.EndCallback) => {
      started.push({ kind: 'delay', ms, done });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  })) as unknown as typeof Animated.delay);

  return {
    started,
    completeNext() {
      const next = started.shift();
      if (!next) throw new Error('nothing is animating');
      if (next.value && next.toValue !== undefined) next.value.setValue(next.toValue);
      next.done?.({ finished: true });
    },
    restore() {
      timing.mockRestore();
      delay.mockRestore();
    },
  };
}
