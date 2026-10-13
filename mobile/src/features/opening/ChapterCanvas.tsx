import { useId } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
} from 'react-native-svg';
import { ChapterDefs, chapterPaint } from './ChapterDefs';
import { SchoolFishView } from './SchoolFishView';
import { F0, HERO, K, OX, START_ANGLE, type ChapterFrame } from './engine/chapter';
import { FISH_A_D, FISH_B_D, FISH_STROKE, LOGO, TIERS } from './engine/constants';
import { tierStyle } from './engine/frame';
import { LETTER_PATHS } from './engine/wordmark';
import type { ScenePalette } from './palette';
import type { StageMapping } from './stage';

/** Stroke of the streaks the word sheds on its way to becoming the fish. */
const STREAK_WIDTH = [0.55, 0.75, 0.95, 1.15] as const;

/**
 * Draws one frame of the onboarding chapter, full screen.
 *
 * The same layering as the film: the portrait and the wordmark (the
 * opening's last frame) at the bottom, then the haze and ribbons of the
 * journey, the fish while it is still gold, the school, and over everything
 * the glow, the bloom, the motes and the streaks of gold.
 *
 * It does not own the ground: the screen's own paper is behind it, so the
 * form that rises over it is on the same surface.
 */
export function ChapterCanvas({
  frame,
  palette,
  portrait,
  mapping,
}: {
  frame: ChapterFrame;
  palette: ScenePalette;
  portrait: ImageSourcePropType;
  mapping: StageMapping;
}) {
  const uid = 'oc' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const paint = chapterPaint(uid);
  const clip = `${uid}c`;
  const { gold } = palette;
  const { portrait: logo, letters, sheen } = frame.open;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="chapter-canvas">
      <Svg
        width="100%"
        height="100%"
        viewBox={`${mapping.viewX} ${mapping.viewY} ${mapping.viewW} ${mapping.viewH}`}
        preserveAspectRatio="xMinYMin meet"
      >
        <ChapterDefs paint={paint} palette={palette} sheen={sheen} />
        <Defs>
          <ClipPath id={clip}>
            <Circle cx={LOGO.x} cy={LOGO.y} r={LOGO.r} />
          </ClipPath>
        </Defs>

        {/* the opening's last frame, placed as the opening places itself */}
        <G x={OX} scale={K}>
          {logo.opacity > 0 ? (
            <G
              opacity={logo.opacity}
              x={0}
              y={logo.offsetY}
              scale={logo.scale}
              originX={LOGO.x}
              originY={LOGO.y}
            >
              <SvgImage
                x={LOGO.x - LOGO.r}
                y={LOGO.y - LOGO.r}
                width={LOGO.r * 2}
                height={LOGO.r * 2}
                href={portrait}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${clip})`}
              />
            </G>
          ) : null}
          {letters.map((letter, k) =>
            letter.opacity > 0 ? (
              <G key={k} opacity={letter.opacity} y={letter.dy}>
                <Path d={LETTER_PATHS[k]} fill={`url(#${paint.text})`} />
              </G>
            ) : null
          )}
        </G>

        {frame.hazeOpacity > 0 ? (
          <G opacity={frame.hazeOpacity}>
            {frame.haze.map((dot, i) => (
              <Circle
                key={i}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={`url(#${paint.haze})`}
                opacity={dot.opacity}
              />
            ))}
          </G>
        ) : null}

        {frame.ribbonsOpacity > 0 ? (
          <G opacity={frame.ribbonsOpacity}>
            {frame.ribbons.map((rib, i) => (
              <Path
                key={i}
                d={rib.d}
                fill={`url(#${paint.bigRibbon})`}
                opacity={rib.opacity}
              />
            ))}
          </G>
        ) : null}

        {/* the fish, gold as the word gives itself back, before it cools into ink */}
        {frame.goldFish.opacity > 0 ? (
          <G
            opacity={frame.goldFish.opacity}
            x={F0.x}
            y={F0.y}
            rotation={START_ANGLE}
            scale={HERO}
          >
            <Path
              d={FISH_A_D}
              fill="none"
              stroke={`url(#${paint.rim})`}
              strokeLinecap="round"
              strokeWidth={FISH_STROKE}
            />
            <Path
              d={FISH_B_D}
              fill="none"
              stroke={`url(#${paint.rim})`}
              strokeLinecap="round"
              strokeWidth={FISH_STROKE}
            />
          </G>
        ) : null}

        <G>
          {frame.school.map((fish, i) => (
            <SchoolFishView key={i} fish={fish} paint={paint} />
          ))}
        </G>

        <Circle
          cx={frame.glow.cx}
          cy={frame.glow.cy}
          r={frame.glow.r}
          fill={`url(#${paint.haze})`}
          opacity={frame.glow.opacity}
        />
        <G>
          {frame.blooms.map((dot, i) => (
            <Circle
              key={i}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={`url(#${paint.haze})`}
              opacity={dot.opacity}
            />
          ))}
        </G>
        <G>
          {Array.from({ length: TIERS }, (_, i) => {
            const style = tierStyle(i);
            const tier = frame.tiers[i];
            return tier.d ? (
              <Path
                key={i}
                d={tier.d}
                fill="none"
                stroke={gold.dust[style.dust]}
                strokeLinecap="round"
                strokeWidth={style.width}
                opacity={tier.opacity}
              />
            ) : null;
          })}
        </G>
        <G>
          {frame.streaks.map((streak, i) =>
            streak.d ? (
              <Path
                key={i}
                d={streak.d}
                fill="none"
                stroke={gold.dust[[1, 2, 2, 3][i]]}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={STREAK_WIDTH[i]}
                opacity={streak.opacity}
              />
            ) : null
          )}
        </G>
      </Svg>
    </View>
  );
}
