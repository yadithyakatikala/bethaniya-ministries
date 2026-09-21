import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * =====================================================================
 * HOW THIS APP MOVES
 * =====================================================================
 * Plainly, quickly, and only between screens.
 *
 * A tester's note was that the app "feels abrupt" -- screens appearing
 * and disappearing as instant cuts, with nothing to say one thing led to
 * another. The fix is small on purpose. There are exactly three
 * movements in the whole app:
 *
 *   a push      a drill-down slides in from the side, the platform's
 *               own transition, because that is the gesture members
 *               already know from every other app on the phone
 *   a tab       a short cross-fade, because switching tabs is a lateral
 *               move: a slide would claim a drill-down that did not
 *               happen
 *   a sheet     slides up from the bottom and back down
 *
 * That is all. No shared elements, no springs, no staggered lists, and
 * nothing animated inside a screen -- a card that fades in while you
 * are trying to read it is worse than one that is simply there.
 *
 * WHY THE DURATIONS ARE NOT LONGER. A transition is the cost of getting
 * somewhere, and nobody wants to pay it twice. These are at the short
 * end of what still reads as a movement rather than a cut.
 *
 * =====================================================================
 * REDUCED MOTION IS NOT A PREFERENCE THIS APP INVENTS
 * =====================================================================
 * It is the one already on the phone -- iOS Settings > Accessibility >
 * Motion > Reduce Motion, Android Settings > Accessibility > Remove
 * animations. Somebody who has turned that on has usually done so
 * because motion makes them ill, and an app that adds its own toggle for
 * it is asking them to find and set it twice.
 *
 * So: read the system setting, and when it is on, DO NOT MOVE. Not
 * "move less" -- the honest response to "remove animations" is none at
 * all. Every screen still appears, and every sheet still opens; they
 * simply arrive rather than travel.
 *
 * The setting can be changed while the app is open, so the subscription
 * stays for the lifetime of the app rather than being read once.
 */
export const PUSH_ANIMATION_MS = 260;
export const TAB_FADE_MS = 140;

export type StackAnimation = 'default' | 'fade' | 'none';

/**
 * The system's "reduce motion" setting, kept current.
 *
 * Defaults to FALSE -- motion allowed -- while the first read is in
 * flight. That is the right default: the query resolves in a frame or
 * two, and starting from "reduced" would make the very first transition
 * of every launch the odd one out.
 *
 * A platform that cannot answer resolves to false as well. An animation
 * nobody asked to remove is not a failure state.
 *
 * It lives in the theme layer, beside the colours and the type scale,
 * because motion is part of the design system and because BOTH the
 * navigator and ./ui/Sheet.tsx need it. Putting it under ../navigation
 * would have the theme importing the navigator, which is the cycle
 * ./ui/Sheet.tsx's own header warns about.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduced(enabled);
      })
      .catch(() => {
        // Not answerable on this platform. Leave motion on.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduced(enabled)
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/** How a pushed screen arrives. */
export function pushAnimation(reducedMotion: boolean): StackAnimation {
  return reducedMotion ? 'none' : 'default';
}

/**
 * How a tab destination arrives.
 *
 * A fade, not a slide: the five tabs sit beside each other, and sliding
 * one in from the right would say a screen had been pushed on top of
 * another when nothing of the kind happened. It used to be an instant
 * cut, which is the abruptness the tester was describing.
 */
export function tabAnimation(reducedMotion: boolean): StackAnimation {
  return reducedMotion ? 'none' : 'fade';
}

/**
 * How a bottom sheet arrives -- React Native's own Modal vocabulary,
 * which is why this returns its strings rather than the stack's.
 */
export function sheetAnimation(reducedMotion: boolean): 'slide' | 'none' {
  return reducedMotion ? 'none' : 'slide';
}

/**
 * The duration to pass to the native stack.
 *
 * Zero when motion is reduced, which matters as well as the animation
 * name: a 'none' animation with a duration still schedules the
 * transition, and on Android the two together are what actually remove
 * the movement.
 */
export function animationDuration(reducedMotion: boolean, base: number): number {
  return reducedMotion ? 0 : base;
}
