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
  'PrayersHub',
  'CommunityHub',
  'You',
  'Settings',
  'BibleSearch',
  'NotificationCenter',
]);

/**
 * Places that MOVED when the tabs became Home | Bible | Prayers | Community |
 * You. A notification already delivered, or sent by a church tool that has not
 * changed, may still say `screen: 'Profile'`; it lands on the Profile tab of
 * You rather than nowhere. (`Profile` was the only retired name this ever
 * accepted, so it is the only one carried over.)
 */
const MOVED_ROUTES: Record<string, NotificationNavigationTarget> = {
  Profile: { screen: 'You', params: { tab: 'profile' } },
};

export type NotificationNavigationTarget =
  | {
      screen: Exclude<keyof RootStackParamList, 'BibleChapter' | 'You'>;
      params?: undefined;
    }
  | { screen: 'BibleChapter'; params: { bookId: string; chapterNumber: number } }
  | { screen: 'You'; params?: { tab: 'saved' | 'profile' } };

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

  if (Object.prototype.hasOwnProperty.call(MOVED_ROUTES, data.screen)) {
    return MOVED_ROUTES[data.screen];
  }

  if (NO_PARAM_ROUTES.has(data.screen as keyof RootStackParamList)) {
    return {
      screen: data.screen as Exclude<keyof RootStackParamList, 'BibleChapter' | 'You'>,
    };
  }

  return null;
}
