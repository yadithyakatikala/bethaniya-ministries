import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, LinearGradient, Defs, Rect, Stop } from 'react-native-svg';
import { ChapterDefs, chapterPaint } from './ChapterDefs';
import { SchoolFishView } from './SchoolFishView';
import { BAND, type SchoolFish } from './engine/chapter';
import type { ScenePalette } from './palette';
import { MAX_STAGE_WIDTH, bandHeight } from './stage';

/**
 * The school at rest: the slim band above every question.
 *
 * It is the chapter's last frame kept alive -- the same fish, in the same
 * places, swaying -- laid out as part of the screen so the question sits
 * beneath it and never over it. With the keyboard up (`compact` > 0) the
 * band shrinks to a strip and the fish tuck into a single row; the edges
 * fade into the paper so nothing is ever cut in half.
 */
export function SchoolBand({
  school,
  palette,
  width,
  compact,
}: {
  school: SchoolFish[];
  palette: ScenePalette;
  /** The width the band is laid out in, in points. */
  width: number;
  /** 0 settled .. 1 tucked away (keyboard open). */
  compact: number;
}) {
  const uid = 'sb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const paint = chapterPaint(uid);
  const fade = `${uid}e`;

  const stageWidth = Math.min(width, MAX_STAGE_WIDTH);
  const scale = stageWidth / 390;
  const height = bandHeight(scale, compact);
  const full = BAND.h * scale;
  // The viewBox spans the layout width, so a wide screen shows more sea, not a crop.
  const viewX = -(width - stageWidth) / 2 / scale;

  return (
    <View
      style={[styles.band, { width, height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="school-band"
    >
      {/* The full-height drawing, centred in a window that can be shorter than it. */}
      <View style={{ position: 'absolute', left: 0, top: (height - full) / 2 }}>
        <Svg
          width={width}
          height={full}
          viewBox={`${viewX} ${BAND.y0} ${width / scale} ${BAND.h}`}
          preserveAspectRatio="xMinYMin meet"
        >
          <ChapterDefs paint={paint} palette={palette} withWord={false} />
          <G>
            {school.map((fish, i) => (
              <SchoolFishView key={i} fish={fish} paint={paint} />
            ))}
          </G>
        </Svg>
      </View>
      {compact > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.ground} stopOpacity="1" />
              <Stop offset="0.24" stopColor={palette.ground} stopOpacity="0" />
              <Stop offset="0.76" stopColor={palette.ground} stopOpacity="0" />
              <Stop offset="1" stopColor={palette.ground} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${fade})`} opacity={compact} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { overflow: 'hidden' },
});
