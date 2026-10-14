import { useEffect, useMemo, useState } from 'react';
import type { FirestoreError, Unsubscribe } from 'firebase/firestore';
import { subscribeToAnnouncements } from '../../services/firebase/announcements';
import { subscribeToCommunityPosts } from '../../services/firebase/communityPosts';
import { subscribeToDailyVerses } from '../../services/firebase/dailyVerses';
import { subscribeToEvents } from '../../services/firebase/events';
import { subscribeToMedia } from '../../services/firebase/media';
import { subscribeToNotificationLog } from '../../services/firebase/notifications';
import { subscribeToPlans } from '../../services/firebase/plans';
import { subscribeToProphetVerses } from '../../services/firebase/prophetVerses';
import { subscribeToOpenReportCount } from '../../services/firebase/reports';
import { subscribeToSongs } from '../../services/firebase/songs';
import {
  subscribeToActiveVersePool,
  subscribeToVersePool,
  subscribeToVotdConfig,
  type VersePoolEntryDocument,
  type VotdConfigDocument,
} from '../../services/firebase/votd';
import type { DailyVerse, NotificationLogEntry } from '../../types';
import { canCreateContent, type DashboardSources } from './dashboardModel';

type Open<T> = (
  onNext: (value: T) => void,
  onError: (error: FirestoreError) => void
) => Unsubscribe;

interface Live<T> {
  /** null until the first answer. */
  value: T | null;
  failed: boolean;
}

/**
 * A source that failed reads as empty, so one unreadable collection does not
 * keep the whole page on its loading state; `failed` says which.
 */
function settled<T>(live: Live<T[]>): T[] | null {
  return live.value ?? (live.failed ? [] : null);
}

/**
 * One live read. `open` must be a stable function (a module-level
 * subscribeTo*), or null to read nothing -- a role that may not read it.
 */
function useLive<T>(open: Open<T> | null): Live<T> {
  const [state, setState] = useState<Live<T>>({ value: null, failed: false });
  useEffect(() => {
    if (!open) return undefined;
    return open(
      (value) => setState({ value, failed: false }),
      () => setState((current) => ({ value: current.value, failed: true }))
    );
  }, [open]);
  return state;
}

export type FailedRead = keyof DashboardSources | 'verse' | 'notifications' | 'reports';

export const FAILED_READ_NAMES: Record<FailedRead, string> = {
  announcements: 'announcements',
  songs: 'songs',
  events: 'events',
  community: 'community posts',
  plans: 'reading plans',
  media: 'photos and videos',
  prophet: 'Prophet verses',
  verse: 'the Verse of the Day',
  notifications: 'notifications',
  reports: 'reports',
};

export interface DashboardData {
  /** Null while a source is still loading; a source that failed reads as empty. */
  sources: DashboardSources;
  verse: {
    config: VotdConfigDocument | null;
    pool: VersePoolEntryDocument[] | null;
    overrides: DailyVerse[] | null;
  };
  /** undefined while loading; null when none has been sent. */
  lastNotification: NotificationLogEntry | null | undefined;
  /** undefined when this role cannot read the queue; null while loading. */
  openReports: number | null | undefined;
  /** What could not be read. Their figures are missing or out of date, and the page says so. */
  failed: FailedRead[];
}

/**
 * Everything the dashboard shows, read live with the same subscriptions the
 * pages themselves use (so no new query shape, and nothing here that a
 * page's own list would disagree with).
 *
 * ROLES. firestore.rules lets only a content administrator and above read
 * every photo/video post, every Prophet verse, the whole Verse of the Day pool
 * and the moderation queue. A host is refused all four, so the dashboard does
 * not ask: it would only collect four "permission denied" answers and warn the
 * host that their connection is bad. For a host those sources are empty (and
 * the Prophet panel is not shown); the verse pool is read the way a member's
 * phone reads it (active entries only), which gives the same verse.
 */
export function useDashboardData(role: string | null): DashboardData {
  const fullAccess = canCreateContent(role);
  const announcements = useLive(subscribeToAnnouncements);
  const songs = useLive(subscribeToSongs);
  const events = useLive(subscribeToEvents);
  const community = useLive(subscribeToCommunityPosts);
  const plans = useLive(subscribeToPlans);
  const media = useLive(fullAccess ? subscribeToMedia : null);
  const prophet = useLive(fullAccess ? subscribeToProphetVerses : null);
  const config = useLive(subscribeToVotdConfig);
  const pool = useLive(fullAccess ? subscribeToVersePool : subscribeToActiveVersePool);
  const overrides = useLive(subscribeToDailyVerses);
  const notifications = useLive(subscribeToNotificationLog);
  const reports = useLive(fullAccess ? subscribeToOpenReportCount : null);

  const sources = useMemo<DashboardSources>(
    () => ({
      announcements: settled(announcements),
      songs: settled(songs),
      events: settled(events),
      community: settled(community),
      plans: settled(plans),
      // A role that may not read these has none to show, which is not the
      // same as "still loading".
      media: fullAccess ? settled(media) : [],
      prophet: fullAccess ? settled(prophet) : [],
    }),
    [announcements, songs, events, community, plans, media, prophet, fullAccess]
  );

  const failed: FailedRead[] = [];
  if (announcements.failed) failed.push('announcements');
  if (songs.failed) failed.push('songs');
  if (events.failed) failed.push('events');
  if (community.failed) failed.push('community');
  if (plans.failed) failed.push('plans');
  if (media.failed) failed.push('media');
  if (prophet.failed) failed.push('prophet');
  if (config.failed || pool.failed || overrides.failed) failed.push('verse');
  if (notifications.failed) failed.push('notifications');
  if (reports.failed) failed.push('reports');

  return {
    sources,
    verse: { config: config.value, pool: pool.value, overrides: overrides.value },
    lastNotification:
      notifications.value === null
        ? notifications.failed
          ? null
          : undefined
        : (notifications.value[0] ?? null),
    // A failed read stays a dash (and is listed in `failed`): it is not "none".
    openReports: fullAccess ? reports.value : undefined,
    failed,
  };
}
