import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  startPlan,
  subscribeToPlanDays,
  subscribeToPlanProgress,
  type PlanProgress,
  type PublishedPlanDay,
} from '../../services/firebase/plans';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanDetail'>;

/**
 * A single reading plan's overview -- cover, description, day list, and a
 * Start/Continue button. Receives the full plan object as a route param
 * (same reasoning as SongDetail/EventDetail's route params -- see
 * AppNavigator.tsx's doc comment).
 */
export function PlanDetailScreen({ route, navigation }: Props) {
  const { plan } = route.params;
  const { user } = useAuth();
  const { colors, radii, spacing } = useTheme();
  const uid = user?.uid ?? null;

  const [days, setDays] = useState<PublishedPlanDay[] | null>(null);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [starting, setStarting] = useState(false);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="plan-detail-screen">
      {plan.coverImageUrl ? (
        <Image
          source={{ uri: plan.coverImageUrl }}
          style={styles.cover}
          testID="plan-detail-cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.cover, { backgroundColor: colors.primaryTint }]} />
      )}

      <View style={[styles.body, { padding: spacing.lg, gap: spacing.sm }]}>
        <Text style={[styles.meta, { color: colors.secondaryText }]}>
          {plan.category} • {plan.dayCount} {plan.dayCount === 1 ? 'day' : 'days'}
        </Text>
        <Text style={[styles.title, { color: colors.text }]} testID="plan-detail-title">
          {plan.title}
        </Text>
        <Text style={[styles.description, { color: colors.text }]}>{plan.description}</Text>

        <AppButton
          title={progress ? `Continue • Day ${progress.currentDay}` : 'Start Plan'}
          onPress={() => void handleStartOrContinue()}
          loading={starting}
          disabled={!uid || days === null || days.length === 0}
          testID="plan-start-continue-button"
        />
      </View>

      {days === null ? (
        <ActivityIndicator testID="plan-days-loading" style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          testID="plan-days-list"
          data={days}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const completed = progress?.completedDays.includes(item.dayNumber) ?? false;
            return (
              <View
                testID={`plan-day-row-${item.id}`}
                style={[
                  styles.dayRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.card,
                    padding: spacing.md,
                  },
                ]}
              >
                <Text style={[styles.dayNumber, { color: colors.primary }]}>
                  Day {item.dayNumber}
                </Text>
                <Text style={[styles.dayTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.dayScripture, { color: colors.secondaryText }]}>
                  {item.scriptureReference}
                </Text>
                {completed ? (
                  <Text style={[styles.dayComplete, { color: colors.success }]}>Completed</Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  body: { gap: 6 },
  meta: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 22 },
  dayRow: { borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  dayNumber: { fontSize: 12, fontWeight: '700' },
  dayTitle: { fontSize: 15, fontWeight: '600' },
  dayScripture: { fontSize: 13 },
  dayComplete: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
