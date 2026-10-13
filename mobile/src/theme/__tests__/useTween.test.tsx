import { act, renderHook } from '@testing-library/react-native';
import { installFrameClock, type FrameClock } from '../../testing/frameClock';
import { useTween } from '../useTween';

let clock: FrameClock;
beforeEach(() => {
  clock = installFrameClock();
});
afterEach(() => {
  clock.restore();
});

describe('useTween', () => {
  it('starts at its target and asks for no frames', async () => {
    const { result } = await renderHook(() => useTween(1, 200));
    expect(result.current).toBe(1);
    expect(clock.pending()).toBe(0);
  });

  it('glides to a new target, easing at both ends, and settles exactly on it', async () => {
    const { result, rerender } = await renderHook(
      (p: { target: number }) => useTween(p.target, 200),
      { initialProps: { target: 0 } }
    );
    await rerender({ target: 1 });
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      await act(async () => clock.step(16));
      seen.push(result.current);
    }
    // never goes backwards, never overshoots, and ends exactly on the target
    seen.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(i ? seen[i - 1] : 0);
      expect(v).toBeLessThanOrEqual(1);
    });
    expect(result.current).toBe(1);
    expect(clock.pending()).toBe(0);
    // eased: the first step is far smaller than a straight line's (16/200 = 0.08)
    expect(seen[1]).toBeLessThan(0.08);
  });

  it('takes the time it was given', async () => {
    const { result, rerender } = await renderHook(
      (p: { target: number }) => useTween(p.target, 320),
      { initialProps: { target: 0 } }
    );
    await rerender({ target: 1 });
    await act(async () => clock.step(16)); // sets the origin
    await act(async () => clock.step(160)); // halfway
    expect(result.current).toBeCloseTo(0.5, 1);
    await act(async () => clock.step(200));
    expect(result.current).toBe(1);
  });

  it('carries on from where it is when the target changes mid-flight, rather than jumping', async () => {
    const { result, rerender } = await renderHook(
      (p: { target: number }) => useTween(p.target, 200),
      { initialProps: { target: 0 } }
    );
    await rerender({ target: 1 });
    await act(async () => clock.step(16));
    await act(async () => clock.step(100));
    const mid = result.current;
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.9);
    await rerender({ target: 0 });
    await act(async () => clock.step(16));
    // the first frame back is within a hair of where it was
    expect(Math.abs(result.current - mid)).toBeLessThan(0.05);
    await act(async () => clock.step(400));
    expect(result.current).toBe(0);
  });

  it('with no duration it cuts to the target on the next frame (the reduce-motion answer)', async () => {
    const { result, rerender } = await renderHook(
      (p: { target: number }) => useTween(p.target, 0),
      { initialProps: { target: 0 } }
    );
    await rerender({ target: 1 });
    expect(result.current).toBe(0); // not before a frame
    await act(async () => clock.step(16));
    expect(result.current).toBe(1);
    expect(clock.pending()).toBe(0);
  });

  it('cancels its frame on unmount', async () => {
    const { rerender, unmount } = await renderHook(
      (p: { target: number }) => useTween(p.target, 200),
      { initialProps: { target: 0 } }
    );
    await rerender({ target: 1 });
    expect(clock.pending()).toBe(1);
    await unmount();
    expect(clock.pending()).toBe(0);
  });
});
