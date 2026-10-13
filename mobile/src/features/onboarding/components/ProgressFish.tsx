import { useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { FISH_A_D, FISH_B_D } from '../../opening/engine/constants';
import { useTheme } from '../../../theme';
import type { StepNumber } from '../onboardingFlow';

const XS = [10, 55, 100, 145, 190] as const;
const Y = 15;

/**
 * The progress indicator: the fish rides a gold line, and the line is the
 * wind it has carried so far.
 *
 * Five stops. The ones behind the fish are filled gold; the ones ahead are
 * empty rings; the fish itself marks where the member is. It is drawn, not
 * labelled -- the parent gives it its spoken name ("Step 2 of 5"), since a
 * picture of a fish means nothing to a screen reader.
 */
export function ProgressFish({ step }: { step: StepNumber }) {
  const { colors, gold } = useTheme();
  const uid = 'pf' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const body = `${uid}b`;
  const trail = `${uid}l`;
  const here = XS[step - 1];

  return (
    <Svg
      width="100%"
      height={30}
      viewBox="0 0 200 30"
      preserveAspectRatio="xMidYMid meet"
    >
      <Defs>
        <LinearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gold.rim} />
          <Stop offset="0.42" stopColor={gold.base} />
          <Stop offset="0.62" stopColor={gold.dust[3]} />
          <Stop offset="1" stopColor={gold.base} />
        </LinearGradient>
        <LinearGradient id={trail} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={gold.base} />
          <Stop offset="0.6" stopColor={gold.high} />
          <Stop offset="1" stopColor={gold.dust[3]} />
        </LinearGradient>
      </Defs>
      <Line
        x1={XS[0]}
        y1={Y}
        x2={XS[4]}
        y2={Y}
        stroke={colors.border}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {step > 1 ? (
        <Line
          x1={XS[0]}
          y1={Y}
          x2={here - 9}
          y2={Y}
          stroke={`url(#${trail})`}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      ) : null}
      {XS.map((x, i) => {
        if (i === step - 1) return null;
        return i < step - 1 ? (
          <Circle key={i} cx={x} cy={Y} r={3.4} fill={colors.accent} />
        ) : (
          <Circle
            key={i}
            cx={x}
            cy={Y}
            r={3.2}
            fill={colors.paper}
            stroke={colors.borderStrong}
            strokeWidth={1.5}
          />
        );
      })}
      <G x={here} y={Y} scale={0.27}>
        <Path
          d={FISH_A_D}
          fill="none"
          stroke={`url(#${body})`}
          strokeWidth={7.4}
          strokeLinecap="round"
        />
        <Path
          d={FISH_B_D}
          fill="none"
          stroke={`url(#${body})`}
          strokeWidth={7.4}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
