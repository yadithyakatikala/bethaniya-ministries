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
 * The reports count is opened only for roles that may read the queue
 * (firestore.rules); for anyone else the dashboard simply has no such figure.
 */
export function useDashboardData(role: string | null): DashboardData {
  const announcements = useLive(subscribeToAnnouncements);
  const songs = useLive(subscribeToSongs);
  const events = useLive(subscribeToEvents);
  const community = useLive(subscribeToCommunityPosts);
  const plans = useLive(subscribeToPlans);
  const media = useLive(subscribeToMedia);
  const prophet = useLive(subscribeToProphetVerses);
  const config = useLive(subscribeToVotdConfig);
  const pool = useLive(subscribeToVersePool);
  const overrides = useLive(subscribeToDailyVerses);
  const notifications = useLive(subscribeToNotificationLog);
  const reports = useLive(canCreateContent(role) ? subscribeToOpenReportCount : null);

  const sources = useMemo<DashboardSources>(
    () => ({
      announcements: settled(announcements),
      songs: settled(songs),
      events: settled(events),
      community: settled(community),
      plans: settled(plans),
      media: settled(media),
      prophet: settled(prophet),
    }),
    [announcements, songs, events, community, plans, media, prophet]
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
    openReports: canCreateContent(role) ? reports.value : undefined,
    failed,
  };
}
