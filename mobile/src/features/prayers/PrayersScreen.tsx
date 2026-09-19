import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { formatShortDate } from '../../i18n/locale';
import type { BibleLanguage } from '../bible/types';
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

function formatDate(date: Date | null, appLanguage: BibleLanguage): string {
  if (!date) return '';
  return formatShortDate(date, appLanguage);
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
  const { colors, radii, spacing, type } = useTheme();
  const { t, appLanguage } = useTranslation();
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
    // react-hooks/set-state-in-effect (see ../bible/reader/ReaderScreen.tsx's
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

  /**
   * Deleting a prayer is irreversible and there is no undo, so it asks
   * first. This is the app's only destructive action on user-authored
   * content; it uses the platform dialog rather than a bespoke sheet so it
   * looks and behaves like every other Android confirmation.
   */
  function confirmDelete(prayer: Prayer) {
    Alert.alert(t('prayers.deleteConfirmTitle'), t('prayers.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void handleDelete(prayer),
      },
    ]);
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="prayers-screen"
    >
      <View
        style={[
          styles.composer,
          { padding: spacing.lg, gap: spacing.sm, borderBottomColor: colors.border },
        ]}
      >
        <SectionHeader title={t('prayers.newRequest')} />
        <TextInput
          testID="prayer-input"
          value={draft}
          onChangeText={setDraft}
          placeholder={t('prayers.placeholder')}
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
          title={t('prayers.add')}
          onPress={() => void handleAdd()}
          disabled={!draft.trim() || submitting}
          loading={submitting}
          testID="prayer-submit"
        />
      </View>

      {hasError ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            title={t('prayers.loadError')}
            message={t('prayers.loadErrorMessage')}
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
            title={t('prayers.empty')}
            message={t('prayers.emptyMessage')}
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
          // The composer sits above the list and keeps focus, so without
          // this the first tap on a row action only dismisses the
          // keyboard -- see ../auth/SignInScreen.tsx.
          keyboardShouldPersistTaps="handled"
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
              <Text style={[type.body, { color: colors.text }]}>{item.text}</Text>
              <Text style={[type.caption, { color: colors.secondaryText }]}>
                {formatDate(item.createdAt, appLanguage)}
                {item.answered ? ` • ${t('prayers.answered')}` : ''}
              </Text>
              <View style={[styles.actions, { gap: spacing.md }]}>
                <Pressable
                  testID={`prayer-toggle-answered-${item.id}`}
                  accessibilityRole="button"
                  disabled={busyId === item.id}
                  onPress={() => void handleToggleAnswered(item)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { opacity: busyId === item.id ? 0.4 : pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[type.label, { color: colors.primary }]}>
                    {item.answered
                      ? t('prayers.markUnanswered')
                      : t('prayers.markAnswered')}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`prayer-delete-${item.id}`}
                  accessibilityRole="button"
                  // "Delete" alone tells a screen-reader user nothing about
                  // what is being deleted.
                  accessibilityLabel={t('prayers.deleteLabel')}
                  disabled={busyId === item.id}
                  onPress={() => confirmDelete(item)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { opacity: busyId === item.id ? 0.4 : pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[type.label, { color: colors.danger }]}>
                    {t('common.delete')}
                  </Text>
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
  // The divider colour comes from the theme at render time; it used to be
  // hardcoded 'transparent', which made the separator between the composer
  // and the list invisible on both palettes.
  composer: { borderBottomWidth: StyleSheet.hairlineWidth },
  input: {
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', alignItems: 'center' },
  // A bare 13px label is an ~18dp tap target. 44 is the smallest target
  // both Android and iOS accessibility guidance accept.
  actionButton: { minHeight: 44, justifyContent: 'center' },
});
