import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { useTheme } from '../useTheme';

/**
 * The one error state: what went wrong, and a way out.
 *
 * Nine screens wrote their own as a centred `<Text>` in
 * `colors.text`, and six of those offered no retry at all -- the user's
 * only recovery was to leave the screen and come back. Where a retry did
 * exist it was a bare Pressable with a 13px label.
 *
 * SAY WHAT HAPPENED AND HOW TO FIX IT, WITHOUT BLAME. `title` is the
 * short bold first line ("We could not load this"); `message` is the
 * plain sentence under it. Either may stand alone. The wash is the error
 * tint with a 1 pt error border -- never colour alone: the words say so.
 *
 * The icon-free wording is deliberate: the app has no icon library, and
 * an error drawn as a coloured triangle would be communicating by colour
 * and shape alone. A sentence works in both languages and for a screen
 * reader, which is why `accessibilityLiveRegion` is set -- an error that
 * replaces a spinner should be announced, not silently swapped in.
 */
export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  testID,
}: {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  testID?: string;
}) {
  const { colors, radii, spacing, type } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          backgroundColor: colors.dangerTint,
          borderColor: colors.danger,
          borderRadius: radii.card,
          padding: spacing.xl,
          gap: spacing.md,
        },
      ]}
    >
      {title ? (
        <Text style={[type.button, styles.message, { color: colors.ink }]}>{title}</Text>
      ) : null}
      <Text style={[type.body, styles.message, { color: colors.ink }]}>{message}</Text>
      {retryLabel && onRetry ? (
        <AppButton title={retryLabel} variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', borderWidth: 1 },
  message: { textAlign: 'center' },
});
