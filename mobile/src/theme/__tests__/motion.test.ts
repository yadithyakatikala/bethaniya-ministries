import {
  PUSH_ANIMATION_MS,
  TAB_FADE_MS,
  animationDuration,
  pushAnimation,
  sheetAnimation,
  tabAnimation,
} from '../motion';
import {
  buildScreenOptions,
  buildTabScreenOptions,
} from '../../navigation/AppNavigator';
import { lightTokens } from '../tokens';

/**
 * How the app moves, and when it does not.
 *
 * A tester's note was that the app "feels abrupt". The answer is three
 * movements and no more -- a push, a tab fade, a sheet -- which is what
 * the first half of this file pins. The second half pins the part that
 * matters more: WHEN THE PHONE SAYS "REMOVE ANIMATIONS", THERE ARE NONE.
 *
 * That is not a preference this app invents; it is the system setting,
 * and somebody who has turned it on has usually done so because motion
 * makes them ill. "Less motion" is not the right answer to it.
 */
describe('the three movements', () => {
  it('pushes a drill-down with the platform transition', () => {
    expect(pushAnimation(false)).toBe('default');
  });

  it('CROSS-FADES a tab, rather than sliding it', () => {
    // A slide would claim a drill-down that did not happen: the five
    // tabs sit beside each other.
    expect(tabAnimation(false)).toBe('fade');
  });

  it('slides a sheet up from the bottom', () => {
    expect(sheetAnimation(false)).toBe('slide');
  });

  it('keeps every one of them short', () => {
    // A transition is the cost of getting somewhere. Nobody wants to
    // pay it twice.
    expect(PUSH_ANIMATION_MS).toBeLessThanOrEqual(300);
    expect(TAB_FADE_MS).toBeLessThanOrEqual(200);
    expect(TAB_FADE_MS).toBeLessThan(PUSH_ANIMATION_MS);
  });
});

describe('when the phone asks for no animations', () => {
  it('gives none, not fewer', () => {
    expect(pushAnimation(true)).toBe('none');
    expect(tabAnimation(true)).toBe('none');
    expect(sheetAnimation(true)).toBe('none');
  });

  it('zeroes the duration as well as the name', () => {
    // 'none' with a duration still schedules the transition; on Android
    // it takes both to actually remove the movement.
    expect(animationDuration(true, PUSH_ANIMATION_MS)).toBe(0);
    expect(animationDuration(true, TAB_FADE_MS)).toBe(0);
    expect(animationDuration(false, PUSH_ANIMATION_MS)).toBe(PUSH_ANIMATION_MS);
  });
});

describe('what the navigator is actually given', () => {
  it('animates a push, and times it', () => {
    const options = buildScreenOptions(lightTokens);
    expect(options.animation).toBe('default');
    expect(options.animationDuration).toBe(PUSH_ANIMATION_MS);
  });

  it('fades a tab, and times it', () => {
    const options = buildTabScreenOptions();
    expect(options.animation).toBe('fade');
    expect(options.animationDuration).toBe(TAB_FADE_MS);
  });

  it('stops moving entirely under reduced motion', () => {
    expect(buildScreenOptions(lightTokens, true)).toMatchObject({
      animation: 'none',
      animationDuration: 0,
    });
    expect(buildTabScreenOptions(true)).toMatchObject({
      animation: 'none',
      animationDuration: 0,
    });
  });

  it('leaves the theming of the stack alone either way', () => {
    // The transition is the only thing this touches. A regression here
    // would be the dark-mode-chrome bug all over again.
    const moving = buildScreenOptions(lightTokens, false);
    const still = buildScreenOptions(lightTokens, true);
    expect(still.headerStyle).toEqual(moving.headerStyle);
    expect(still.contentStyle).toEqual(moving.contentStyle);
    expect(still.headerTintColor).toBe(moving.headerTintColor);
  });
});
