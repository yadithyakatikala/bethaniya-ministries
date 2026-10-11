import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTranslation } from '../../i18n/useTranslation';
import { useReducedMotion } from '../../theme/motion';
import { PRODUCT_NAME } from '../../theme/brand';
import { useTheme } from '../../theme/useTheme';
import { OpeningCanvas } from './OpeningCanvas';
import { OPENING_DURATION } from './engine/constants';
import { renderOpeningFrame } from './engine/frame';
import { getOpeningScene } from './engine/scene';
import { scenePalette } from './palette';
import { usePlayback } from './usePlayback';

const PORTRAIT = require('../../../assets/brand/maranatha-portrait-crop-512.jpg');

/** How long the overlay takes to dissolve into whatever is underneath. */
export const LEAVE_MS = 260;
/** Reduced motion: the still fades in, rests, and fades out. */
export const STILL_IN_MS = 260;
export const STILL_HOLD_MS = 900;

/**
 * The opening, drawn over the app while it starts.
 *
 * The app underneath mounts and loads at the same time -- fonts, the
 * signed-in session -- so the film costs no extra waiting. When it ends
 * (or the person taps to skip) the overlay dissolves, and what is
 * underneath is already there: its ground is the same paper, so there is
 * no frame in between that is blank, black or a different colour.
 *
 * Motion is never imposed. With the system's reduce-motion setting on, the
 * film does not play: the closing still -- the portrait over the gold
 * wordmark -- fades in, rests for a moment and fades out.
 *
 * It does not block anything for longer than the film: one tap skips it.
 */
export function OpeningOverlay({ onFinished }: { onFinished: () => void }) {
  const { colors, gold } = useTheme();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const scene = useMemo(() => getOpeningScene(), []);
  const palette = scenePalette(colors, gold);

  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 0 : 1));
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  }, [onFinished]);

  const leave = useCallback(
    (duration: number) => {
      setLeaving(true);
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) finish();
      });
    },
    [finish, opacity]
  );

  // The native splash is a bare ground colour. It is released only once
  // this overlay -- the same ground -- has had a chance to paint, so the
  // swap is invisible.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void SplashScreen.hideAsync().catch(() => undefined);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  // Android's back button skips the film. It must never close the app, or
  // pop a screen nobody can see, while this is on top.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!leaving) leave(reducedMotion ? STILL_IN_MS : LEAVE_MS);
      return true;
    });
    return () => subscription.remove();
  }, [leave, leaving, reducedMotion]);

  const seconds = usePlayback({
    duration: OPENING_DURATION,
    active: !reducedMotion && !leaving,
    onDone: () => leave(LEAVE_MS),
  });

  // Reduced motion: still in, rest, still out.
  useEffect(() => {
    if (!reducedMotion) return undefined;
    const sequence = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: STILL_IN_MS,
        useNativeDriver: true,
      }),
      Animated.delay(STILL_HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: STILL_IN_MS,
        useNativeDriver: true,
      }),
    ]);
    sequence.start(({ finished }) => {
      if (finished) finish();
    });
    return () => sequence.stop();
  }, [reducedMotion, opacity, finish]);

  const frame = useMemo(
    () => renderOpeningFrame(scene, reducedMotion ? OPENING_DURATION : seconds),
    [scene, reducedMotion, seconds]
  );

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        // Above every screen, on both platforms.
        { opacity, backgroundColor: palette.ground, zIndex: 1000, elevation: 1000 },
      ]}
      // Screen readers read this, not the screen waiting underneath it.
      accessibilityViewIsModal
      testID="opening-overlay"
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={PRODUCT_NAME}
        accessibilityHint={t('opening.skipHint')}
        onPress={() => {
          if (!leaving) leave(reducedMotion ? STILL_IN_MS : LEAVE_MS);
        }}
        testID="opening-skip"
      >
        <OpeningCanvas frame={frame} palette={palette} portrait={PORTRAIT} />
      </Pressable>
    </Animated.View>
  );
}
