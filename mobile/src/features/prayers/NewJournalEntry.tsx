import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, Icon, NoticeBanner, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { sheetAnimation, useReducedMotion } from '../../theme/motion';
import { useTranslation } from '../../i18n';
import { TopBar } from '../common/TopBar';

export const PRAYER_TEXT_MAX_LENGTH = 2000;

/**
 * A new journal entry: a full-screen writing page, as designed -- a Close at
 * the top, "Only you can see this", a large open space to write in, and one
 * "Add Prayer" button fixed at the foot, above the keyboard.
 *
 * It is a task rather than a place, so it says "Close" (not Back) and covers
 * the tab bar. The keyboard opens at once, since the only reason to be here
 * is to write; the button stays disabled while there is nothing to add.
 *
 * WHAT WAS TYPED IS NEVER LOST TO A FAILURE. `onAdd` rejecting keeps every
 * word and says so in a notice above the writing space; only a success
 * clears the page and closes it. (Closing with the Close button on purpose
 * does discard it: the member chose to leave.)
 *
 * The text is the member's own, set in the interface face at 18/28 (33 in
 * Telugu, whose marks need the room), with the platform's own cursor.
 */
export function NewJournalEntry({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  /** Saves the entry. Rejects if it could not be saved. */
  onAdd: (text: string) => Promise<void>;
}) {
  const { colors, layout } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onAdd(trimmed);
      setText('');
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setText('');
    setFailed(false);
    onClose();
  }

  const margin = layout.screenMargin;

  return (
    <Modal
      visible={visible}
      // It slides up like a sheet -- and just appears when the phone asks for no animations.
      animationType={sheetAnimation(reducedMotion)}
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        testID="prayer-entry-screen"
        style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ paddingHorizontal: margin }}>
          <TopBar
            variant="close"
            title={t('prayers.newEntry')}
            onBack={handleClose}
            testID="prayer-entry"
          />
          <View style={styles.private}>
            <Icon name="lock" size={16} color={colors.inkMuted} />
            <Text style={[styles.privateText, { color: colors.inkMuted }]}>
              {t('prayers.private')}
            </Text>
          </View>
          {failed ? (
            <View style={styles.notice}>
              <NoticeBanner
                tone="danger"
                testID="prayer-entry-error"
                message={t('media.actionFailed')}
              />
            </View>
          ) : null}
        </View>

        <TextInput
          testID="prayer-input"
          accessibilityLabel={t('prayers.newEntry')}
          value={text}
          onChangeText={setText}
          placeholder={t('prayers.placeholder')}
          placeholderTextColor={colors.inkSubtle}
          multiline
          autoFocus
          maxLength={PRAYER_TEXT_MAX_LENGTH}
          style={[
            styles.input,
            { color: colors.ink, paddingHorizontal: margin },
            appLanguage === 'te' && styles.inputTe,
          ]}
        />

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.paper,
              paddingHorizontal: margin,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <AppButton
            testID="prayer-submit"
            title={t('prayers.add')}
            onPress={() => void handleAdd()}
            disabled={!text.trim() || saving}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  private: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  privateText: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
  },
  notice: { marginTop: 12 },
  input: {
    flex: 1,
    marginTop: 8,
    paddingVertical: 4,
    textAlignVertical: 'top',
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 18,
    lineHeight: 28,
  },
  inputTe: { lineHeight: 33 },
  footer: { paddingTop: 12, borderTopWidth: 1 },
});
