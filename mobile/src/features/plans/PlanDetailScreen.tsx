import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import {
  AppButton,
  EmptyState,
  ErrorState,
  SkeletonRows,
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
import { BottomBar, DayStrip, PlanProgressLine, StepRow } from './PlanParts';
import {
  currentDayOf,
  firstSentence,
  isPlanCompleted,
  percentComplete,
  planIsEnglishInTeluguApp,
} from './planGroups';
import { planReadingFor } from './planReading';
import { parsePlanReference } from './planReference';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanDetail'>;

/**
 * A single reading plan's overview. Receives the full plan object as a route
 * param (same reasoning as SongDetail/EventDetail's route params -- see
 * AppNavigator.tsx's doc comment).
 *
 * THE LOOK. A top bar with Back and the plan's name; the church's cover, if it
 * attached one (and nothing if it did not -- no grey box); the category and
 * length, the title in the serif of its script (rule S5). Then one of two bodies,
 * and a bar fixed to the foot with the one way forward:
 *
 *   NOT STARTED   the plan's first sentence and all its days -- "Day 1 · Title",
 *                 the reading under it -- and **Start Plan**.
 *   STARTED       how far (a gold thread, "Day 2 of 7", "14%"), the days as a
 *                 strip of tiles (each opens its day), and today's three steps --
 *                 Read (opens the Bible at the passage), Reflect and Pray -- with
 *                 **Continue · Day 2**. A plan with every day done offers
 *                 "Choose another plan" instead.
 *
 * A failure to read the days is NOT an empty plan: it says it could not load, with
 * Try again (a read failure used to be rendered as "this plan has no days" -- a
 * plausible-looking untruth about the content).
 */
export function PlanDetailScreen({ route, navigation }: Props) {
  const { plan } = route.params;
  const { user } = useAuth();
  const { colors, layout, radii, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const uid = user?.uid ?? null;

  const [days, setDays] = useState<PublishedPlanDay[] | null>(null);
  const [daysFailed, setDaysFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [starting, setStarting] = useState(false);

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

  const finished = isPlanCompleted(plan, progress ?? undefined);
  const current = currentDayOf(plan, progress ?? undefined);
  const percent = percentComplete(plan, progress ?? undefined);
  const today = days?.find((day) => day.dayNumber === current) ?? null;
  const reading = today ? parsePlanReference(today.scriptureReference) : null;
  const dayCount = plan.dayCount || days?.length || 0;
  const length = `${plan.dayCount} ${t(plan.dayCount === 1 ? 'plans.day' : 'plans.days')}`;
  const kicker = [
    plan.category,
    length,
    planIsEnglishInTeluguApp(plan.title, appLanguage)
      ? t('settings.languageEnglish')
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  async function handleStartOrContinue() {
    if (!uid) return;
    const targetDay = progress?.currentDay ?? 1;
    if (!progress) {
      setStarting(true);
      try {
        await startPlan(uid, plan.id);
      } finally {
        setStarting(false);
      }
    }
    navigation.navigate('PlanDay', { plan, dayNumber: targetDay });
  }

  const cannotGo = !uid || daysFailed || days === null || days.length === 0;

  return (
    <View
      testID="plan-detail-screen"
      style={[styles.screen, { backgroundColor: colors.paper }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingHorizontal: layout.screenMargin,
          paddingBottom: insets.bottom + 140,
        }}
      >
        <TopBar title={plan.title} onBack={() => navigation.goBack()} />

        {plan.coverImageUrl ? (
          <Image
            testID="plan-detail-cover"
            source={{ uri: plan.coverImageUrl }}
            style={[
              styles.cover,
              { borderRadius: radii.card, backgroundColor: colors.surfaceRaised },
            ]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <Text style={[type.overline, styles.kicker, { color: colors.inkMuted }]}>
          {kicker}
        </Text>
        <Text
          accessibilityRole="header"
          testID="plan-detail-title"
          style={[
            contentTextStyle(plan.title, {
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
          {plan.title}
        </Text>

        {progress ? (
          <View style={styles.progress}>
            <PlanProgressLine
              testID="plan-detail-progress"
              left={t('home.dayOf', { current, total: dayCount })}
              right={t('home.percentComplete', { percent })}
              percent={percent}
            />
          </View>
        ) : plan.description ? (
          <Text
            testID="plan-detail-description"
            style={[
              type.body,
              styles.description,
              appLanguage === 'te' && styles.descriptionTe,
              { color: colors.inkMuted },
            ]}
          >
            {firstSentence(plan.description)}
          </Text>
        ) : null}

        {daysFailed ? (
          <View style={styles.state}>
            <ErrorState
              testID="plan-days-error"
              title={t('plans.loadError')}
              message={t('plans.loadErrorMessage')}
              retryLabel={t('common.tryAgain')}
              onRetry={() => {
                setDaysFailed(false);
                setDays(null);
                setRetryToken((token) => token + 1);
              }}
            />
          </View>
        ) : days === null ? (
          <View style={styles.state}>
            <SkeletonRows
              count={3}
              leading="none"
              label={t('common.loading')}
              testID="plan-days-loading"
            />
          </View>
        ) : days.length === 0 ? (
          <View style={styles.state}>
            <EmptyState
              testID="plan-days-empty"
              title={t('plans.noReadings')}
              message={t('plans.noReadingsMessage')}
            />
          </View>
        ) : progress ? (
          <>
            <View style={styles.strip}>
              <DayStrip
                total={dayCount}
                current={current}
                completed={progress.completedDays}
                onOpenDay={(dayNumber) =>
                  navigation.navigate('PlanDay', { plan, dayNumber })
                }
              />
            </View>
            {today ? (
              <View style={styles.section} testID="plan-today">
                <Text
                  accessibilityRole="header"
                  style={[type.overline, styles.sectionLabel, { color: colors.inkMuted }]}
                >
                  {`${t('plans.dayWord')} ${today.dayNumber} · ${today.title}`}
                </Text>
                <View style={[styles.steps, { borderTopColor: colors.border }]}>
                  <StepRow
                    testID="plan-step-read"
                    icon="bible"
                    title={`${t('plans.read')} · ${today.scriptureReference}`}
                    detail={t('plans.openInBible')}
                    onPress={
                      reading
                        ? () =>
                            navigation.navigate('BibleChapter', {
                              bookId: reading.bookId,
                              chapterNumber: reading.chapterNumber,
                              verse: reading.verse,
                              // So the reader can show this plan's chip, and mark the day.
                              fromPlan: planReadingFor(plan, current),
                            })
                        : undefined
                    }
                  />
                  <StepRow
                    testID="plan-step-reflect"
                    icon="note"
                    title={t('plans.reflect')}
                    detail={today.title}
                    onPress={() =>
                      navigation.navigate('PlanDay', { plan, dayNumber: today.dayNumber })
                    }
                  />
                  {today.prayerPrompt ? (
                    <StepRow
                      testID="plan-step-pray"
                      icon="prayer"
                      title={t('plans.pray')}
                      detail={today.prayerPrompt}
                      onPress={() =>
                        navigation.navigate('PlanDay', {
                          plan,
                          dayNumber: today.dayNumber,
                        })
                      }
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.section}>
            <Text
              accessibilityRole="header"
              style={[type.overline, styles.sectionLabel, { color: colors.inkMuted }]}
            >
              {`${t('plans.dayWord')} 1–${dayCount}`}
            </Text>
            <View
              testID="plan-days-list"
              style={{ borderTopWidth: 1, borderTopColor: colors.border }}
            >
              {days.map((day) => (
                <View
                  key={day.id}
                  testID={`plan-day-row-${day.id}`}
                  style={[styles.dayRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.dayTitle, { color: colors.ink }]}>
                    {`${t('plans.dayWord')} ${day.dayNumber} · ${day.title}`}
                  </Text>
                  <Text style={[styles.dayRef, { color: colors.inkMuted }]}>
                    {day.scriptureReference}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <BottomBar testID="plan-detail-bar">
        {finished ? (
          <AppButton
            testID="plan-choose-another"
            title={t('plans.chooseAnother')}
            variant="secondary"
            fullWidth
            onPress={() => navigation.navigate('BibleBooks', { tab: 'plans' })}
          />
        ) : (
          <AppButton
            testID="plan-start-continue-button"
            title={
              progress
                ? `${t('plans.continue')} · ${t('plans.dayWord')} ${current}`
                : t('plans.start')
            }
            fullWidth
            loading={starting}
            disabled={cannotGo}
            onPress={() => void handleStartOrContinue()}
          />
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cover: { width: '100%', aspectRatio: 16 / 9, marginTop: 4 },
  kicker: { marginTop: 20 },
  title: { marginTop: 4 },
  description: { marginTop: 8 },
  descriptionTe: { lineHeight: 28 },
  progress: { marginTop: 14 },
  strip: { marginTop: 20 },
  state: { marginTop: 24 },
  section: { marginTop: 24 },
  sectionLabel: { marginBottom: 12 },
  steps: { borderTopWidth: 1 },
  dayRow: { paddingVertical: 12, gap: 2, borderBottomWidth: 1 },
  dayTitle: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
  },
  dayRef: { fontFamily: fontFamilies.interfaceRegular, fontSize: 13.5, lineHeight: 19 },
});
