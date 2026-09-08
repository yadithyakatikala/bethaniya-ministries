import { describe, expect, it } from 'vitest';
import { useAppStore } from '../appStore';

/**
 * Day 15 -- direct unit test of appStore's one piece of state. Small
 * because the store is small (see appStore.ts's own "Day 1 foundation
 * only" doc comment) -- this exists so the state slice itself has
 * coverage, not because the logic is complex enough to need much.
 */
describe('appStore', () => {
  it('starts with isBootstrapped false', () => {
    expect(useAppStore.getState().isBootstrapped).toBe(false);
  });

  it('setBootstrapped updates isBootstrapped', () => {
    useAppStore.getState().setBootstrapped(true);
    expect(useAppStore.getState().isBootstrapped).toBe(true);

    useAppStore.getState().setBootstrapped(false);
    expect(useAppStore.getState().isBootstrapped).toBe(false);
  });
});
