import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { useTheme } from '../useTheme';

export type EmptyStateVariant = 'card' | 'inline' | 'screen';

/**
 * One shared empty-state voice -- a title, one calm sentence, and
 * optionally the action that would fill it.
 *
 * SAY WHAT IS MISSING, ONCE, IN THE APP'S OWN WORDS. Never fill the space
 * with invented content (no sample prayers, no placeholder posts): an
 * empty list says it is empty.
 *
 *   card    (default) a dashed hairline box, 24 padding -- a list that has
 *           nothing yet.
 *   inline  a section's own line, no box -- the Prophet Verse when there
 *           is none today.
 *   screen  the whole screen, centred, with a quiet mark above (`mark`,
 *           the brand fish) -- a destination that is empty.
 *
 * Title 20/26, message 13.5/20 in secondary ink, an optional secondary
 * button. M3 added the optional action, because "no prayers yet" with no
 * way to add one from that screen is a dead end.
 */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  variant = 'card',
  mark,
  testID,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: EmptyStateVariant;
  /** The quiet mark above a `screen` variant. */
  mark?: ReactNode;
  testID?: string;
}) {
  const { colors, radii, spacing, type } = useTheme();
  const boxed = variant === 'card';
  return (
    <View
      testID={testID}
      style={[
        styles.container,
        boxed && {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
          borderWidth: 1,
          borderStyle: 'dashed',
        },
        variant === 'screen' && styles.screen,
        { padding: variant === 'inline' ? spacing.sm : spacing.xl, gap: spacing.sm },
      ]}
    >
      {variant === 'screen' && mark ? <View style={styles.mark}>{mark}</View> : null}
      <Text style={[type.title, styles.centred, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.bodySmall, styles.message, { color: colors.inkMuted }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm }}>
          <AppButton title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  screen: { flex: 1, justifyContent: 'center' },
  mark: { marginBottom: 8, opacity: 0.9 },
  centred: { textAlign: 'center' },
  // Capped, not full-bleed: a centred sentence running the whole width of
  // a tablet is harder to read than the same sentence in three lines.
  message: { textAlign: 'center', maxWidth: 320 },
});
