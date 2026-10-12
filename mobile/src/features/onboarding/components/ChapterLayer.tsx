import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, type ImageSourcePropType } from 'react-native';
import { ChapterCanvas } from '../../opening/ChapterCanvas';
import {
  CHAPTER_T,
  getChapterScene,
  renderChapterFrame,
} from '../../opening/engine/chapter';
import type { ScenePalette } from '../../opening/palette';
import type { StageMapping } from '../../opening/stage';
import { usePlayback } from '../../opening/usePlayback';

/**
 * How long the short version takes to arrive. It begins mid-story, with the
 * school already formed, and what was on screen a moment ago is plain paper:
 * so it fades in, rather than appearing.
 */
export const RESUME_FADE_MS = 300;

/** When the first question begins to rise, and when it can be used. */
export const FORM_START_SECONDS = CHAPTER_T.form[0] - 0.1;
export const FORM_READY_SECONDS = FORM_START_SECONDS + 0.86;

/**
 * The onboarding chapter, playing full screen behind the first question.
 *
 * It owns its own clock, so the frame it redraws sixty times a second is
 * the only thing that does -- the form above it is not re-rendered by it.
 * It reports two moments upward: when the first question should begin to
 * rise, and when the chapter is over.
 *
 * THE CHAPTER NEVER BLOCKS. Until the question has risen, a tap anywhere
 * skips straight to it. Once it has risen the tap target is gone, so the
 * question is usable while the school finishes settling behind it.
 *
 * `startAt` is null until the device has said whether it has played the
 * chapter before (a moment): until then the first frame is held, which is
 * the opening's last frame, so there is nothing to see change.
 */
export function ChapterLayer({
  startAt,
  palette,
  portrait,
  mapping,
  skipLabel,
  skipHint,
  onFormStart,
  onDone,
}: {
  startAt: number | null;
  palette: ScenePalette;
  portrait: ImageSourcePropType;
  mapping: StageMapping;
  skipLabel: string;
  skipHint: string;
  onFormStart: () => void;
  onDone: () => void;
}) {
  const scene = useMemo(() => getChapterScene(), []);
  const origin = startAt ?? 0;
  const resuming = startAt !== null && startAt > 0;
  const [fade] = useState(() => new Animated.Value(resuming ? 0 : 1));
  // Before paint, so the first frame of the short version is never drawn at full strength.
  useLayoutEffect(() => {
    if (!resuming) return undefined;
    fade.setValue(0);
    const arrive = Animated.timing(fade, {
      toValue: 1,
      duration: RESUME_FADE_MS,
      useNativeDriver: true,
    });
    arrive.start();
    return () => arrive.stop();
  }, [resuming, fade]);
  const elapsed = usePlayback({
    duration: CHAPTER_T.total - origin,
    active: startAt !== null,
    onDone,
  });
  const seconds = origin + elapsed;
  const frame = useMemo(() => renderChapterFrame(scene, seconds), [scene, seconds]);

  const started = useRef(false);
  useEffect(() => {
    if (!started.current && startAt !== null && seconds >= FORM_START_SECONDS) {
      started.current = true;
      onFormStart();
    }
  }, [seconds, startAt, onFormStart]);

  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        pointerEvents="none"
      >
        <ChapterCanvas
          frame={frame}
          palette={palette}
          portrait={portrait}
          mapping={mapping}
        />
      </Animated.View>
      {seconds < FORM_READY_SECONDS ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          accessibilityHint={skipHint}
          onPress={onDone}
          testID="onboarding-chapter-skip"
        />
      ) : null}
    </>
  );
}
