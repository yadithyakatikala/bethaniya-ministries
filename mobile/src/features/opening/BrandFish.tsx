import { useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { FISH_A_D, FISH_B_D } from './engine/constants';
import { useTheme } from '../../theme';

/** The fish's outline spans x -40..40 and y about -14..14 in its own units. */
const VIEW_W = 88;
const VIEW_H = 36;

/**
 * The fish: the brand's mark, the same two arcs the opening draws and the
 * onboarding school swims with (there is no separate fish file -- the
 * approved film defined it as this outline).
 *
 * `tone="gold"` paints it with the metallic stops, so it is the same metal
 * that wrote the word. Under 24 points wide the gradient cannot be seen and
 * only muddies the line, so a small fish is flat gold ink (`accent`) --
 * the design system's rule. `tone="ink"` is the ink fish of the school.
 *
 * Decorative: a picture of a fish means nothing to a screen reader, and the
 * words next to it (the wordmark, a title) are what carry the name. Clear
 * space around it is half its height; the caller lays that out.
 */
export function BrandFish({
  size = 36,
  tone = 'gold',
  testID,
}: {
  /** Width in points. Height follows. */
  size?: number;
  tone?: 'gold' | 'ink' | 'muted';
  testID?: string;
}) {
  const { colors, gold } = useTheme();
  const uid = 'bf' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const metallic = tone === 'gold' && size >= 24;
  const stroke = metallic
    ? `url(#${uid})`
    : tone === 'gold'
      ? colors.accent
      : tone === 'ink'
        ? colors.ink
        : colors.inkMuted;
  const height = (size * VIEW_H) / VIEW_W;
  // The film draws it 3.2 points thick at 0.58 scale: 5.5 in the fish's own units.
  const width = 5.6;

  return (
    <Svg
      width={size}
      height={height}
      viewBox={`${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {metallic ? (
        <Defs>
          <LinearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gold.rim} />
            <Stop offset="0.42" stopColor={gold.base} />
            <Stop offset="0.62" stopColor={gold.dust[3]} />
            <Stop offset="1" stopColor={gold.base} />
          </LinearGradient>
        </Defs>
      ) : null}
      <G>
        <Path
          d={FISH_A_D}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
        />
        <Path
          d={FISH_B_D}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
