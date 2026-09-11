import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
import { EmptyState } from '../../theme/ui/EmptyState';
import { SectionHeader } from '../../theme/ui/SectionHeader';
import {
  createPrayer,
  deletePrayer,
  setPrayerAnswered,
  subscribeToPrayers,
  type Prayer,
} from '../../services/firebase/prayers';

const PRAYER_TEXT_MAX_LENGTH = 2000;

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Prayers -- a new V1 feature (per explicit owner decision; not part of
 * FINAL_ARCHITECTURE_SPECIFICATION.md's original scope -- see
 * PRODUCTION_READINESS.md). Fully private per-member: a simple prayer
 * journal (add a request, mark it answered, delete it) backed by
 * users/{uid}/prayers -- see services/firebase/prayers.ts and
 * firestore.rules for the isOwner(userId)-only authorization boundary.
 *
 * Reached from the More tab (see ../more/MoreScreen.tsx), not the bottom
 * tab bar -- the existing Home/Bible/Songs/Events/More navigation is kept
 * unchanged per explicit owner decision.
 */
export function PrayersScreen() {
  const { user } = useAuth();
  const { colors, radii, spacing } = useTheme();
  const uid = user?.uid ?? null;

  const [prayers, setPrayers] = useState<Prayer[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // No setState for the signed-out case -- this screen is only ever
    // reached post-authentication (see ../more/MoreScreen.tsx), so `uid`
    // is absent only transiently while auth state is still loading;
    // calling setState synchronously here would trip
    // react-hooks/set-state-in-effect (see ../bible/ChapterScreen.tsx's
    // doc comment for the same reasoning) for a case that never actually
    // renders.
    if (!uid) return;
    const unsubscribe = subscribeToPrayers(
      uid,
      (next) => {
        setPrayers(next);
        setHasError(false);
      },
      () => setHasError(true)
    );
    return unsubscribe;
  }, [uid]);

  async function handleAdd() {
    const text = draft.trim();
    if (!text || !uid) return;
    setSubmitting(true);
    try {
      await createPrayer(uid, text);
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleAnswered(prayer: Prayer) {
    if (!uid) return;
    setBusyId(prayer.id);
    try {
      await setPrayerAnswered(uid, prayer.id, !prayer.answered);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(prayer: Prayer) {
    if (!uid) return;
    setBusyId(prayer.id);
    try {
      await deletePrayer(uid, prayer.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="prayers-screen">
      <View style={[styles.composer, { padding: spacing.lg, gap: spacing.sm }]}>
        <SectionHeader title="New Prayer Request" />
        <TextInput
          testID="prayer-input"
          value={draft}
          onChangeText={setDraft}
          placeholder="What's on your heart?"
          placeholderTextColor={colors.secondaryText}
          multiline
          maxLength={PRAYER_TEXT_MAX_LENGTH}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.control,
              color: colors.text,
              padding: spacing.md,
            },
          ]}
        />
        <AppButton
          title="Add Prayer"
          onPress={() => void handleAdd()}
          disabled={!draft.trim() || submitting}
          loading={submitting}
          testID="prayer-submit"
        />
      </View>

      {hasError ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            title="Couldn't load prayers"
            message="Check your connection and try again."
            testID="prayers-error"
          />
        </View>
      ) : null}

      {!prayers && !hasError ? (
        <ActivityIndicator testID="prayers-loading" style={{ marginTop: spacing.xl }} />
      ) : null}

      {prayers && prayers.length === 0 && !hasError ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            title="No prayers yet"
            message="Add a prayer request above -- only you can see it."
            testID="prayers-empty"
          />
        </View>
      ) : null}

      {prayers && prayers.length > 0 ? (
        <FlatList
          testID="prayers-list"
          data={prayers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <View
              testID={`prayer-row-${item.id}`}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.card,
                  padding: spacing.md,
                  gap: spacing.xs,
                },
              ]}
            >
              <Text style={[styles.prayerText, { color: colors.text }]}>{item.text}</Text>
              <Text style={[styles.meta, { color: colors.secondaryText }]}>
                {formatDate(item.createdAt)}
                {item.answered ? ' • Answered' : ''}
              </Text>
              <View style={[styles.actions, { gap: spacing.md }]}>
                <Pressable
                  testID={`prayer-toggle-answered-${item.id}`}
                  accessibilityRole="button"
                  disabled={busyId === item.id}
                  onPress={() => void handleToggleAnswered(item)}
                >
                  <Text style={[styles.actionLabel, { color: colors.primary }]}>
                    {item.answered ? 'Mark unanswered' : 'Mark answered'}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`prayer-delete-${item.id}`}
                  accessibilityRole="button"
                  disabled={busyId === item.id}
                  onPress={() => void handleDelete(item)}
                >
                  <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  composer: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  input: { minHeight: 80, fontSize: 15, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth },
  row: { borderWidth: StyleSheet.hairlineWidth },
  prayerText: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 12.5 },
  actions: { flexDirection: 'row', marginTop: 4 },
  actionLabel: { fontSize: 13, fontWeight: '600' },
});
