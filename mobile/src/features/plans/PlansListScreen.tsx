import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  subscribeToPublishedPlans,
  type PublishedPlan,
} from '../../services/firebase/plans';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PlansList'>;

/**
 * Reading plan library -- a new V1 feature (per explicit owner decision;
 * not part of FINAL_ARCHITECTURE_SPECIFICATION.md's original scope -- see
 * PRODUCTION_READINESS.md). Same real-time-listener /
 * loading-error-empty-list shape as SongsListScreen.tsx. Reached from the
 * More tab (existing Home/Bible/Songs/Events/More bottom navigation is
 * kept unchanged per explicit owner decision) and from the Home
 * dashboard's Daily Plan card (see ../auth/HomeScreen.tsx).
 */
export function PlansListScreen({ navigation }: Props) {
  const { colors, radii, spacing } = useTheme();
  const [plans, setPlans] = useState<PublishedPlan[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPublishedPlans(
      (next) => {
        setPlans(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, []);

  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} testID="plans-error">
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Could not load reading plans.
        </Text>
      </View>
    );
  }

  if (!plans) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} testID="plans-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (plans.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} testID="plans-empty">
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          No reading plans yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="plans-list"
      data={plans}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.item,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.card,
              padding: spacing.md,
            },
          ]}
          testID={`plan-${item.id}`}
          onPress={() => navigation.navigate('PlanDetail', { plan: item })}
        >
          {item.coverImageUrl ? (
            <Image
              source={{ uri: item.coverImageUrl }}
              style={[styles.cover, { borderRadius: radii.control }]}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.coverPlaceholder,
                { backgroundColor: colors.primaryTint, borderRadius: radii.control },
              ]}
            />
          )}
          <View style={styles.textColumn}>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: colors.secondaryText }]}>
              {item.category} • {item.dayCount} {item.dayCount === 1 ? 'day' : 'days'}
            </Text>
            <Text style={[styles.description, { color: colors.secondaryText }]} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  message: { textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  item: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cover: { width: 56, height: 56 },
  coverPlaceholder: { width: 56, height: 56 },
  textColumn: { flex: 1, gap: 3 },
  title: { fontWeight: '600', fontSize: 15 },
  meta: { fontSize: 12, fontWeight: '500' },
  description: { fontSize: 13.5, lineHeight: 19 },
});
