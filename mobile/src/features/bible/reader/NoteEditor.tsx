import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sheet } from '../../../theme/ui/Sheet';
import { AppButton } from '../../../theme/ui/AppButton';
import { TextField } from '../../../theme/ui/TextField';
import { useTheme } from '../../../theme';
import { useTranslation } from '../../../i18n';

/** Matches firestore.rules' isValidVerseNote() cap, so the field cannot
 *  produce a document the rules will reject. */
export const MAX_NOTE_LENGTH = 5000;

/**
 * A private note on one verse.
 *
 * PRIVATE IS THE POINT. This writes `users/{uid}/verseNotes`, which no
 * other member and no admin can read (see firestore.rules). It is not a
 * comment, and nothing here is shared -- media comments are a later
 * milestone and will not reuse this.
 *
 * The draft is seeded from the saved note each time the sheet opens, so
 * editing an existing note starts from its text and cancelling leaves
 * the saved note untouched. An empty draft cannot be saved: an empty
 * note is a deletion, and the Delete button says so.
 */
export function NoteEditor({
  visible,
  onClose,
  reference,
  initialText,
  onSave,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  reference: string;
  initialText: string;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`${reference} — ${initialText ? t('bible.editNote') : t('bible.addNote')}`}
      closeLabel={t('common.close')}
      testID="note-editor"
      scroll={false}
    >
      {/* The draft lives in a child that is MOUNTED when the sheet opens
          and keyed by the verse, so it starts from the saved note without
          an effect reaching in to reset it -- and so a Firestore snapshot
          arriving mid-edit cannot overwrite what the member is typing. */}
      {visible ? (
        <NoteDraft
          key={reference}
          initialText={initialText}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Sheet>
  );
}

function NoteDraft({
  initialText,
  onSave,
  onDelete,
}: {
  initialText: string;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialText);
  const trimmed = draft.trim();

  return (
    <>
      <TextField
        label={t('bible.addNote')}
        testID="note-input"
        value={draft}
        onChangeText={setDraft}
        placeholder={t('bible.notePlaceholder')}
        multiline
        numberOfLines={5}
        maxLength={MAX_NOTE_LENGTH}
        style={styles.input}
      />
      {/* Save on its own row, Delete BELOW it rather than beside it.
          Visual QA put a solid destructive button a thumb's width from
          the primary one; losing a note to a mis-tap is not a mistake
          this sheet should make easy. */}
      <View style={{ gap: spacing.md }}>
        <AppButton
          title={t('common.save')}
          fullWidth
          testID="save-note-button"
          disabled={trimmed.length === 0}
          onPress={() => onSave(trimmed)}
        />
        {initialText ? (
          <AppButton
            title={t('bible.deleteNote')}
            variant="destructive"
            fullWidth
            testID="delete-note-button"
            onPress={onDelete}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Tall enough to write a thought in. A three-line box invites a
  // one-line note, which is not what a study note is for.
  input: { minHeight: 132 },
});
