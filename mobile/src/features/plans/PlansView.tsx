import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  GoldFill,
  Icon,
  SkeletonRows,
  Tappable,
  scriptOf,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import {
  subscribeToAllPlanProgress,
  subscribeToPublishedPlans,
  type PlanProgress,
  type PublishedPlan,
} from '../../services/firebase/plans';
import {
  currentDayOf,
  firstSentence,
  groupPlans,
  percentComplete,
  planOtherLanguage,
  withStartedBundledPlans,
} from './planGroups';

type Chosen = 'my' | 'find' | 'completed';

/**
 * The Plans view of the Bible tab: the church's reading plans, sorted for this
 * member by three chips -- **My plans** (started, not finished: a gold thread
 * shows how far), **Find plans** (not started: a sentence says what each is),
 * **Completed** (a badge says so). A row opens the plan.
 *
 * A plan follows the app language. A plan the church has not yet written in the
 * member's language is still shown, in the language it has, and the row says which:
 * "· English" in a Telugu app, "· Telugu" in an English one (design decision Q6 a).
 * The church names a plan's language when it writes it; for a plan that does not
 * (the starter plans, older plans) a title with no Telugu in a Telugu app is English.
 *
 * A starter plan a member has already begun stays in their list even after the
 * church publishes plans of its own (which makes the starter plans stand aside for
 * everyone else) -- their place in it is theirs to keep.
 *
 * The library and the member's progress are two listeners, and the rows show as
 * soon as the library has arrived: with no progress yet every plan is simply "not
 * started". When the library cannot be read the service falls back to the plans
 * that ship with the app, so a member is shown those rather than an error -- the
 * error state is for a library that never arrived at all.
 *
 * `header` is the Bible tab's own title and tabs; they are the header of the list
 * so they scroll away with it and show in every state.
 */
export function PlansView({
  header,
  onOpenPlan,
}: {
  header?: ReactNode;
  onOpenPlan: (plan: PublishedPlan) => void;
}) {
  const { colors, layout } = useTheme();
  const { t, appLanguage } = useTranslation();
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const [plans, setPlans] = useState<PublishedPlan[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [progress, setProgress] = useState<Record<string, PlanProgress>>({});
  const [chosen, setChosen] = useState<Chosen>('my');

  useEffect(() => {
    return subscribeToPublishedPlans(
      (next) => {
        setPlans(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
  }, [retryToken]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToAllPlanProgress(uid, setProgress, () => setProgress({}));
  }, [uid]);

  // Nobody signed in has started nothing.
  const own = uid ? progress : NO_PROGRESS;
  const groups = useMemo(
    () => groupPlans(withStartedBundledPlans(plans ?? [], own), own),
    [plans, own]
  );
  const rows = groups[chosen];
  const pad = { paddingHorizontal: layout.screenMargin };

  const showError = hasError && plans === null;
  const loading = plans === null && !hasError;

  let state: ReactNode = null;
  if (showError) {
    state = (
      <ErrorState
        testID="plans-error"
        message={t('plans.loadErrorShort')}
        retryLabel={t('common.tryAgain')}
        onRetry={() => {
          setHasError(false);
          setPlans(null);
          setRetryToken((token) => token + 1);
        }}
      />
    );
  } else if (loading) {
    state = (
      <SkeletonRows
        count={4}
        leading="none"
        label={t('common.loading')}
        testID="plans-loading"
      />
    );
  } else if (plans && plans.length === 0) {
    state = (
      <EmptyState
        testID="plans-empty"
        title={t('plans.empty')}
        message={t('plans.emptyMessage')}
      />
    );
  } else if (rows.length === 0) {
    state =
      chosen === 'my' ? (
        <EmptyState
          testID="plans-none-started"
          title={t('home.startAPlan')}
          message={t('plans.beginWithPlan')}
          actionLabel={t('plans.findAPlan')}
          actionTestID="plans-find-a-plan"
          onAction={() => setChosen('find')}
        />
      ) : chosen === 'find' ? (
        <EmptyState
          testID="plans-none-to-find"
          title={t('plans.empty')}
          message={t('plans.emptyMessage')}
        />
      ) : (
        <EmptyState
          testID="plans-none-completed"
          title={t('plans.completed')}
          message={t('plans.beginWithPlan')}
        />
      );
  }

  return (
    <View style={styles.screen} testID="plans-view">
      <FlatList
        testID="plans-list"
        data={showError || loading ? [] : rows}
        keyExtractor={(plan) => plan.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {header ? <View style={pad}>{header}</View> : null}
            <View style={[pad, styles.chips]}>
              <Chip
                testID="plans-chip-my"
                label={t('plans.myPlans')}
                selected={chosen === 'my'}
                onPress={() => setChosen('my')}
              />
              <Chip
                testID="plans-chip-find"
                label={t('plans.findPlans')}
                selected={chosen === 'find'}
                onPress={() => setChosen('find')}
              />
              <Chip
                testID="plans-chip-completed"
                label={t('plans.completed')}
                selected={chosen === 'completed'}
                onPress={() => setChosen('completed')}
              />
            </View>
            {state ? <View style={[pad, styles.state]}>{state}</View> : null}
            {rows.length > 0 && !showError && !loading ? (
              <View style={[pad, styles.firstRule]}>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={pad}>
            <PlanRow
              plan={item}
              kind={chosen}
              progress={own[item.id]}
              appLanguage={appLanguage}
              onPress={() => onOpenPlan(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

const NO_PROGRESS: Record<string, PlanProgress> = {};

function PlanRow({
  plan,
  kind,
  progress,
  appLanguage,
  onPress,
}: {
  plan: PublishedPlan;
  kind: Chosen;
  progress: PlanProgress | undefined;
  appLanguage: 'en' | 'te';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const telugu = appLanguage === 'te';
  const percent = percentComplete(plan, progress);
  const day = currentDayOf(plan, progress);
  // A plan in the other language than the app's: say which.
  const otherLanguage = planOtherLanguage(plan, appLanguage);
  const needsRoom = telugu || ['telugu', 'mixed'].includes(scriptOf(plan.title));

  const days = `${plan.dayCount} ${t(plan.dayCount === 1 ? 'plans.day' : 'plans.days')}`;
  let meta =
    kind === 'my'
      ? `${t('home.dayOf', { current: day, total: plan.dayCount })} · ${t('home.percentComplete', { percent })}`
      : kind === 'completed'
        ? t('home.dayOf', { current: plan.dayCount, total: plan.dayCount })
        : [
            plan.category,
            days,
            plan.estimatedMinutes
              ? t('plans.minutesPerDay', { n: plan.estimatedMinutes })
              : '',
          ]
            .filter(Boolean)
            .join(' · ');
  if (otherLanguage) {
    meta += ` · ${t(otherLanguage === 'te' ? 'settings.languageTelugu' : 'settings.languageEnglish')}`;
  }

  // What a plan not yet started says about itself: the church's short line if it
  // wrote one, else the description's first sentence.
  const description =
    kind === 'find' ? plan.subtitle.trim() || firstSentence(plan.description) : '';

  return (
    <Tappable
      testID={`plan-${plan.id}`}
      accessibilityRole="button"
      accessibilityLabel={[plan.title, meta].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[
        styles.row,
        { borderBottomColor: colors.border, minHeight: plan.coverImageUrl ? 88 : 84 },
      ]}
    >
      {plan.coverImageUrl ? (
        <Image
          testID={`plan-${plan.id}-cover`}
          source={{ uri: plan.coverImageUrl }}
          style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.text}>
        <Text
          numberOfLines={2}
          style={[styles.title, needsRoom && styles.titleTe, { color: colors.ink }]}
        >
          {plan.title}
        </Text>
        <Text style={[styles.meta, telugu && styles.metaTe, { color: colors.inkMuted }]}>
          {meta}
        </Text>
        {kind === 'my' ? (
          <View
            testID={`plan-${plan.id}-thread`}
            style={[styles.thread, { backgroundColor: colors.border }]}
          >
            <View style={{ width: `${percent}%`, height: 3 }}>
              <GoldFill />
            </View>
          </View>
        ) : null}
        {description ? (
          <Text
            numberOfLines={2}
            style={[styles.meta, telugu && styles.metaTe, { color: colors.inkMuted }]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {kind === 'completed' ? (
        <Badge
          testID={`plan-${plan.id}-done`}
          variant="success"
          icon="check"
          label={t('plans.completed')}
        />
      ) : null}
      <Icon name="chev" size={20} color={colors.inkSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: 32 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  state: { marginTop: 16 },
  firstRule: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cover: { width: 56, height: 56, borderRadius: 12 },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 17,
    lineHeight: 24,
  },
  titleTe: { lineHeight: 29 },
  meta: { fontFamily: fontFamilies.interfaceRegular, fontSize: 13.5, lineHeight: 19 },
  metaTe: { lineHeight: 23 },
  thread: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
});
