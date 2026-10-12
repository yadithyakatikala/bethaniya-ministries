import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ICON_SHAPES, type IconName } from './iconShapes';
import { useTheme } from '../useTheme';

/**
 * One of the app's icons, drawn as vector shapes in a single colour.
 *
 * It takes the colour of whatever it sits in (ink by default; pass
 * `colors.inkMuted` for a quiet one, `colors.accent` for a gold mark) and
 * it is DECORATIVE: hidden from the accessibility tree, because an icon
 * carries no words. The control around it -- a button, a row, a tab --
 * is what has a name, and `IconButton` makes that name mandatory.
 *
 * `filled` is the SELECTED look a tab wears: a heavier stroke (2) and a
 * 14% wash of its own colour inside every shape. It is the weight of the
 * glyph that says "this one", never only its colour.
 */
export function Icon({
  name,
  size = 24,
  color,
  strokeWidth,
  filled = false,
  testID,
}: {
  name: IconName;
  size?: number;
  /** Defaults to the primary ink. */
  color?: string;
  /** 1.75, or 2 when `filled`. */
  strokeWidth?: number;
  /** The selected look: a heavier stroke and a faint fill. */
  filled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.ink;
  const stroke = strokeWidth ?? (filled ? 2 : 1.75);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {ICON_SHAPES[name].map((shape, index) => {
        const key = `${name}-${index}`;
        const solid = 'fill' in shape && shape.fill;
        // A solid glyph (the play triangle) stays solid; any other gets the wash.
        const fill = solid || filled ? tint : undefined;
        const fillOpacity = !solid && filled ? 0.14 : undefined;
        if (shape.t === 'path')
          return <Path key={key} d={shape.d} fill={fill} fillOpacity={fillOpacity} />;
        if (shape.t === 'circle')
          return (
            <Circle
              key={key}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.r}
              fill={fill}
              fillOpacity={fillOpacity}
            />
          );
        return (
          <Rect
            key={key}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.rx}
            fill={fill}
            fillOpacity={fillOpacity}
          />
        );
      })}
    </Svg>
  );
}
