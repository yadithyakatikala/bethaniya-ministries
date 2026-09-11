import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  markDayComplete,
  subscribeToPlanDays,
  subscribeToPlanProgress,
  type PlanProgress,
  type PublishedPlanDay,
} from '../../services/firebase/plans';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanDay'>;

/**
 * A single day's reading -- scripture reference, devotional text, and an
 * optional prayer prompt, with a "Mark Complete" action that advances the
 * member's plan progress. Reached from PlanDetailScreen's day list or its
 * Start/Continue button.
 */
export function PlanDayScreen({ route }: Props) {
  const { plan, dayNumber } = route.params;
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const uid = user?.uid ?? null;

  const [days, setDays] = useState<PublishedPlanDay[] | null>(null);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPlanDays(
      plan.id,
      (next) => setDays(next),
      () => setDays([])
    );
    return unsubscribe;
  }, [plan.id]);

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
  const completed = progress?.completedDays.includes(dayNumber) ?? false;

  async function handleMarkComplete() {
    if (!uid || !progress) return;
    setMarking(true);
    try {
      await markDayComplete(uid, plan.id, dayNumber, progress.currentDay, progress.completedDays);
    } finally {
      setMarking(false);
    }
  }

  if (days === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]} testID="plan-day-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (!day) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]} testID="plan-day-not-found">
        <Text style={{ color: colors.secondaryText }}>This day could not be found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md }]}
      testID="plan-day-screen"
    >
      <Text style={[styles.scripture, { color: colors.primary }]}>{day.scriptureReference}</Text>
      <Text style={[styles.title, { color: colors.text }]} testID="plan-day-title">
        {day.title}
      </Text>
      <Text style={[styles.devotional, { color: colors.text }]}>{day.devotional}</Text>

      {day.prayerPrompt ? (
        <View
          style={[
            styles.promptCard,
            { backgroundColor: colors.primaryTint, padding: spacing.md, gap: spacing.xs },
          ]}
        >
          <Text style={[styles.promptLabel, { color: colors.primary }]}>Prayer Prompt</Text>
          <Text style={[styles.promptText, { color: colors.text }]}>{day.prayerPrompt}</Text>
        </View>
      ) : null}

      <AppButton
        title={completed ? 'Completed' : 'Mark Complete'}
        onPress={() => void handleMarkComplete()}
        loading={marking}
        disabled={!uid || !progress || completed}
        testID="plan-day-mark-complete"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1 },
  scripture: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: '700' },
  devotional: { fontSize: 16, lineHeight: 25 },
  promptCard: { borderRadius: 12 },
  promptLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  promptText: { fontSize: 15, lineHeight: 22 },
});
