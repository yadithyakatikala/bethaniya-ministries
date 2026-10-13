import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  EmptyState,
  ErrorState,
  Icon,
  SkeletonRows,
  Tappable,
  scriptOf,
  useTheme,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { formatNotificationWhen } from '../../i18n/locale';
import type { BibleLanguage } from '../bible/types';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { TopBar } from '../common/TopBar';
import { getNavigationTargetFromData } from './notificationNavigation';
import {
  getNotificationHistory,
  markNotificationRead,
  type NotificationHistoryEntry,
} from './notificationHistory';

/** "Today, 10:31 AM" -- or the stored text itself if it is not a date. */
function formatTimestamp(
  iso: string,
  appLanguage: BibleLanguage,
  labels: { today: string; yesterday: string }
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatNotificationWhen(date, appLanguage, labels);
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
 *
 * THE LOOK. A top bar with Back, then one hairline row per notification: a
 * small ink dot at the left for an unread one (blank space for a read one, so
 * the titles line up), the title (500 16/22, bold while unread), the message
 * (14.5/21, muted), and when it came ("Today, 10:31 AM"), with a chevron only
 * where tapping goes somewhere. The dot is not the only sign: the title is
 * bolder, and the row's spoken name begins "New." -- kept in the row's label
 * rather than in the title's text, so the title stays exactly what the church
 * sent.
 */
export function NotificationCenterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, layout } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<NotificationHistoryEntry[] | undefined>(
    undefined
  );
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by the retry button to re-run the effect below. A counter,
  // rather than calling the loader directly, because the effect must not
  // call setState synchronously in its body (react-hooks/set-state-in-effect).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getNotificationHistory()
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      // Without this catch, a rejected read (a corrupt or unavailable
      // AsyncStorage) left `history` at undefined forever -- the screen
      // spun on its loading state with no way out and no explanation.
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('[notifications] could not read the local history:', error);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const retryLoad = useCallback(() => {
    setHistory(undefined);
    setLoadFailed(false);
    setReloadToken((token) => token + 1);
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
    } else if (target.screen === 'You') {
      if (target.params) navigation.navigate('You', target.params);
      else navigation.navigate('You');
    } else {
      navigation.navigate(target.screen as never);
    }
  }

  const pad = { paddingHorizontal: layout.screenMargin };
  const labels = {
    today: t('notifications.today'),
    yesterday: t('notifications.yesterday'),
  };

  const bar = (
    <View style={pad}>
      <TopBar title={t('notifications.title')} onBack={() => navigation.goBack()} />
    </View>
  );

  if (loadFailed) {
    return (
      <View
        style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
      >
        {bar}
        <View style={[pad, styles.state]}>
          <ErrorState
            testID="notification-center-error"
            message={t('notifications.readError')}
            retryLabel={t('common.tryAgain')}
            onRetry={retryLoad}
          />
        </View>
      </View>
    );
  }

  if (history === undefined) {
    return (
      <View
        style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
      >
        {bar}
        <View style={[pad, styles.state]}>
          <SkeletonRows
            count={3}
            leading="none"
            label={t('common.loading')}
            testID="notification-center-loading"
          />
        </View>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View
        style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
      >
        {bar}
        <View style={[pad, styles.state]}>
          <EmptyState
            testID="notification-center-empty"
            title={t('notifications.empty')}
            message={t('notifications.emptyMessage')}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}
    >
      {bar}
      <ScrollView
        testID="notification-center-list"
        style={styles.state}
        contentContainerStyle={[pad, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={[styles.rule, { borderTopColor: colors.border }]} />
        {history.map((entry) => {
          const isUnread = !entry.readAt;
          const when = formatTimestamp(entry.receivedAt, appLanguage, labels);
          const goes = getNavigationTargetFromData(entry.data) !== null;
          const telugu = (text: string) =>
            appLanguage === 'te' || ['telugu', 'mixed'].includes(scriptOf(text));
          return (
            <Tappable
              key={entry.id}
              testID={`notification-item-${entry.id}`}
              accessibilityRole="button"
              accessibilityLabel={[
                isUnread ? `${t('notifications.new')}.` : '',
                entry.title,
                entry.message,
                when,
              ]
                .filter(Boolean)
                .join(' ')}
              onPress={() => handlePress(entry)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <View
                testID={isUnread ? `notification-unread-dot-${entry.id}` : undefined}
                style={[
                  styles.dot,
                  { backgroundColor: isUnread ? colors.ink : 'transparent' },
                ]}
              />
              <View style={styles.text}>
                <Text
                  style={[
                    styles.title,
                    telugu(entry.title) && styles.titleTe,
                    isUnread ? styles.titleUnread : styles.titleRead,
                    { color: colors.ink },
                  ]}
                >
                  {entry.title}
                </Text>
                <Text
                  style={[
                    styles.message,
                    telugu(entry.message) && styles.messageTe,
                    { color: colors.inkMuted },
                  ]}
                >
                  {entry.message}
                </Text>
                <Text style={[styles.when, { color: colors.inkSubtle }]}>{when}</Text>
              </View>
              {goes ? (
                <Icon
                  testID={`notification-go-${entry.id}`}
                  name="chev"
                  size={20}
                  color={colors.inkSubtle}
                />
              ) : null}
            </Tappable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { marginTop: 8 },
  rule: { borderTopWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8, marginLeft: 4 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22 },
  titleTe: { lineHeight: 27 },
  titleRead: { fontFamily: fontFamilies.interfaceMedium, fontWeight: '500' },
  titleUnread: { fontFamily: fontFamilies.interfaceBold, fontWeight: '700' },
  message: {
    marginTop: 2,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 14.5,
    lineHeight: 21,
  },
  messageTe: { lineHeight: 26 },
  when: {
    marginTop: 6,
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
