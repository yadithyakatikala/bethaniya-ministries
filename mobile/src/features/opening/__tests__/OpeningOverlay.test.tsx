import React from 'react';
import { BackHandler } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { OPENING_DURATION } from '../engine/constants';
import { LETTER_PATHS } from '../engine/wordmark';
import { LEAVE_MS, OpeningOverlay, STILL_HOLD_MS, STILL_IN_MS } from '../OpeningOverlay';
import {
  installAnimatedDriver,
  type AnimatedDriver,
} from '../../../testing/animatedDriver';
import { installFrameClock, type FrameClock } from '../../../testing/frameClock';

jest.mock('../../../services/firebase/app');
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
}));

let mockReducedMotion = false;
jest.mock('../../../theme/motion', () => ({
  ...jest.requireActual('../../../theme/motion'),
  useReducedMotion: () => mockReducedMotion,
}));

let clock: FrameClock;
let driver: AnimatedDriver;
// The animations the overlay has started and the test has not yet completed.
let started: AnimatedDriver['started'];
const completeNext = () => driver.completeNext();

beforeEach(() => {
  mockReducedMotion = false;
  clock = installFrameClock();
  driver = installAnimatedDriver();
  started = driver.started;
});

afterEach(async () => {
  await cleanup();
  clock.restore();
  driver.restore();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function mount(onFinished = jest.fn()) {
  const view = await render(
    <AuthProvider>
      <PreferencesProvider>
        <OpeningOverlay onFinished={onFinished} />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...view, onFinished };
}

const FRAME_MS = 16;
const frames = (seconds: number) => Math.ceil((seconds * 1000) / FRAME_MS);

describe('OpeningOverlay', () => {
  it('plays the whole film, then dissolves into the app', async () => {
    const { onFinished } = await mount();
    // The film is on screen, fully opaque, for its whole length...
    await act(async () => clock.run(frames(OPENING_DURATION - 0.5), FRAME_MS));
    expect(started).toHaveLength(0);
    expect(onFinished).not.toHaveBeenCalled();

    // ...and when it ends the overlay starts to fade, rather than cutting.
    await act(async () => clock.run(frames(1.2), FRAME_MS));
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ kind: 'timing', toValue: 0, duration: LEAVE_MS });
    expect(onFinished).not.toHaveBeenCalled();

    await act(async () => completeNext());
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('can be skipped with a single tap, and stops drawing frames', async () => {
    const { getByTestId, onFinished } = await mount();
    await act(async () => clock.run(frames(1.0), FRAME_MS));
    await fireEvent.press(getByTestId('opening-skip'));

    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ kind: 'timing', toValue: 0, duration: LEAVE_MS });
    await act(async () => completeNext());
    expect(onFinished).toHaveBeenCalledTimes(1);

    // The film is frozen once the person has chosen to leave it.
    await act(async () => clock.run(10, FRAME_MS));
    expect(clock.pending()).toBe(0);
  });

  it('keeps repeated taps from starting the exit twice or finishing twice', async () => {
    const { getByTestId, onFinished } = await mount();
    await fireEvent.press(getByTestId('opening-skip'));
    await fireEvent.press(getByTestId('opening-skip'));
    expect(started).toHaveLength(1);
    await act(async () => completeNext());
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("takes Android's back button as 'skip', and keeps it from closing the app", async () => {
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      _event: string,
      handler: () => boolean
    ) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    }) as unknown as typeof BackHandler.addEventListener);
    const { onFinished } = await mount();
    let handled = false;
    await act(async () => {
      handled = handlers[handlers.length - 1]();
    });
    // Returning true is what stops Android from closing the app.
    expect(handled).toBe(true);
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ kind: 'timing', toValue: 0, duration: LEAVE_MS });
    await act(async () => completeNext());
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('releases the native splash only after painting its own first frames', async () => {
    await mount();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await act(async () => clock.run(1, FRAME_MS));
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled(); // one frame is not yet painted
    await act(async () => clock.run(2, FRAME_MS));
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('is named for screen readers and says how to skip it', async () => {
    const { getByTestId } = await mount();
    const skip = getByTestId('opening-skip');
    expect(skip.props.accessibilityRole).toBe('button');
    expect(skip.props.accessibilityLabel).toBe('Maranatha');
    expect(skip.props.accessibilityHint).toBe('Double-tap to skip');
  });

  it("draws one canvas, on the app's paper", async () => {
    const { queryAllByTestId } = await mount();
    expect(queryAllByTestId('opening-canvas')).toHaveLength(1);
  });

  describe('with the phone set to reduce motion', () => {
    beforeEach(() => {
      mockReducedMotion = true;
    });

    it('does not play the film: it fades the closing still in, rests, and fades it out', async () => {
      const { toJSON, onFinished } = await mount();

      // Playback asks for no animation frames (only the splash hand-off does).
      await act(async () => clock.run(3, FRAME_MS));
      expect(clock.pending()).toBe(0);

      // The still is the closing frame: all nine letters of the wordmark.
      const text = JSON.stringify(toJSON());
      for (const d of LETTER_PATHS)
        expect(text).toContain(JSON.stringify(d).slice(1, 24));

      // In, a rest, out -- three beats, each finishing before the next.
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({
        kind: 'timing',
        toValue: 1,
        duration: STILL_IN_MS,
      });
      await act(async () => completeNext());
      expect(started[0]).toMatchObject({ kind: 'delay', ms: STILL_HOLD_MS });
      await act(async () => completeNext());
      expect(started[0]).toMatchObject({
        kind: 'timing',
        toValue: 0,
        duration: STILL_IN_MS,
      });
      expect(onFinished).not.toHaveBeenCalled();
      await act(async () => completeNext());
      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    it('is still skippable', async () => {
      const { getByTestId, onFinished } = await mount();
      await fireEvent.press(getByTestId('opening-skip'));
      // The still's own sequence was interrupted by the exit fade.
      const exit = started.find((a) => a.kind === 'timing' && a.toValue === 0);
      expect(exit).toBeDefined();
      await act(async () => {
        exit?.done?.({ finished: true });
      });
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });
});
