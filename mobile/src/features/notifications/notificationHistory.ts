/**
 * Local, on-device notification history -- Day 10 decision 10: "implement
 * a local notification-history layer. Must NOT read notifications_log as
 * a member (RBAC intentionally disallows it). Store received
 * notification history locally."
 *
 * firestore.rules' notifications_log collection is `allow read: if
 * isHostOrAbove()` -- a Member has no read access to it at all (it's the
 * admin-side sent-log, not a per-member inbox), so this module never
 * reads Firestore. It only ever records notifications this specific
 * device has actually received (via expo-notifications' listeners --
 * see ../../services/notifications/notificationService.ts) or, in a
 * future Day where FCM push actually works end-to-end (see that file's
 * own doc comment for exactly why real delivery isn't testable in this
 * environment), that this device was later told about.
 *
 * Storage is a single AsyncStorage JSON array, same one-key-per-concern
 * shape as ../bible/languagePreference.ts and ../../context/
 * preferencesStorage.ts -- capped at MAX_HISTORY_ENTRIES so an
 * unbounded stream of notifications can't grow this file forever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'notification_history';
const MAX_HISTORY_ENTRIES = 100;

/** `data` is whatever navigation payload the sender included (see Day 10
 * decision 11's "navigation payload handling") -- shape is intentionally
 * loose (Record<string, unknown>) since this module has no opinion on
 * what a notification is about; the screen that reads it back is
 * responsible for validating it defensively before navigating anywhere. */
export interface NotificationHistoryEntry {
  id: string;
  title: string;
  message: string;
  receivedAt: string;
  data: Record<string, unknown> | null;
}

async function readHistory(): Promise<NotificationHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NotificationHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Newest first. Returns an empty array (never throws) if nothing has
 * ever been recorded, or if the stored JSON is somehow corrupt -- the
 * screen's empty state and its "something went wrong" state would look
 * identical to the user anyway, so there's no meaningful distinction to
 * preserve here. */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  const history = await readHistory();
  return [...history].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function addNotificationToHistory(entry: {
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  receivedAt?: string;
}): Promise<NotificationHistoryEntry> {
  const history = await readHistory();
  const newEntry: NotificationHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: entry.title,
    message: entry.message,
    data: entry.data ?? null,
    receivedAt: entry.receivedAt ?? new Date().toISOString(),
  };
  const updated = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return newEntry;
}

export async function clearNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
