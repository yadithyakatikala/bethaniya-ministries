import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton, ErrorState, Sheet, TextField, useTheme } from '../../theme';
import { SegmentedChoice } from '../../theme/ui/SegmentedChoice';
import { useTranslation } from '../../i18n';
import {
  MAX_PRAYER_BODY_LENGTH,
  MAX_PRAYER_TITLE_LENGTH,
  PRAYER_CATEGORIES,
  type PrayerCategory,
  type PrayerRequest,
} from '../../services/firebase/prayerRequests';
import { CATEGORY_LABEL_KEYS } from './PrayerRequestCard';

/**
 * Writing or editing a prayer request -- M7.
 *
 * =====================================================================
 * THE ANONYMOUS SWITCH IS ONLY OFFERED ON A NEW REQUEST
 * =====================================================================
 * On an edit it is shown as a sentence, not a control, because the
 * decision cannot be changed: firestore.rules keeps `anonymous` out of
 * the author's update allowlist (see isValidPrayerRequest there). That is
 * not a technical limitation working its way into the UI -- it is the
 * point. By the time somebody edits their request, other people have
 * responded to it on the understanding that it was, or was not,
 * anonymous, and letting the author flip that afterwards would expose
 * them to exactly the audience they chose to hide from.
 *
 * Offering a disabled switch would say "you could change this if
 * something were different", which is not true. A sentence says what is
 * actually the case.
 */
export interface PrayerFormValues {
  title: string;
  body: string;
  category: PrayerCategory | null;
  anonymous: boolean;
}

const NO_CATEGORY = '__none__';

export function PrayerRequestForm({
  visible,
  onClose,
  onSubmit,
  editing = null,
  testID = 'prayer-form',
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: PrayerFormValues) => Promise<void>;
  /** The request being edited, or null when writing a new one. */
  editing?: PrayerRequest | null;
  testID?: string;
}) {
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();

  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [category, setCategory] = useState<PrayerCategory | null>(
    editing?.category ?? null
  );
  const [anonymous, setAnonymous] = useState(editing?.anonymous ?? false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    setTitleError(trimmedTitle.length === 0 ? t('prayerWall.titleRequired') : null);
    setBodyError(trimmedBody.length === 0 ? t('prayerWall.bodyRequired') : null);
    if (trimmedTitle.length === 0 || trimmedBody.length === 0) return;

    setSubmitting(true);
    setFailed(false);
    try {
      await onSubmit({ title: trimmedTitle, body: trimmedBody, category, anonymous });
      // Only cleared on success. A failed submit keeps every word the
      // member wrote -- losing a prayer request to a dropped connection
      // is the one outcome this form must not have.
      setTitle('');
      setBody('');
      setCategory(null);
      setAnonymous(false);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('prayerWall.editRequest') : t('prayerWall.newRequest')}
      closeLabel={t('common.close')}
      testID={testID}
    >
      <View style={{ gap: spacing.lg }}>
        <TextField
          testID={`${testID}-title`}
          label={t('prayerWall.titleLabel')}
          placeholder={t('prayerWall.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          error={titleError}
          maxLength={MAX_PRAYER_TITLE_LENGTH}
          required
        />

        <TextField
          testID={`${testID}-body`}
          label={t('prayerWall.bodyLabel')}
          placeholder={t('prayerWall.bodyPlaceholder')}
          value={body}
          onChangeText={setBody}
          error={bodyError}
          multiline
          maxLength={MAX_PRAYER_BODY_LENGTH}
          required
          style={styles.body}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={[type.label, { color: colors.ink }]}>
            {t('prayerWall.categoryLabel')}
          </Text>
          <SegmentedChoice
            testID={`${testID}-category`}
            accessibilityLabel={t('prayerWall.categoryLabel')}
            options={[
              { value: NO_CATEGORY, label: t('prayerWall.categoryNone') },
              ...PRAYER_CATEGORIES.map((value) => ({
                value,
                label: t(CATEGORY_LABEL_KEYS[value]),
              })),
            ]}
            selected={category ?? NO_CATEGORY}
            onSelect={(value) =>
              setCategory(value === NO_CATEGORY ? null : (value as PrayerCategory))
            }
          />
        </View>

        {editing ? (
          <Text
            style={[type.bodySmall, { color: colors.inkMuted }]}
            testID={`${testID}-anonymous-locked`}
          >
            {t('prayerWall.anonymousLocked')}
          </Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <View style={[styles.switchRow, { gap: spacing.md }]}>
              <Text style={[type.label, { color: colors.ink, flex: 1 }]}>
                {t('prayerWall.anonymousToggle')}
              </Text>
              <Switch
                testID={`${testID}-anonymous`}
                accessibilityLabel={t('prayerWall.anonymousToggle')}
                accessibilityHint={t('prayerWall.anonymousHelp')}
                value={anonymous}
                onValueChange={setAnonymous}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
              {t('prayerWall.anonymousHelp')}
            </Text>
          </View>
        )}

        {failed ? (
          <ErrorState message={t('prayerWall.submitFailed')} testID={`${testID}-error`} />
        ) : null}

        <AppButton
          title={editing ? t('common.save') : t('prayerWall.submit')}
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={submitting}
          testID={`${testID}-submit`}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { minHeight: 120, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
});
