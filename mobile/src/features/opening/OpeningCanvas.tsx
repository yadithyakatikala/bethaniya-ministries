import { useId } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {
  FISH_A_D,
  FISH_B_D,
  FISH_SCALE,
  FISH_STROKE,
  LOGO,
  SCENE,
  TIERS,
  WORD_TEXT,
} from './engine/constants';
import { tierStyle, type OpeningFrame } from './engine/frame';
import { LETTER_PATHS } from './engine/wordmark';
import type { ScenePalette } from './palette';

/**
 * Draws one frame of the opening.
 *
 * It owns no clock and no state: hand it a frame and it paints it. The
 * same component draws the live film, the reduced-motion still and the
 * test frames. Layer order is the film's: haze and ribbons sit UNDER the
 * portrait, while the fish, its glow, the motes and the wordmark sit over
 * it.
 */
export function OpeningCanvas({
  frame,
  palette,
  portrait,
}: {
  frame: OpeningFrame;
  palette: ScenePalette;
  portrait: ImageSourcePropType;
}) {
  // Gradient ids are global in some renderers, so give each canvas its own.
  const uid = 'mo' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = {
    haze: `${uid}h`,
    ribbon: `${uid}r`,
    text: `${uid}t`,
    fish: `${uid}f`,
    clip: `${uid}c`,
  };
  const { gold } = palette;

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.ground }]}
      pointerEvents="none"
      testID="opening-canvas"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCENE.w} ${SCENE.h}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <ClipPath id={ids.clip}>
            <Circle cx={LOGO.x} cy={LOGO.y} r={LOGO.r} />
          </ClipPath>
          <RadialGradient id={ids.haze} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={gold.high} stopOpacity="0.55" />
            <Stop offset="0.45" stopColor={gold.base} stopOpacity="0.24" />
            <Stop offset="1" stopColor={gold.base} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={ids.ribbon} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={gold.rim} />
            <Stop offset="0.3" stopColor={gold.base} />
            <Stop offset="0.55" stopColor={gold.dust[3]} />
            <Stop offset="0.8" stopColor={gold.base} />
            <Stop offset="1" stopColor={gold.rim} />
          </LinearGradient>
          {/* The wordmark's sheen peaks at a DIMMER gold than the motes do:
              a letter filled with the near-white specular would disappear
              against the paper. */}
          <LinearGradient
            id={ids.text}
            gradientUnits="userSpaceOnUse"
            x1="84"
            y1="384"
            x2="236"
            y2="402"
            gradientTransform={[1, 0, 0, 1, frame.sheen, 0]}
          >
            <Stop offset="0" stopColor={gold.deep} />
            <Stop offset="0.28" stopColor={gold.base} />
            <Stop offset="0.46" stopColor={gold.textPeak} />
            <Stop offset="0.52" stopColor={gold.textPeak} />
            <Stop offset="0.58" stopColor={gold.textPeak} />
            <Stop offset="0.76" stopColor={gold.base} />
            <Stop offset="1" stopColor={gold.deep} />
          </LinearGradient>
          {/* THE FISH IS INK. The gold is what it CARRIES, not what it is --
              which is the whole story. A faint lift through the middle keeps
              the body from reading as a flat cut-out. */}
          <LinearGradient id={ids.fish} x1="0" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={palette.ink} />
            <Stop offset="0.34" stopColor={gold.inkSoft} />
            <Stop offset="0.52" stopColor={gold.inkSoft} />
            <Stop offset="0.7" stopColor={palette.ink} />
            <Stop offset="1" stopColor={palette.ink} />
          </LinearGradient>
        </Defs>

        {frame.hazeOpacity > 0 ? (
          <G opacity={frame.hazeOpacity}>
            {frame.haze.map((dot, i) => (
              <Circle
                key={i}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={`url(#${ids.haze})`}
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
                fill={`url(#${ids.ribbon})`}
                opacity={rib.opacity}
              />
            ))}
          </G>
        ) : null}

        {/* scale about the portrait's centre */}
        <G
          opacity={frame.logo.opacity}
          scale={frame.logo.scale}
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
            clipPath={`url(#${ids.clip})`}
          />
        </G>

        {/* a soft bloom the fish itself carries, so it reads as lit rather than drawn */}
        <Circle
          cx={frame.glow.cx}
          cy={frame.glow.cy}
          r={frame.glow.r}
          fill={`url(#${ids.haze})`}
          opacity={frame.glow.opacity}
        />

        {/* translate(x y) rotate(heading) scale(0.58): the fish faces its flight */}
        <G
          opacity={frame.fish.opacity}
          x={frame.fish.x}
          y={frame.fish.y}
          rotation={frame.fish.angle}
          scale={FISH_SCALE}
        >
          <Path
            d={FISH_A_D}
            fill="none"
            stroke={`url(#${ids.fish})`}
            strokeLinecap="round"
            strokeWidth={FISH_STROKE}
          />
          <Path
            d={FISH_B_D}
            fill="none"
            stroke={`url(#${ids.fish})`}
            strokeLinecap="round"
            strokeWidth={FISH_STROKE}
          />
        </G>

        {/* Bloom: a soft halo under only the brightest motes. */}
        <G>
          {frame.blooms.map((dot, i) => (
            <Circle
              key={i}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={`url(#${ids.haze})`}
              opacity={dot.opacity}
            />
          ))}
        </G>

        {/* The carried gold, and what the fish becomes -- one material,
            drawn as eight brightness tiers. */}
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

        {WORD_TEXT.split('').map((_, k) => {
          const letter = frame.letters[k];
          return letter.opacity > 0 ? (
            <G key={k} opacity={letter.opacity} y={letter.dy}>
              <Path d={LETTER_PATHS[k]} fill={`url(#${ids.text})`} />
            </G>
          ) : null;
        })}
      </Svg>
    </View>
  );
}
