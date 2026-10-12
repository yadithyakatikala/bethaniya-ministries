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
 */
export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.75,
  testID,
}: {
  name: IconName;
  size?: number;
  /** Defaults to the primary ink. */
  color?: string;
  strokeWidth?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.ink;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {ICON_SHAPES[name].map((shape, index) => {
        const key = `${name}-${index}`;
        const fill = 'fill' in shape && shape.fill ? tint : undefined;
        if (shape.t === 'path') return <Path key={key} d={shape.d} fill={fill} />;
        if (shape.t === 'circle')
          return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} />;
        return (
          <Rect
            key={key}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.rx}
          />
        );
      })}
    </Svg>
  );
}
