import { act, renderHook } from '@testing-library/react-native';
import { installFrameClock, type FrameClock } from '../../../testing/frameClock';
import { MAX_STEP_SECONDS } from '../usePlayback';
import { useAmbientClock } from '../useAmbientClock';

let clock: FrameClock;
beforeEach(() => {
  clock = installFrameClock();
});
afterEach(() => {
  clock.restore();
});

describe('useAmbientClock', () => {
  it('starts where it is told to, so the sway carries on from the chapter', async () => {
    const { result } = await renderHook(() =>
      useAmbientClock({ active: true, start: 5 })
    );
    expect(result.current).toBe(5);
  });

  it('ticks at twenty frames a second, not sixty', async () => {
    const { result } = await renderHook(() =>
      useAmbientClock({ active: true, start: 0 })
    );
    let renders = 0;
    let last = result.current;
    await act(async () => clock.step(16)); // sets the origin
    for (let i = 0; i < 60; i++) {
      await act(async () => clock.step(16));
      if (result.current !== last) {
        renders++;
        last = result.current;
      }
    }
    // 60 frames of 16 ms is about a second; at 20 fps that is about 20 redraws, not 60
    expect(renders).toBeGreaterThanOrEqual(17);
    expect(renders).toBeLessThanOrEqual(22);
    expect(result.current).toBeGreaterThan(0.9);
    expect(result.current).toBeLessThan(1.1);
  });

  it('honours another rate', async () => {
    const { result } = await renderHook(() =>
      useAmbientClock({ active: true, start: 0, fps: 5 })
    );
    await act(async () => clock.step(16));
    let renders = 0;
    let last = result.current;
    for (let i = 0; i < 60; i++) {
      await act(async () => clock.step(16));
      if (result.current !== last) {
        renders++;
        last = result.current;
      }
    }
    expect(renders).toBeLessThanOrEqual(6);
    expect(renders).toBeGreaterThanOrEqual(4);
  });

  it('turns a stall into a delay, never a jump', async () => {
    const { result } = await renderHook(() =>
      useAmbientClock({ active: true, start: 2 })
    );
    await act(async () => clock.step(16));
    await act(async () => clock.step(5000));
    expect(result.current - 2).toBeLessThanOrEqual(MAX_STEP_SECONDS + 1e-9);
  });

  it('does nothing while inactive: no frames, no change', async () => {
    const { result } = await renderHook(() =>
      useAmbientClock({ active: false, start: 3 })
    );
    await act(async () => clock.run(30));
    expect(result.current).toBe(3);
    expect(clock.pending()).toBe(0);
  });

  it('stops when it goes inactive or is unmounted', async () => {
    const { rerender, unmount } = await renderHook(
      (p: { active: boolean }) => useAmbientClock({ active: p.active, start: 0 }),
      { initialProps: { active: true } }
    );
    await act(async () => clock.run(5));
    expect(clock.pending()).toBe(1);
    await rerender({ active: false });
    expect(clock.pending()).toBe(0);
    await rerender({ active: true });
    expect(clock.pending()).toBe(1);
    await unmount();
    expect(clock.pending()).toBe(0);
  });
});
