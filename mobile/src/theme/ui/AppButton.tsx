import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import { useTheme } from '../useTheme';

export type AppButtonVariant = 'primary' | 'secondary' | 'destructive';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: AppButtonVariant;
  loading?: boolean;
}

/** Vespers button -- 48px min height, three variants, never smaller than the 44px touch minimum. */
export function AppButton({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  testID,
  ...props
}: AppButtonProps) {
  const { colors, radii } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'destructive'
        ? colors.danger
        : 'transparent';
  const borderColor = variant === 'secondary' ? colors.primary : 'transparent';
  const textColor = variant === 'secondary' ? colors.primary : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderRadius: radii.control,
          opacity: isDisabled ? 0.5 : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15.5,
    fontWeight: '600',
  },
});
