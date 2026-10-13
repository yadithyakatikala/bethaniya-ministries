import { Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import type { ScenePalette } from './palette';
import type { SchoolPaint } from './SchoolFishView';

/** Every gradient id the chapter and the band paint with, for one canvas. */
export interface ChapterPaint extends SchoolPaint {
  haze: string;
  bigRibbon: string;
  text: string;
}

export function chapterPaint(uid: string): ChapterPaint {
  return {
    haze: `${uid}h`,
    bigRibbon: `${uid}r`,
    ribbon: `${uid}l`,
    rim: `${uid}m`,
    text: `${uid}t`,
    fish: `${uid}f`,
  };
}

/**
 * The gradients of the onboarding chapter: the same metallic gold the
 * opening paints with, plus the school's own small ribbon and rim.
 */
export function ChapterDefs({
  paint,
  palette,
  sheen = 0,
  withWord = true,
}: {
  paint: ChapterPaint;
  palette: ScenePalette;
  /** Horizontal travel of the wordmark's sheen. */
  sheen?: number;
  /** The band does not draw the wordmark, so it does not need its gradient. */
  withWord?: boolean;
}) {
  const { gold } = palette;
  return (
    <Defs>
      <RadialGradient id={paint.haze} cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor={gold.high} stopOpacity="0.55" />
        <Stop offset="0.45" stopColor={gold.base} stopOpacity="0.24" />
        <Stop offset="1" stopColor={gold.base} stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id={paint.bigRibbon} x1="0" y1="0" x2="0.7" y2="1">
        <Stop offset="0" stopColor={gold.rim} />
        <Stop offset="0.3" stopColor={gold.base} />
        <Stop offset="0.55" stopColor={gold.dust[3]} />
        <Stop offset="0.8" stopColor={gold.base} />
        <Stop offset="1" stopColor={gold.rim} />
      </LinearGradient>
      <LinearGradient id={paint.ribbon} x1="0" y1="0" x2="0.7" y2="1">
        <Stop offset="0" stopColor={gold.base} />
        <Stop offset="0.5" stopColor={gold.dust[3]} />
        <Stop offset="1" stopColor={gold.base} />
      </LinearGradient>
      <LinearGradient id={paint.rim} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={gold.high} />
        <Stop offset="0.5" stopColor={gold.dust[3]} />
        <Stop offset="1" stopColor={gold.base} />
      </LinearGradient>
      {withWord ? (
        <LinearGradient
          id={paint.text}
          gradientUnits="userSpaceOnUse"
          x1="84"
          y1="384"
          x2="236"
          y2="402"
          gradientTransform={[1, 0, 0, 1, sheen, 0]}
        >
          <Stop offset="0" stopColor={gold.deep} />
          <Stop offset="0.28" stopColor={gold.base} />
          <Stop offset="0.46" stopColor={gold.textPeak} />
          <Stop offset="0.52" stopColor={gold.textPeak} />
          <Stop offset="0.58" stopColor={gold.textPeak} />
          <Stop offset="0.76" stopColor={gold.base} />
          <Stop offset="1" stopColor={gold.deep} />
        </LinearGradient>
      ) : null}
      <LinearGradient id={paint.fish} x1="0" y1="0" x2="0.85" y2="1">
        <Stop offset="0" stopColor={palette.ink} />
        <Stop offset="0.34" stopColor={gold.inkSoft} />
        <Stop offset="0.52" stopColor={gold.inkSoft} />
        <Stop offset="0.7" stopColor={palette.ink} />
        <Stop offset="1" stopColor={palette.ink} />
      </LinearGradient>
    </Defs>
  );
}
