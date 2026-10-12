import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FloatingAction,
  Icon,
  SkeletonRows,
  Tappable,
  Toast,
  useTheme,
  useToast,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatDayMonthShort } from '../../i18n/locale';
import {
  createPrayer,
  deletePrayer,
  setPrayerAnswered,
  subscribeToPrayers,
  type Prayer,
} from '../../services/firebase/prayers';
import { NewJournalEntry } from './NewJournalEntry';

/**
 * My journal -- the second view of the Prayers tab, and a member's own,
 * private page: add a prayer, mark it answered, delete it. Backed by
 * users/{uid}/prayers -- see services/firebase/prayers.ts and
 * firestore.rules for the isOwner(userId)-only authorization boundary;
 * nothing here is ever shown to anyone else, and the screen says so ("Only
 * you can see this") under the tabs.
 *
 * (A new V1 feature, per explicit owner decision; not part of
 * FINAL_ARCHITECTURE_SPECIFICATION.md's original scope -- see
 * PRODUCTION_READINESS.md. It used to be its own screen reached from the More
 * tab; it is now a tab of Prayers beside the church's requests.)
 *
 * THE LAYOUT, as designed. One list whose header holds the hub's title and
 * tabs, the privacy line and the state (a skeleton while it loads, an error
 * with Try again, or "Nothing in your journal yet"); each entry is a hairline
 * row -- the words, the date, whether it was answered, and its two actions
 * as words. "New entry" floats over the list (the empty page has it too: it
 * is how the first entry is added) and opens a full-screen writing page,
 * ./NewJournalEntry.tsx. Adding says "Added to your journal" in a toast;
 * deleting asks first, in the app's own dialog.
 */
export function PrayersScreen({ header }: { header?: ReactNode }) {
  const { user } = useAuth();
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const toast = useToast();
  const uid = user?.uid ?? null;

  const [prayers, setPrayers] = useState<Prayer[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [writing, setWriting] = useState(false);
  const [deleting, setDeleting] = useState<Prayer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // No setState for the signed-out case -- this screen is only ever
    // reached post-authentication, so `uid` is absent only transiently while
    // auth state is still loading; calling setState synchronously here would
    // trip react-hooks/set-state-in-effect (see
    // ../bible/reader/ReaderScreen.tsx's doc comment for the same reasoning)
    // for a case that never actually renders.
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
  }, [uid, retryToken]);

  function retry() {
    setHasError(false);
    setPrayers(null);
    setRetryToken((token) => token + 1);
  }

  async function handleAdd(text: string) {
    if (!uid) throw new Error('not signed in');
    await createPrayer(uid, text);
    toast.show(t('prayers.addedToJournal'));
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

  const pad = { paddingHorizontal: layout.screenMargin };
  const loading = !prayers && !hasError;
  const empty = Boolean(prayers) && prayers!.length === 0 && !hasError;
  const rows = prayers ?? [];

  return (
    <View style={styles.screen} testID="prayers-screen">
      <FlatList
        testID="prayers-list"
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        // Taps on a row's action must register on the first press even if a
        // field elsewhere holds focus -- see ../auth/SignInScreen.tsx.
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {header ? <View style={pad}>{header}</View> : null}

            <View style={[pad, styles.private]} testID="prayers-private-line">
              <Icon name="lock" size={16} color={colors.inkMuted} />
              <Text style={[styles.privateText, { color: colors.inkMuted }]}>
                {t('prayers.private')}
              </Text>
            </View>

            <View style={[pad, styles.body]}>
              {loading ? (
                <SkeletonRows
                  count={3}
                  leading="none"
                  label={t('common.loading')}
                  testID="prayers-loading"
                />
              ) : null}
              {hasError ? (
                <ErrorState
                  testID="prayers-error"
                  title={t('prayers.loadError')}
                  message={t('prayers.loadErrorMessage')}
                  retryLabel={t('common.tryAgain')}
                  onRetry={retry}
                />
              ) : null}
              {empty ? (
                <EmptyState
                  testID="prayers-empty"
                  title={t('prayers.empty')}
                  message={t('prayers.emptyMessage')}
                />
              ) : null}
              {rows.length > 0 ? (
                <View style={[styles.rule, { borderTopColor: colors.border }]} />
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          const date = item.createdAt
            ? formatDayMonthShort(item.createdAt, appLanguage)
            : '';
          return (
            <View style={pad}>
              <View
                testID={`prayer-row-${item.id}`}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text
                  style={[
                    styles.text,
                    appLanguage === 'te' && styles.textTe,
                    { color: colors.ink },
                  ]}
                >
                  {item.text}
                </Text>
                <View style={styles.meta}>
                  {date ? (
                    <Text style={[type.caption, { color: colors.inkSubtle }]}>
                      {date}
                    </Text>
                  ) : null}
                  {item.answered ? (
                    <View style={styles.answered}>
                      <Icon name="check" size={14} color={colors.success} />
                      <Text style={[styles.answeredText, { color: colors.success }]}>
                        {t('prayers.answered')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  <Tappable
                    testID={`prayer-toggle-answered-${item.id}`}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void handleToggleAnswered(item)}
                    style={[styles.action, { opacity: busy ? 0.4 : 1 }]}
                  >
                    <Text style={[styles.actionText, { color: colors.accent }]}>
                      {item.answered
                        ? t('prayers.markUnanswered')
                        : t('prayers.markAnswered')}
                    </Text>
                  </Tappable>
                  <Tappable
                    testID={`prayer-delete-${item.id}`}
                    accessibilityRole="button"
                    // "Delete" alone tells a screen-reader user nothing about
                    // what is being deleted.
                    accessibilityLabel={t('prayers.deleteLabel')}
                    disabled={busy}
                    onPress={() => setDeleting(item)}
                    style={[styles.action, { opacity: busy ? 0.4 : 1 }]}
                  >
                    <Text style={[styles.actionText, { color: colors.danger }]}>
                      {t('common.delete')}
                    </Text>
                  </Tappable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {loading || hasError ? null : (
        <FloatingAction
          testID="prayers-new-entry"
          label={t('prayers.newEntry')}
          onPress={() => setWriting(true)}
        />
      )}

      <Toast message={toast.message} />

      <NewJournalEntry
        visible={writing}
        onClose={() => setWriting(false)}
        onAdd={handleAdd}
      />

      <ConfirmDialog
        visible={deleting !== null}
        testID="prayers-delete-dialog"
        title={t('prayers.deleteConfirmTitle')}
        message={t('prayers.deleteConfirmMessage')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.delete')}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const prayer = deleting;
          setDeleting(null);
          if (prayer) void handleDelete(prayer);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Room under the last entry for the floating button.
  list: { flexGrow: 1, paddingBottom: 96 },
  private: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  privateText: {
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
  },
  body: { marginTop: 6, gap: 12 },
  rule: { borderTopWidth: 1 },
  row: { paddingTop: 16, paddingBottom: 2, gap: 6, borderBottomWidth: 1 },
  text: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 16.5,
    lineHeight: 25,
  },
  textTe: { lineHeight: 30 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  answered: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  answeredText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 12.5,
    lineHeight: 17,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  // A bare 14px word is an ~18dp tap target. 44 is the smallest target both
  // Android and iOS accessibility guidance accept.
  action: { minHeight: 44, justifyContent: 'center' },
  actionText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
  },
});
