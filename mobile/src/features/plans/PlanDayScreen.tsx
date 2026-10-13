import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import {
  AppButton,
  ErrorState,
  GoldBar,
  Icon,
  SkeletonRows,
  Tappable,
  contentTextStyle,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  startPlan,
  subscribeToPlanDays,
  subscribeToPlanProgress,
  type PlanProgress,
  type PublishedPlanDay,
} from '../../services/firebase/plans';
import { TopBar } from '../common/TopBar';
import { BottomBar, PlanProgressLine, StepRow } from './PlanParts';
import { percentComplete } from './planGroups';
import { markPlanDay, planReadingFor } from './planReading';
import { parsePlanReference } from './planReference';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanDay'>;

/**
 * One day of a reading plan.
 *
 * THE LOOK. A top bar with Back and "Day 2 of 7"; the reading's reference in gold
 * small text; the day's title in the serif of its script (rule S5); the **Read**
 * step -- a row that opens the Bible at the passage; **Reflect**, the devotional
 * in full (17/28); the **prayer prompt**, beside a thin gold line. A bar fixed to
 * the foot holds how far the member is (a gold thread, "Day 2 of 7", "14%") and
 * the one action: **Mark Complete** -- or **Start Plan** for a plan not started
 * yet, which only starts it. Once the day is done the button says Completed (a
 * tick, and it no longer presses) and a link offers "Next: day 3 · Title".
 * Marking the LAST day complete opens the Plan complete screen.
 *
 * A failure to read the days is not "this day could not be found": that blamed
 * the content for a connection problem and offered no way out. It says it could
 * not load, with Try again.
 */
export function PlanDayScreen({ route, navigation }: Props) {
  const { plan, dayNumber } = route.params;
  const { user } = useAuth();
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const uid = user?.uid ?? null;

  const [days, setDays] = useState<PublishedPlanDay[] | null>(null);
  const [daysFailed, setDaysFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPlanDays(
      plan.id,
      (next) => {
        setDays(next);
        setDaysFailed(false);
      },
      () => setDaysFailed(true)
    );
    return unsubscribe;
  }, [plan.id, retryToken]);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToPlanProgress(
      uid,
      plan.id,
      (next) => setProgress(next),
      () => setProgress(null)
    );
    return unsubscribe;
  }, [uid, plan.id]);

  const day = days?.find((d) => d.dayNumber === dayNumber) ?? null;
  const next = days?.find((d) => d.dayNumber === dayNumber + 1) ?? null;
  const completed = progress?.completedDays.includes(dayNumber) ?? false;
  const reading = day ? parsePlanReference(day.scriptureReference) : null;
  const percent = percentComplete(plan, progress ?? undefined);
  const total = plan.dayCount || days?.length || 0;

  /**
   * Marks this day complete. A plan not started has no progress document: the
   * button says "Start Plan" and only creates one (the member then marks the day).
   * Completing the last day not yet done finishes the plan.
   */
  async function handleMarkComplete() {
    if (!uid) return;
    setMarking(true);
    try {
      if (!progress) {
        await startPlan(uid, plan.id);
        return;
      }
      const { finished } = await markPlanDay({
        uid,
        planId: plan.id,
        dayNumber,
        dayCount: plan.dayCount,
        progress,
      });
      if (finished) navigation.replace('PlanDone', { plan });
    } finally {
      setMarking(false);
    }
  }

  const screen = (children: React.ReactNode) => (
    <View
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      <View style={{ paddingHorizontal: layout.screenMargin }}>
        <TopBar
          title={t('home.dayOf', { current: dayNumber, total })}
          onBack={() => navigation.goBack()}
        />
      </View>
      {children}
    </View>
  );

  if (daysFailed) {
    return screen(
      <View style={[styles.state, { paddingHorizontal: layout.screenMargin }]}>
        <ErrorState
          testID="plan-day-error"
          message={t('plans.dayLoadError')}
          retryLabel={t('common.tryAgain')}
          onRetry={() => {
            setDaysFailed(false);
            setDays(null);
            setRetryToken((token) => token + 1);
          }}
        />
      </View>
    );
  }

  if (days === null) {
    return screen(
      <View style={[styles.state, { paddingHorizontal: layout.screenMargin }]}>
        <SkeletonRows
          count={3}
          leading="none"
          label={t('common.loading')}
          testID="plan-day-loading"
        />
      </View>
    );
  }

  if (!day) {
    return screen(
      <View
        testID="plan-day-not-found"
        style={[styles.state, { paddingHorizontal: layout.screenMargin }]}
      >
        <Text style={[type.body, { color: colors.inkMuted }]}>
          {t('plans.dayNotFound')}
        </Text>
      </View>
    );
  }

  const paragraphs = day.devotional
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0);

  return screen(
    <View style={styles.screen} testID="plan-day-screen">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenMargin,
          paddingBottom: insets.bottom + 180,
        }}
      >
        <Text style={[type.overline, styles.reference, { color: colors.accent }]}>
          {day.scriptureReference}
        </Text>
        <Text
          accessibilityRole="header"
          testID="plan-day-title"
          style={[
            contentTextStyle(day.title, {
              size: 26,
              line: 32,
              teSize: 24,
              teLine: 40,
              weight: 'semiBold',
              fallback: appLanguage,
            }),
            styles.title,
            { color: colors.ink },
          ]}
        >
          {day.title}
        </Text>

        <View style={[styles.readStep, { borderTopColor: colors.border }]}>
          <StepRow
            testID="plan-day-read"
            icon="bible"
            title={`${t('plans.read')} · ${day.scriptureReference}`}
            detail={t('plans.openInBible')}
            onPress={
              reading
                ? () =>
                    navigation.navigate('BibleChapter', {
                      bookId: reading.bookId,
                      chapterNumber: reading.chapterNumber,
                      verse: reading.verse,
                      // So the reader can show this plan's chip, and mark the day.
                      fromPlan: planReadingFor(plan, dayNumber),
                    })
                : undefined
            }
          />
        </View>

        {paragraphs.length > 0 ? (
          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[type.overline, styles.sectionLabel, { color: colors.inkMuted }]}
            >
              {t('plans.reflect')}
            </Text>
            <View testID="plan-day-reflection" style={styles.paragraphs}>
              {paragraphs.map((paragraph, index) => (
                <Text
                  key={index}
                  style={[
                    contentTextStyle(paragraph, {
                      size: 17,
                      line: 28,
                      teSize: 17,
                      teLine: 32,
                      fallback: appLanguage,
                    }),
                    { color: colors.ink },
                  ]}
                >
                  {paragraph.trim()}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {day.prayerPrompt ? (
          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[type.overline, styles.sectionLabel, { color: colors.inkMuted }]}
            >
              {t('plans.prayerPrompt')}
            </Text>
            <View style={styles.quote} testID="plan-day-prayer">
              <GoldBar width={2} />
              <Text
                style={[
                  contentTextStyle(day.prayerPrompt, {
                    size: 17,
                    line: 26,
                    teSize: 17,
                    teLine: 31,
                    fallback: appLanguage,
                  }),
                  styles.quoteText,
                  { color: colors.ink },
                ]}
              >
                {day.prayerPrompt}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomBar testID="plan-day-bar">
        <PlanProgressLine
          testID="plan-day-progress"
          left={t('home.dayOf', { current: dayNumber, total })}
          right={t('home.percentComplete', { percent })}
          percent={percent}
        />
        {completed ? (
          <>
            <View
              testID="plan-day-mark-complete"
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={t('plans.completed')}
              style={[styles.done, { borderColor: colors.border }]}
            >
              <Icon name="check" size={20} color={colors.disabledInk} />
              <Text style={[type.button, { color: colors.disabledInk }]}>
                {t('plans.completed')}
              </Text>
            </View>
            {next ? (
              <Tappable
                testID="plan-day-next"
                accessibilityRole="link"
                onPress={() =>
                  navigation.replace('PlanDay', { plan, dayNumber: next.dayNumber })
                }
                style={styles.nextLink}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.nextText, { color: colors.accent }]}
                >
                  {`${t('plans.nextDay', { n: next.dayNumber })} · ${next.title}`}
                </Text>
              </Tappable>
            ) : null}
          </>
        ) : (
          <AppButton
            testID="plan-day-mark-complete"
            title={progress ? t('plans.markComplete') : t('plans.start')}
            fullWidth
            loading={marking}
            disabled={!uid}
            onPress={() => void handleMarkComplete()}
          />
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { marginTop: 8 },
  reference: { marginTop: 8 },
  title: { marginTop: 2 },
  readStep: { marginTop: 16, borderTopWidth: 1 },
  section: { marginTop: 24 },
  sectionLabel: { marginBottom: 12 },
  paragraphs: { gap: 14 },
  quote: { flexDirection: 'row', gap: 14 },
  quoteText: { flex: 1, minWidth: 0 },
  done: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  nextText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
