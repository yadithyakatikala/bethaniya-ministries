import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { useTheme } from '../useTheme';

/** Past this many characters between them, two labels no longer fit side by side. */
const STACK_LABEL_LENGTH = 22;

/**
 * A dialog for one decision that cannot be undone, or one confirmation.
 *
 * A title (20/26), ONE sentence of body, then the buttons: Cancel first,
 * the action second. 22 radius, 24 padding, at most 320 wide, on the 45%
 * backdrop. When either label is long (Telugu's can be twice English's)
 * the buttons STACK with the action on top, so neither is ever clipped.
 *
 * It is a real modal: the backdrop and the platform's back gesture both
 * cancel it, a screen reader reads only the dialog, and the action is
 * the destructive red only when the step really is destructive (a delete,
 * not a log out).
 *
 * `cancelLabel` and `confirmLabel` are verbs from the app's own strings;
 * this theme component does not look them up (the theme layer must not
 * import i18n -- see Sheet).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
  testID,
}: {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  /** The action uses the error fill. Only for a confirmed delete. */
  destructive?: boolean;
  /** The action shows its spinner and neither button answers until it is done. */
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  testID?: string;
}) {
  const { colors, radii, type } = useTheme();
  const stacked = cancelLabel.length + confirmLabel.length > STACK_LABEL_LENGTH;

  const cancel = (
    <AppButton
      key="cancel"
      title={cancelLabel}
      variant="secondary"
      onPress={onCancel}
      disabled={loading}
      fullWidth={stacked}
      testID={testID ? `${testID}-cancel` : undefined}
    />
  );
  const confirm = (
    <AppButton
      key="confirm"
      title={confirmLabel}
      variant={destructive ? 'destructive' : 'primary'}
      onPress={onConfirm}
      loading={loading}
      fullWidth={stacked}
      testID={testID ? `${testID}-confirm` : undefined}
    />
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop} testID={testID}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={() => {
            if (!loading) onCancel();
          }}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <View
          accessibilityRole="alert"
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.sheet,
            },
          ]}
        >
          <Text style={[type.title, { color: colors.ink }]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{message}</Text>
          {/* Cancel first, the action second -- stacked, the action goes on top. */}
          <View style={stacked ? styles.stack : styles.row}>
            {stacked ? [confirm, cancel] : [cancel, confirm]}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 },
  stack: { gap: 8, marginTop: 12 },
});
