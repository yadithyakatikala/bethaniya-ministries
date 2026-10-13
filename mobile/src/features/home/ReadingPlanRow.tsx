import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../theme/ui/Icon';
import { GoldFill } from '../../theme/ui/GoldLine';
import { Tappable } from '../../theme/ui/Tappable';
import { useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import type { ActivePlanSummary, PublishedPlan } from '../../services/firebase/plans';

/**
 * The reading plan, as a row under a hairline -- and the ONLY place on Home
 * that shows a percentage or a progress line.
 *
 * Reads the EXISTING plan state: `subscribeToMostRecentPlanProgress`
 * already returns the member's active plan together with its
 * `PlanProgress` (startedAt, currentDay, completedDays, lastReadAt) -- see
 * ../../services/firebase/plans.ts. Nothing here stores or derives a second
 * copy of that progress, and nothing is persisted from this screen.
 *
 * Progress is computed from `completedDays.length / plan.dayCount`, not
 * from `currentDay`: a member can complete days out of order, and "8 of 30
 * days done" is the honest number. `currentDay` is what Continue opens,
 * which is a different question.
 *
 * The line is 3 points high, its filled part the brand's gold (a thin gold
 * line, not a fill). The whole row is ONE button -- "Continue" is its
 * word, not a second control.
 *
 * With no active plan it is a single line that opens the Plans list. It
 * never shows a zeroed-out bar or an invented percentage.
 */
export function ReadingPlanRow({
  activePlan,
  onContinue,
  onBrowse,
  style,
}: {
  activePlan: ActivePlanSummary | null;
  onContinue: (plan: PublishedPlan, dayNumber: number) => void;
  onBrowse: () => void;
  /** The row's own outer style -- its margin above. */
  style?: object;
}) {
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();

  if (!activePlan) {
    return (
      <Tappable
        testID="home-plan-empty"
        accessibilityRole="button"
        accessibilityLabel={t('home.startAPlan')}
        onPress={onBrowse}
        style={[
          styles.row,
          styles.empty,
          { borderColor: colors.border, minHeight: layout.rowOneLine },
          style,
        ]}
      >
        <Text style={[type.button, styles.emptyLabel, { color: colors.accent }]}>
          {t('home.startAPlan')}
        </Text>
        <Icon name="chev" size={20} color={colors.inkMuted} />
      </Tappable>
    );
  }

  const { plan, progress } = activePlan;
  const total = Math.max(1, plan.dayCount);
  const done = progress.completedDays.length;
  // Clamped: a plan whose dayCount was edited down after a member
  // completed days should not render a bar wider than the track.
  const fraction = Math.min(1, Math.max(0, done / total));
  const percent = Math.round(fraction * 100);

  return (
    <Tappable
      testID="home-active-plan"
      accessibilityRole="button"
      accessibilityLabel={`${plan.title}. ${t('home.dayOf', {
        current: progress.currentDay,
        total: plan.dayCount,
      })}. ${percent}%`}
      onPress={() => onContinue(plan, progress.currentDay)}
      style={[styles.row, { borderColor: colors.border }, style]}
    >
      <View style={styles.headline}>
        <View style={styles.titleColumn}>
          <Text style={[type.overline, { color: colors.inkMuted }]}>
            {t('home.readingPlan')}
          </Text>
          <Text
            style={[
              type.bodyLarge,
              styles.title,
              { color: colors.ink, fontFamily: fontFamilies.interfaceSemiBold },
            ]}
            numberOfLines={2}
          >
            {plan.title}
          </Text>
        </View>
        <Text style={[type.label, { color: colors.accent }]}>{t('plans.continue')}</Text>
      </View>

      <View
        testID="home-plan-progress-track"
        style={[styles.track, { backgroundColor: colors.border }]}
      >
        <View
          testID="home-plan-progress-fill"
          style={[styles.fill, { width: `${percent}%` }]}
        >
          <GoldFill />
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={[type.caption, { color: colors.inkMuted }]}>
          {t('home.dayOf', { current: progress.currentDay, total: plan.dayCount })}
        </Text>
        <Text
          testID="home-plan-percent"
          style={[type.caption, { color: colors.inkMuted }]}
        >
          {t('home.percentComplete', { percent })}
        </Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, paddingTop: 16, paddingBottom: 4 },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 0,
  },
  emptyLabel: { flex: 1 },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleColumn: { flex: 1, minWidth: 0, gap: 2 },
  title: { lineHeight: 24 },
  track: { height: 3, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, overflow: 'hidden' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
});
