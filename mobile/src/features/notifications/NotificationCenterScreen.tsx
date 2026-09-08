import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getNavigationTargetFromData } from './notificationNavigation';
import {
  getNotificationHistory,
  markNotificationRead,
  type NotificationHistoryEntry,
} from './notificationHistory';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/**
 * Notification Center -- Day 10 decision 10. Reads only local history
 * (see ./notificationHistory.ts's doc comment for why this never touches
 * Firestore's notifications_log) and handles an empty history gracefully
 * with a dedicated empty state, per the decision's explicit requirement.
 *
 * Tapping an entry with a recognized, param-free `data.screen` payload
 * navigates there (decision 10's "relevant navigation payload if
 * available"); a `BibleChapter` payload with a valid bookId/chapterNumber
 * is special-cased since that's the one params-carrying route a
 * notification could plausibly point at (e.g. "new content in Genesis
 * 3"). Anything else in `data` is inert -- there's no way to test real
 * end-to-end delivery in this environment (see
 * ../../services/notifications/notificationService.ts), so this screen
 * is built to render whatever history exists correctly, not to assume a
 * specific payload shape ever actually arrives via real FCM.
 *
 * Read/unread (approved as the audit's "smallest honest fix"): tapping
 * ANY entry marks it read via markNotificationRead() -- see
 * ./notificationHistory.ts -- whether or not it also navigates
 * somewhere. Local state updates optimistically so the unread dot
 * disappears immediately, without waiting on a re-fetch. This is local
 * device state only; it never touches Firestore's notifications_log.
 */
export function NotificationCenterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, radii, spacing } = useTheme();
  const [history, setHistory] = useState<NotificationHistoryEntry[] | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    void getNotificationHistory().then((entries) => {
      if (!cancelled) setHistory(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handlePress(entry: NotificationHistoryEntry) {
    if (!entry.readAt) {
      const readAt = new Date().toISOString();
      setHistory((current) =>
        current?.map((item) => (item.id === entry.id ? { ...item, readAt } : item))
      );
      void markNotificationRead(entry.id);
    }
    const target = getNavigationTargetFromData(entry.data);
    if (!target) return;
    if (target.screen === 'BibleChapter') {
      navigation.navigate('BibleChapter', target.params);
    } else {
      navigation.navigate(target.screen as never);
    }
  }

  if (history === undefined) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
        testID="notification-center-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
        testID="notification-center-empty"
      >
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          You have no notifications yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="notification-center-list"
    >
      {history.map((entry) => {
        const isUnread = !entry.readAt;
        return (
          <TouchableOpacity
            key={entry.id}
            style={[
              styles.item,
              {
                backgroundColor: isUnread ? colors.primaryTint : colors.surface,
                borderColor: colors.border,
                borderRadius: radii.card,
                padding: spacing.md,
              },
            ]}
            testID={`notification-item-${entry.id}`}
            onPress={() => handlePress(entry)}
          >
            <View style={styles.titleRow}>
              {isUnread ? (
                <View
                  style={[styles.unreadDot, { backgroundColor: colors.accent }]}
                  testID={`notification-unread-dot-${entry.id}`}
                />
              ) : null}
              <Text
                style={[
                  styles.title,
                  { color: colors.text },
                  isUnread ? styles.titleUnread : null,
                ]}
              >
                {entry.title}
              </Text>
            </View>
            <Text style={[styles.body, { color: colors.secondaryText }]}>
              {entry.message}
            </Text>
            <Text style={[styles.timestamp, { color: colors.secondaryText }]}>
              {formatTimestamp(entry.receivedAt)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center' },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 15, fontWeight: '600' },
  titleUnread: { fontWeight: '700' },
  body: { fontSize: 14 },
  timestamp: { fontSize: 12 },
});
