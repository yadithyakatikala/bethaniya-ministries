import { act, renderHook } from '@testing-library/react-native';
import { MAX_STEP_SECONDS, usePlayback } from '../usePlayback';
import { installFrameClock, type FrameClock } from '../../../testing/frameClock';

let clock: FrameClock;
beforeEach(() => {
  clock = installFrameClock();
});
afterEach(() => {
  clock.restore();
});

describe('usePlayback', () => {
  it('starts at zero and advances with the frames', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() =>
      usePlayback({ duration: 2, active: true, onDone })
    );
    expect(result.current).toBe(0);
    await act(async () => clock.run(31)); // first frame sets the origin; 30 more
    expect(result.current).toBeGreaterThan(0.45);
    expect(result.current).toBeLessThan(0.55);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('reports completion once, on the last frame, at exactly the duration', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() =>
      usePlayback({ duration: 0.5, active: true, onDone })
    );
    await act(async () => clock.run(60));
    expect(result.current).toBe(0.5);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toBe(0); // and it stops asking for frames
  });

  it('turns a long stall into a delay, never a skipped beat', async () => {
    const onDone = jest.fn();
    const { result } = await renderHook(() =>
      usePlayback({ duration: 5, active: true, onDone })
    );
    await act(async () => clock.step(16));
    await act(async () => clock.step(3000)); // the thread was busy for three seconds
    expect(result.current).toBeLessThanOrEqual(MAX_STEP_SECONDS + 1e-9);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does nothing while inactive, and cancels its frame on unmount', async () => {
    const onDone = jest.fn();
    const inactive = await renderHook(() =>
      usePlayback({ duration: 1, active: false, onDone })
    );
    await act(async () => clock.run(10));
    expect(inactive.result.current).toBe(0);
    expect(clock.pending()).toBe(0);
    await inactive.unmount();

    const live = await renderHook(() =>
      usePlayback({ duration: 1, active: true, onDone })
    );
    await act(async () => clock.run(3));
    expect(clock.pending()).toBe(1);
    await live.unmount();
    expect(clock.pending()).toBe(0);
    expect(onDone).not.toHaveBeenCalled();
  });
});
