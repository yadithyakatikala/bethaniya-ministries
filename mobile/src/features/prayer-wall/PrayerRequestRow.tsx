import { StyleSheet, Text, View } from 'react-native';
import { Badge, GoldBar, Tappable, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatDayMonthShort } from '../../i18n/locale';
import type { StringKey } from '../../i18n/strings';
import type {
  PrayerCategory,
  PrayerRequest,
  PrayerRequestStatus,
} from '../../services/firebase/prayerRequests';

/**
 * One request on the wall: a hairline ROW, not a card -- M7, drawn in the
 * approved design.
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
 *
 * =====================================================================
 * THE LOOK
 * =====================================================================
 * Someone else's request reads: who and when on one line, the subject (17/24
 * semibold), the words (16/24), then the quiet badges -- Praying or
 * Answered, and the category, in neutral tints (a category is not a status)
 * -- with "Report" as a plain word at the right edge.
 *
 * YOUR OWN is marked by a thin gold thread down its left edge and "Your
 * request" in gold ink, and carries its three actions as words in gold ink --
 * Edit, Mark answered (or "Still praying"), Delete (in the error colour) --
 * each a full 44 high. Gold is the thread and the words, never a fill.
 *
 * The subject and the words are the member's own text but are set in the
 * interface face, as drawn: a prayer is spoken to, not read as a page.
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

export function PrayerRequestRow({
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
  const { colors, radii, type, minTouchTarget } = useTheme();
  const { t, appLanguage } = useTranslation();
  const telugu = appLanguage === 'te';

  const authorLabel = request.authorName ?? t('prayerWall.anonymousLabel');
  const dateLabel = request.createdAt
    ? formatDayMonthShort(request.createdAt, appLanguage)
    : '';

  if (request.removed) {
    return (
      <View
        testID={`prayer-request-${request.id}`}
        style={[
          styles.tombstone,
          { backgroundColor: colors.surfaceRaised, borderRadius: radii.control },
        ]}
      >
        <Text style={[styles.tombstoneText, { color: colors.inkMuted }]}>
          {t('prayerWall.removed')}
        </Text>
      </View>
    );
  }

  const answered = request.status === 'answered';

  return (
    <View
      testID={`prayer-request-${request.id}`}
      style={[
        styles.row,
        { borderBottomColor: colors.border },
        isOwn ? styles.own : styles.other,
      ]}
    >
      {isOwn ? (
        <View style={styles.thread} pointerEvents="none">
          <GoldBar width={2} />
        </View>
      ) : null}

      <View style={styles.meta}>
        <Text
          testID={`prayer-request-author-${request.id}`}
          style={[styles.author, { color: isOwn ? colors.accent : colors.ink }]}
        >
          {isOwn ? t('prayerWall.yours') : authorLabel}
        </Text>
        {dateLabel ? (
          <Text style={[type.caption, { color: colors.inkSubtle }]}>{dateLabel}</Text>
        ) : null}
      </View>

      <Text style={[styles.title, telugu && styles.titleTe, { color: colors.ink }]}>
        {request.title}
      </Text>
      <Text style={[styles.body, telugu && styles.bodyTe, { color: colors.ink }]}>
        {request.body}
      </Text>

      <View style={styles.badges}>
        <Badge
          label={t(STATUS_LABEL_KEYS[request.status])}
          variant={answered ? 'success' : 'neutral'}
          icon={answered ? 'check' : undefined}
          testID={`prayer-request-status-${request.id}`}
        />
        {request.category ? (
          <Badge label={t(CATEGORY_LABEL_KEYS[request.category])} variant="neutral" />
        ) : null}
        {isOwn ? null : (
          <Tappable
            testID={`prayer-request-report-${request.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: alreadyReported }}
            disabled={alreadyReported}
            onPress={onReport}
            style={[styles.report, { minHeight: minTouchTarget }]}
          >
            <Text
              style={[
                styles.reportText,
                { color: alreadyReported ? colors.disabledInk : colors.inkMuted },
              ]}
            >
              {alreadyReported ? t('report.alreadyReported') : t('report.action')}
            </Text>
          </Tappable>
        )}
      </View>

      {isOwn ? (
        <View style={styles.actions}>
          <Tappable
            testID={`prayer-request-edit-${request.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('prayerWall.edit')}
            onPress={onEdit}
            style={[styles.action, { minHeight: minTouchTarget }]}
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {t('prayerWall.edit')}
            </Text>
          </Tappable>
          <Tappable
            testID={`prayer-request-answered-${request.id}`}
            accessibilityRole="button"
            onPress={onToggleAnswered}
            style={[styles.action, { minHeight: minTouchTarget }]}
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {answered ? t('prayerWall.reopen') : t('prayerWall.markAnswered')}
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
            <Text style={[styles.actionText, { color: colors.danger }]}>
              {t('common.delete')}
            </Text>
          </Tappable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 16 above, 2 below (the actions bring their own 44), a hairline foot.
  row: { paddingTop: 16, gap: 6, borderBottomWidth: 1 },
  own: { paddingLeft: 16, paddingBottom: 2 },
  other: { paddingBottom: 6 },
  // The gold thread down your own request's left edge: 18 from the top, 14 from the foot.
  thread: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 14,
    width: 2,
    flexDirection: 'row',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  author: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  title: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 24,
  },
  titleTe: { lineHeight: 28 },
  body: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyTe: { lineHeight: 29 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  // A plain word at the right edge, whose 44-high target reaches past the badges' row.
  report: {
    marginLeft: 'auto',
    marginVertical: -10,
    paddingLeft: 14,
    justifyContent: 'center',
  },
  reportText: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 13.5,
    lineHeight: 18,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  action: { justifyContent: 'center' },
  actionText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
  },
  // A removed request: a quiet raised box, centred.
  tombstone: { marginVertical: 12, padding: 16, alignItems: 'center' },
  tombstoneText: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
});
