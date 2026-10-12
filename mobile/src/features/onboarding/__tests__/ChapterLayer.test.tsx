import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { brandGold, lightTokens } from '../../../theme/tokens';
import {
  installAnimatedDriver,
  type AnimatedDriver,
} from '../../../testing/animatedDriver';
import { installFrameClock, type FrameClock } from '../../../testing/frameClock';
import { CHAPTER_T, RESUME_START } from '../../opening/engine/chapter';
import { scenePalette } from '../../opening/palette';
import { stageMapping } from '../../opening/stage';
import {
  ChapterLayer,
  FORM_READY_SECONDS,
  FORM_START_SECONDS,
  RESUME_FADE_MS,
} from '../components/ChapterLayer';

/**
 * The chapter's contract with the screen above it: it tells the screen when
 * the first question should begin to rise and when it is over, it can be
 * skipped by a tap until the question is usable, and it waits (showing the
 * opening's last frame, so nothing changes) until it knows which version to
 * play.
 */
const PORTRAIT = 1; // an opaque stand-in; the canvas passes it straight to <Image>
const palette = scenePalette(lightTokens, brandGold.light);
const mapping = stageMapping(390, 844, 96);

let clock: FrameClock;
let driver: AnimatedDriver;
beforeEach(() => {
  clock = installFrameClock();
  driver = installAnimatedDriver();
});
afterEach(async () => {
  await cleanup();
  clock.restore();
  driver.restore();
});

async function mount(startAt: number | null) {
  const onFormStart = jest.fn();
  const onDone = jest.fn();
  const view = await render(
    <ChapterLayer
      startAt={startAt}
      palette={palette}
      portrait={PORTRAIT}
      mapping={mapping}
      skipLabel="Skip"
      skipHint="Tap to go straight to the question"
      onFormStart={onFormStart}
      onDone={onDone}
    />
  );
  return { ...view, onFormStart, onDone };
}

/** Runs the clock for `seconds` of film, a frame (16 ms) at a time. */
const play = (seconds: number) =>
  act(async () => clock.run(Math.ceil((seconds * 1000) / 16)));

describe('the full chapter', () => {
  it('lets the first question begin to rise at about 3.45 s, once', async () => {
    expect(FORM_START_SECONDS).toBeCloseTo(CHAPTER_T.form[0] - 0.1, 10);
    const { onFormStart, onDone } = await mount(0);
    await play(FORM_START_SECONDS - 0.4);
    expect(onFormStart).not.toHaveBeenCalled();
    await play(0.6);
    expect(onFormStart).toHaveBeenCalledTimes(1);
    await play(1.0);
    expect(onFormStart).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not fade in: it begins on the picture the opening ends on', async () => {
    await mount(0);
    await play(0.5);
    expect(driver.started.filter((a) => a.duration === RESUME_FADE_MS)).toHaveLength(0);
  });

  it('is over at exactly five seconds, and reports it once', async () => {
    const { onDone } = await mount(0);
    await play(CHAPTER_T.total - 0.5);
    expect(onDone).not.toHaveBeenCalled();
    await play(0.7);
    expect(onDone).toHaveBeenCalledTimes(1);
    await play(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toBe(0); // and it asks for no more frames
  });

  it('draws the scene throughout', async () => {
    const view = await mount(0);
    expect(view.getByTestId('chapter-canvas')).toBeTruthy();
    await play(2);
    expect(view.getByTestId('chapter-canvas')).toBeTruthy();
  });
});

describe('the short version, for a member who has seen it', () => {
  it('begins part-way through, and the question rises half a second in', async () => {
    const { onFormStart, onDone } = await mount(RESUME_START);
    expect(RESUME_START).toBeCloseTo(2.95, 10);
    await play(FORM_START_SECONDS - RESUME_START - 0.3);
    expect(onFormStart).not.toHaveBeenCalled();
    await play(0.5);
    expect(onFormStart).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('fades in over 300 ms rather than appearing: what was on screen before was plain paper', async () => {
    expect(RESUME_FADE_MS).toBe(300);
    const { getByTestId } = await mount(RESUME_START);
    const fade = driver.started.find(
      (a) => a.kind === 'timing' && a.duration === RESUME_FADE_MS
    );
    expect(fade).toMatchObject({ toValue: 1 });
    // ...and the first frame is drawn at nothing, not at full strength
    const layer = getByTestId('chapter-canvas').parent!;
    expect(JSON.stringify(layer.props.style)).toContain('"opacity":0');
    await act(async () => driver.completeNext());
    expect(JSON.stringify(getByTestId('chapter-canvas').parent!.props.style)).toContain(
      '"opacity":1'
    );
  });

  it('is over about two seconds in', async () => {
    const { onDone } = await mount(RESUME_START);
    await play(CHAPTER_T.total - RESUME_START - 0.3);
    expect(onDone).not.toHaveBeenCalled();
    await play(0.5);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('while the device is still deciding which version to play', () => {
  it('holds the first frame: nothing moves, nothing is reported, no frames are requested', async () => {
    const { onFormStart, onDone, getByTestId } = await mount(null);
    await play(6);
    expect(onFormStart).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(clock.pending()).toBe(0);
    expect(getByTestId('chapter-canvas')).toBeTruthy();
  });

  it('then plays from where it was told to start', async () => {
    const view = await mount(null);
    await play(1);
    await view.rerender(
      <ChapterLayer
        startAt={RESUME_START}
        palette={palette}
        portrait={PORTRAIT}
        mapping={mapping}
        skipLabel="Skip"
        skipHint="hint"
        onFormStart={view.onFormStart}
        onDone={view.onDone}
      />
    );
    await play(CHAPTER_T.total - RESUME_START + 0.3);
    expect(view.onFormStart).toHaveBeenCalledTimes(1);
    expect(view.onDone).toHaveBeenCalledTimes(1);
  });
});

describe('skipping', () => {
  it('a tap anywhere on the scene goes straight to the question', async () => {
    const { getByTestId, onDone } = await mount(0);
    const skip = getByTestId('onboarding-chapter-skip');
    expect(skip.props.accessibilityRole).toBe('button');
    expect(skip.props.accessibilityLabel).toBe('Skip');
    expect(skip.props.accessibilityHint).toBe('Tap to go straight to the question');
    await fireEvent.press(skip);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('is offered until the question can be used, and not after', async () => {
    expect(FORM_READY_SECONDS).toBeCloseTo(FORM_START_SECONDS + 0.86, 10);
    const { queryByTestId } = await mount(0);
    await play(FORM_READY_SECONDS - 0.3);
    expect(queryByTestId('onboarding-chapter-skip')).not.toBeNull();
    await play(0.6);
    // The question is up: the whole screen belongs to it, not to a skip target.
    expect(queryByTestId('onboarding-chapter-skip')).toBeNull();
  });

  it('the question can be used about four seconds in, before the school has finished settling', () => {
    expect(FORM_READY_SECONDS).toBeGreaterThan(4.2);
    expect(FORM_READY_SECONDS).toBeLessThan(4.4);
    expect(FORM_READY_SECONDS).toBeLessThan(CHAPTER_T.total);
  });

  it('the short version is skippable too, until the question is up', async () => {
    const { queryByTestId, onDone } = await mount(RESUME_START);
    expect(queryByTestId('onboarding-chapter-skip')).not.toBeNull();
    await play(FORM_READY_SECONDS - RESUME_START + 0.2);
    expect(queryByTestId('onboarding-chapter-skip')).toBeNull();
    expect(onDone).not.toHaveBeenCalled(); // it finishes on its own, a moment later
  });
});

describe('leaving', () => {
  it('stops its clock when it is taken off the screen', async () => {
    const view = await mount(0);
    await play(1);
    expect(clock.pending()).toBeGreaterThan(0);
    await view.unmount();
    expect(clock.pending()).toBe(0);
  });
});
