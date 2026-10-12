import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, ErrorState, Sheet, TextField, useTheme } from '../../theme';
import { SegmentedChoice } from '../../theme/ui/SegmentedChoice';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASONS,
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from '../../services/firebase/reports';
import type { StringKey } from '../../i18n/strings';

/**
 * The one report dialogue, used by every surface that can be reported --
 * M7.
 *
 * ONE COMPONENT, NOT THREE. A media post, a comment, a chat message and a
 * prayer request are reported in exactly the same way and for exactly the
 * same reasons; three copies of this would be three places for the reason
 * list to drift apart, and the reason list is the thing an administrator
 * has to triage by.
 *
 * =====================================================================
 * WHAT IT DOES NOT CARRY
 * =====================================================================
 * The report names the CONTENT, never its author -- `targetType` and
 * `targetId`, and nothing else about who wrote the thing. That is not
 * squeamishness, it is what makes reporting an anonymous prayer request
 * safe: the device has no author to name (see
 * ../../services/firebase/prayerRequests.ts), so reporting somebody
 * cannot de-anonymise them, and an administrator resolving the report
 * never learns who they were either.
 *
 * The reporter's own uid IS recorded, on the report, where only an
 * administrator can read it. A report nobody can be held to is a report
 * that can be used to harass somebody by volume.
 *
 * =====================================================================
 * NO REASON IS ASSUMED
 * =====================================================================
 * It used to open with "Spam or advertising" already chosen, so a member
 * who tapped "Send report" without reading it reported a testimony as an
 * advertisement. Now the seven reasons are a wrap of chips with none
 * chosen, and "Send report" is disabled until one is: the reason is what
 * an administrator triages by, so it has to be the reporter's own choice.
 */
const REASON_LABEL_KEYS: Record<ReportReason, StringKey> = {
  spam: 'report.reason.spam',
  harassment: 'report.reason.harassment',
  hate: 'report.reason.hate',
  sexual: 'report.reason.sexual',
  violence: 'report.reason.violence',
  misinformation: 'report.reason.misinformation',
  other: 'report.reason.other',
};

export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetParentId = null,
  onReported,
  testID = 'report-sheet',
}: {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** The media post a reported comment belongs to. */
  targetParentId?: string | null;
  /** Called after a successful send, so the caller can mark it reported. */
  onReported: () => void;
  testID?: string;
}) {
  const { colors, spacing, type } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  // No reason is assumed: choosing one is the report, and "Send report" waits for it.
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!user || !reason) return;
    setSending(true);
    setFailed(false);
    try {
      await submitReport({
        reporterUid: user.uid,
        targetType,
        targetId,
        targetParentId,
        reason,
        details,
      });
      // The acknowledgement replaces the form rather than closing the
      // sheet from under the reporter: "did that work" is the question
      // somebody who has just reported a person actually has.
      setSent(true);
      onReported();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    // Reset, so reopening the sheet on something else does not show the
    // previous target's acknowledgement or its half-typed detail.
    setSent(false);
    setFailed(false);
    setDetails('');
    setReason(null);
    onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title={t('report.title')}
      closeLabel={t('common.close')}
      testID={testID}
    >
      {sent ? (
        <View style={{ gap: spacing.sm }} testID={`${testID}-sent`}>
          <Text style={[type.title, { color: colors.ink }]}>{t('report.submitted')}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {t('report.submittedMessage')}
          </Text>
          <AppButton
            title={t('common.done')}
            onPress={handleClose}
            testID={`${testID}-done`}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Text
            testID={`${testID}-intro`}
            style={[type.help, { color: colors.inkMuted }]}
          >
            {t('report.intro')}
          </Text>

          <View style={{ gap: spacing.xs }}>
            <Text style={[type.label, { color: colors.ink }]}>
              {t('report.reasonLabel')}
            </Text>
            <SegmentedChoice
              testID={`${testID}-reason`}
              accessibilityLabel={t('report.reasonLabel')}
              options={REPORT_REASONS.map((value) => ({
                value,
                label: t(REASON_LABEL_KEYS[value]),
              }))}
              selected={reason}
              onSelect={setReason}
            />
          </View>

          <TextField
            testID={`${testID}-details`}
            label={t('report.detailsLabel')}
            placeholder={t('report.detailsPlaceholder')}
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={MAX_REPORT_DETAILS_LENGTH}
            style={styles.details}
          />

          {failed ? (
            <ErrorState message={t('report.failed')} testID={`${testID}-error`} />
          ) : null}

          <AppButton
            title={t('report.submit')}
            onPress={() => void handleSubmit()}
            loading={sending}
            // Nothing is sent until a reason is chosen: the button says so by waiting.
            disabled={sending || !user || !reason}
            testID={`${testID}-submit`}
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  details: { minHeight: 88, textAlignVertical: 'top' },
});
