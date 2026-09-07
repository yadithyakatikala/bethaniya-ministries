/**
 * expo-notifications wiring -- Day 10 decision 11: "permission request,
 * notification configuration, foreground handling, background handling
 * where supported by current Expo architecture, notification response/
 * tap handling, navigation payload handling."
 *
 * IMPORTANT HONESTY NOTE (see also
 * ../../../functions/src/sendNotification.ts and BIBLE_LICENSING.md-style
 * disclosure elsewhere in this repo): nothing in this file has been
 * tested against a real, delivered push notification, and it cannot be
 * in this environment --
 *   - There is no live Firebase project (.firebaserc is absent -- see
 *     src/services/firebase/app.ts's own doc comment), so there is no
 *     real FCM sender identity to deliver through.
 *   - Cloud Functions (sendNotification) require the Blaze plan to
 *     *deploy* at all, which this repo deliberately never enables (₹0
 *     constraint).
 *   - expo-notifications' remote-push features additionally require a
 *     custom dev build (EAS), not Expo Go -- EAS itself is already
 *     flagged as deferred (Day 8's licensing/build notes).
 * What IS real and tested here (see __tests__/notificationService.test.ts):
 * the permission-request call, the handler configuration call, listener
 * registration/cleanup, and the receive/tap -> local-history-record and
 * -> navigation logic -- all exercised against Jest mocks of
 * expo-notifications' native module, per decision 11's "mock native
 * notification functionality in Jest as necessary."
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse } from 'expo-notifications';
import { navigationRef } from '../../navigation/AppNavigator';
import { addNotificationToHistory } from '../../features/notifications/notificationHistory';
import { getNavigationTargetFromData } from '../../features/notifications/notificationNavigation';

/**
 * Foreground behavior -- shows a banner/list entry and plays no sound.
 * Call once, e.g. from App.tsx at module scope or on first mount; safe
 * to call more than once (it just replaces the handler).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Returns whether the app is (now, or already was) allowed to display
 * notifications. Never throws -- a permission prompt the user dismisses,
 * or a platform that doesn't support prompting, both just resolve to
 * `false` rather than rejecting. */
export async function requestNotificationPermissionsAsync(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function extractPayload(notification: Notification): {
  title: string;
  message: string;
  data: Record<string, unknown> | null;
} {
  const { content } = notification.request;
  return {
    title: content.title ?? '',
    message: content.body ?? '',
    data: content.data ?? null,
  };
}

function navigateToTarget(data: Record<string, unknown> | null) {
  const target = getNavigationTargetFromData(data);
  if (!target || !navigationRef.isReady()) return;
  if (target.screen === 'BibleChapter') {
    navigationRef.navigate('BibleChapter', target.params);
  } else {
    navigationRef.navigate(target.screen as never);
  }
}

/**
 * Registers both expo-notifications listeners for the lifetime of the
 * calling component (intended to be mounted once, near the app root --
 * see App.tsx) and tears them down on unmount. A notification that
 * arrives in the foreground is recorded to local history as soon as it's
 * received (decision 10); the *same* notification's identifier is
 * tracked in `recordedIdsRef` so a subsequent tap on it doesn't record a
 * second, duplicate history entry -- only a *tapped* notification this
 * listener never saw arrive (the realistic case for a background/killed-
 * app tap) gets recorded at tap time instead.
 */
export function useNotificationListeners(): void {
  const recordedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification: Notification) => {
        const id = notification.request.identifier;
        recordedIdsRef.current.add(id);
        const { title, message, data } = extractPayload(notification);
        void addNotificationToHistory({ title, message, data });
      }
    );

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response: NotificationResponse) => {
        const { notification } = response;
        const id = notification.request.identifier;
        const { title, message, data } = extractPayload(notification);
        if (!recordedIdsRef.current.has(id)) {
          recordedIdsRef.current.add(id);
          void addNotificationToHistory({ title, message, data });
        }
        navigateToTarget(data);
      }
    );

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);
}
