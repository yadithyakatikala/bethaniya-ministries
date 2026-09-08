import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../useTheme';

/** Vespers surface card -- 16px radius, 1px border, no shadow (borders first). */
export function Card({ style, ...props }: ViewProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radii.card,
          padding: spacing.lg,
        },
        style,
      ]}
      {...props}
    />
  );
}
