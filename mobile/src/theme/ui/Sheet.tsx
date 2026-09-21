import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './IconButton';
import { CloseIcon } from './FeatureIcons';
import { useTheme } from '../useTheme';
import { sheetAnimation, useReducedMotion } from '../motion';

/**
 * A bottom sheet.
 *
 * WHY THIS IS A PRIMITIVE. M4's reader needs four of them -- verse
 * actions, the note editor, reading settings and the chapter picker --
 * and they must agree on the backdrop, the corner radius, the safe-area
 * padding at the bottom and the way they are dismissed. Four hand-rolled
 * Modals would have been four of each.
 *
 * DISMISSAL, THREE WAYS. The backdrop, the close button and the
 * hardware/gesture back (Modal's `onRequestClose`) all close it. A sheet
 * that can only be dismissed by a small button is a trap on Android.
 *
 * `closeLabel` is a required prop rather than looked up here: the theme
 * layer must not import the i18n module, which reaches the preferences
 * context and from there the navigator (see ../navigationRef.ts for the
 * cycle that caused). The caller already has `t`.
 *
 * SCROLLS BY DEFAULT, capped at most of the screen: the chapter picker
 * is 66 books long and a sheet that grows past the top of the display
 * takes its own controls with it.
 *
 * IT SLIDES UP, AND BACK DOWN -- and does neither when the phone's
 * "reduce motion" setting is on, in which case it simply appears. That
 * is the honest reading of "remove animations"; see ../motion.ts.
 */
export function Sheet({
  visible,
  onClose,
  title,
  closeLabel,
  children,
  testID,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Translated "Close" -- see this component's doc comment. */
  closeLabel: string;
  children: React.ReactNode;
  testID?: string;
  /** Set false when the content manages its own scrolling. */
  scroll?: boolean;
}) {
  const { colors, radii, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const body = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={sheetAnimation(reducedMotion)}
      onRequestClose={onClose}
      // Announces the sheet as a modal, so a screen reader does not read
      // the reader page underneath it.
      accessibilityViewIsModal
    >
      <View style={styles.backdrop} testID={testID}>
        <Pressable
          style={styles.backdropFill}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          testID={testID ? `${testID}-backdrop` : undefined}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              borderColor: colors.border,
              paddingHorizontal: spacing.screen,
              paddingTop: spacing.lg,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View style={[styles.header, { marginBottom: spacing.md }]}>
            <Text
              style={[type.title, styles.title, { color: colors.ink }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <IconButton
              accessibilityLabel={closeLabel}
              testID={testID ? `${testID}-close` : undefined}
              onPress={onClose}
            >
              <CloseIcon color={colors.inkMuted} />
            </IconButton>
          </View>
          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A scrim rather than a plain dim: the sheet has to read as being in
  // front of the page, and on the reader's near-black dark ground an
  // undimmed backdrop makes the two surfaces indistinguishable.
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdropFill: { flex: 1 },
  sheet: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: '82%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The title must wrap, not shove the close button off the row: Telugu
  // sheet titles run about twice the length of their English wording.
  title: { flex: 1 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
});
