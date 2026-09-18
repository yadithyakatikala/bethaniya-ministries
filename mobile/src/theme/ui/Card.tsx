import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../useTheme';

/**
 * A surface card -- borders first, no shadow.
 *
 * Shadows are avoided on purpose: an elevation that reads correctly on
 * the light paper is invisible on the near-black dark ground, so a
 * shadow-led card system needs two designs. A hairline border is one
 * design that works in both, and it suits the calm editorial direction.
 *
 * `padded={false}` is for a card whose children own their own padding --
 * a grouped row list, where padding on the card would double up with the
 * padding on each row.
 */
export function Card({
  style,
  padded = true,
  ...props
}: ViewProps & { padded?: boolean }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radii.card,
          padding: padded ? spacing.card : 0,
        },
        style,
      ]}
      {...props}
    />
  );
}
