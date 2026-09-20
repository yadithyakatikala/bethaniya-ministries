import { StyleSheet, Text, View } from 'react-native';
import { Badge, Tappable, useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatShortDate } from '../../i18n/locale';
import type { StringKey } from '../../i18n/strings';
import type {
  PrayerCategory,
  PrayerRequest,
  PrayerRequestStatus,
} from '../../services/firebase/prayerRequests';

/**
 * One request on the wall -- M7.
 *
 * =====================================================================
 * THE AUTHOR LINE IS THE ONLY INTERESTING PART OF THIS FILE
 * =====================================================================
 * It renders `request.authorName` when there is one, and the translated
 * word "Anonymous" when there is not. It NEVER renders a uid, and it
 * cannot accidentally start to: the field does not exist on an anonymous
 * request (see ../../services/firebase/prayerRequests.ts), so there is
 * nothing on this object to leak, including into the accessibility label
 * -- which is built from the same two values and is checked by the tests
 * for exactly that reason.
 *
 * A REMOVED REQUEST IS A TOMBSTONE, NOT A GAP. An administrator removing
 * something a member was reading should not make the list silently
 * renumber under their thumb; the row stays, and says what happened.
 */
export const CATEGORY_LABEL_KEYS: Record<PrayerCategory, StringKey> = {
  healing: 'prayerWall.category.healing',
  family: 'prayerWall.category.family',
  guidance: 'prayerWall.category.guidance',
  thanksgiving: 'prayerWall.category.thanksgiving',
  provision: 'prayerWall.category.provision',
  other: 'prayerWall.category.other',
};

const STATUS_LABEL_KEYS: Record<PrayerRequestStatus, StringKey> = {
  open: 'prayerWall.status.open',
  answered: 'prayerWall.status.answered',
  closed: 'prayerWall.status.closed',
};

export function PrayerRequestCard({
  request,
  isOwn,
  alreadyReported,
  onEdit,
  onToggleAnswered,
  onDelete,
  onReport,
}: {
  request: PrayerRequest;
  isOwn: boolean;
  alreadyReported: boolean;
  onEdit: () => void;
  onToggleAnswered: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const { colors, radii, spacing, type, minTouchTarget } = useTheme();
  const { t, appLanguage } = useTranslation();

  const authorLabel = request.authorName ?? t('prayerWall.anonymousLabel');
  const dateLabel = request.createdAt ? formatShortDate(request.createdAt, appLanguage) : '';

  if (request.removed) {
    return (
      <View
        testID={`prayer-request-${request.id}`}
        style={[
          styles.card,
          styles.tombstone,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.card,
          },
        ]}
      >
        <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
          {t('prayerWall.removed')}
        </Text>
      </View>
    );
  }

  return (
    <View
      testID={`prayer-request-${request.id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.card,
          padding: spacing.card,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={[styles.metaRow, { gap: spacing.sm }]}>
        <Text
          testID={`prayer-request-author-${request.id}`}
          style={[type.label, { color: colors.ink }]}
        >
          {isOwn ? t('prayerWall.yours') : authorLabel}
        </Text>
        {dateLabel ? (
          <Text style={[type.caption, { color: colors.inkSubtle }]}>{dateLabel}</Text>
        ) : null}
      </View>

      <Text style={[type.title, { color: colors.ink }]}>{request.title}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{request.body}</Text>

      <View style={[styles.badgeRow, { gap: spacing.xs }]}>
        <Badge
          label={t(STATUS_LABEL_KEYS[request.status])}
          variant={request.status === 'answered' ? 'success' : 'neutral'}
          testID={`prayer-request-status-${request.id}`}
        />
        {request.category ? (
          <Badge label={t(CATEGORY_LABEL_KEYS[request.category])} variant="info" />
        ) : null}
      </View>

      <View style={[styles.actions, { gap: spacing.lg }]}>
        {isOwn ? (
          <>
            <Tappable
              testID={`prayer-request-edit-${request.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('prayerWall.edit')}
              onPress={onEdit}
              style={[styles.action, { minHeight: minTouchTarget }]}
            >
              <Text style={[type.label, { color: colors.primary }]}>
                {t('prayerWall.edit')}
              </Text>
            </Tappable>
            <Tappable
              testID={`prayer-request-answered-${request.id}`}
              accessibilityRole="button"
              onPress={onToggleAnswered}
              style={[styles.action, { minHeight: minTouchTarget }]}
            >
              <Text style={[type.label, { color: colors.primary }]}>
                {request.status === 'answered'
                  ? t('prayerWall.reopen')
                  : t('prayerWall.markAnswered')}
              </Text>
            </Tappable>
            <Tappable
              testID={`prayer-request-delete-${request.id}`}
              accessibilityRole="button"
              // "Delete" alone tells a screen-reader user nothing about
              // what is being deleted.
              accessibilityLabel={`${t('common.delete')}: ${request.title}`}
              onPress={onDelete}
              style={[styles.action, { minHeight: minTouchTarget }]}
            >
              <Text style={[type.label, { color: colors.danger }]}>
                {t('common.delete')}
              </Text>
            </Tappable>
          </>
        ) : (
          <Tappable
            testID={`prayer-request-report-${request.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: alreadyReported }}
            disabled={alreadyReported}
            onPress={onReport}
            style={[styles.action, { minHeight: minTouchTarget }]}
          >
            <Text
              style={[
                type.label,
                { color: alreadyReported ? colors.disabledInk : colors.inkMuted },
              ]}
            >
              {alreadyReported ? t('report.alreadyReported') : t('report.action')}
            </Text>
          </Tappable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  tombstone: { alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  action: { justifyContent: 'center' },
});
