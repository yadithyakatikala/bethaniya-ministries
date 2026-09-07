/**
 * Shared "what screen does this notification payload point at" logic --
 * used by both NotificationCenterScreen (tapping a past, locally-stored
 * notification) and ../../services/notifications/notificationService.ts
 * (tapping a live notification, when real delivery is available -- see
 * that file's doc comment for why real end-to-end delivery isn't
 * testable in this environment). Kept as one pure function so both call
 * sites treat an untrusted `data` payload identically and defensively:
 * an unrecognized `screen`, or a recognized one with a missing/wrong-typed
 * required param, resolves to `null` (no navigation) rather than risking
 * a runtime crash from malformed data a sender (or a bug) produced.
 */
import type { RootStackParamList } from '../../navigation/AppNavigator';

const NO_PARAM_ROUTES = new Set<keyof RootStackParamList>([
  'Home',
  'SongsList',
  'EventsList',
  'BibleBooks',
  'Profile',
  'Settings',
  'BibleSearch',
  'NotificationCenter',
]);

export type NotificationNavigationTarget =
  | { screen: Exclude<keyof RootStackParamList, 'BibleChapter'>; params?: undefined }
  | { screen: 'BibleChapter'; params: { bookId: string; chapterNumber: number } };

export function getNavigationTargetFromData(
  data: Record<string, unknown> | null | undefined
): NotificationNavigationTarget | null {
  if (!data || typeof data.screen !== 'string') return null;

  if (data.screen === 'BibleChapter') {
    const { bookId, chapterNumber } = data;
    if (typeof bookId === 'string' && typeof chapterNumber === 'number') {
      return { screen: 'BibleChapter', params: { bookId, chapterNumber } };
    }
    return null;
  }

  if (NO_PARAM_ROUTES.has(data.screen as keyof RootStackParamList)) {
    return { screen: data.screen as Exclude<keyof RootStackParamList, 'BibleChapter'> };
  }

  return null;
}
