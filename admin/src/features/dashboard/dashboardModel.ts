/**
 * What the dashboard says, worked out from what is actually stored.
 *
 * Every function here is pure: it takes the documents the pages already read
 * and the current moment, and returns what to show. Nothing is invented. A
 * number on the dashboard is a count of real documents; a list is real
 * documents in a stated order; where a figure cannot be known yet (its
 * listener has not answered) it is `null` and the screen shows a dash rather
 * than a zero that would look like an answer.
 *
 * WHAT COUNTS AS WHAT
 *   needs attention   a draft: written, saved, and not yet in members' hands.
 *   coming up         scheduled: finished, and waiting for its moment.
 *   recently updated  published, newest change first. Most content records no
 *                     separate "published at", so the honest ordering is by
 *                     the last time it changed.
 * A retired (archived) reading plan appears in none of them; it is hidden on
 * purpose. A Prophet Verse that is published but not the one on show
 * appears in none either: members do not see it.
 */
import { formatDate } from '../../components/ui/formatDate';
import type {
  Announcement,
  CommunityPost,
  Event,
  Plan,
  PlanStatus,
  Song,
  UserRole,
} from '../../types';
import type { MediaRecord } from '../../services/firebase/media';
import type { ProphetVerseRecord } from '../../services/firebase/prophetVerses';
import { labelFor as mediaLabel, stateOf as mediaStateOf } from '../media/state';
import {
  currentProphetVerseId,
  stateOf as prophetStateOf,
} from '../prophet-verses/state';
import { planStatusOf } from '../plans/planStatus';

export type ContentKind =
  'announcement' | 'song' | 'event' | 'community' | 'plan' | 'media' | 'prophet';

export type ItemState = 'draft' | 'scheduled' | 'published';

export const KIND_LABELS: Record<ContentKind, string> = {
  announcement: 'Announcement',
  song: 'Song',
  event: 'Event',
  community: 'Community post',
  plan: 'Reading plan',
  media: 'Photo or video',
  prophet: 'Prophet verse',
};

/** One piece of content, whatever kind, as the dashboard lists it. */
export interface DashboardItem {
  /** Unique across kinds: `${kind}:${id}`. */
  key: string;
  kind: ContentKind;
  title: string;
  /** Where to open it. */
  to: string;
  state: ItemState;
  /** When a scheduled item opens; null for anything else. */
  publishAt: Date | null;
  /** When it last changed. */
  at: Date | null;
}

/** Each source is `null` until its listener has answered. */
export interface DashboardSources {
  announcements: readonly Announcement[] | null;
  songs: readonly Song[] | null;
  events: readonly Event[] | null;
  community: readonly CommunityPost[] | null;
  plans: readonly Plan[] | null;
  media: readonly MediaRecord[] | null;
  prophet: readonly ProphetVerseRecord[] | null;
}

export const SOURCE_NAMES: Record<keyof DashboardSources, string> = {
  announcements: 'announcements',
  songs: 'songs',
  events: 'events',
  community: 'community posts',
  plans: 'reading plans',
  media: 'photos and videos',
  prophet: 'Prophet verses',
};

/** True once every source has answered (with data, or with a failure treated as empty). */
export function isLoaded(sources: DashboardSources): boolean {
  return Object.values(sources).every((source) => source !== null);
}

function titled(title: string, fallback: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function buildItems(sources: DashboardSources, now: Date): DashboardItem[] {
  const items: DashboardItem[] = [];

  for (const a of sources.announcements ?? []) {
    items.push({
      key: `announcement:${a.id}`,
      kind: 'announcement',
      title: titled(a.title, 'Untitled announcement'),
      to: `/announcements/${a.id}/edit`,
      state: a.published ? 'published' : 'draft',
      publishAt: null,
      at: a.updatedAt ?? a.createdAt,
    });
  }

  for (const s of sources.songs ?? []) {
    items.push({
      key: `song:${s.id}`,
      kind: 'song',
      title: titled(s.title, 'Untitled song'),
      to: `/songs/${s.id}/edit`,
      state: s.published ? 'published' : 'draft',
      publishAt: null,
      at: s.updatedAt ?? s.createdAt,
    });
  }

  for (const e of sources.events ?? []) {
    items.push({
      key: `event:${e.id}`,
      kind: 'event',
      title: titled(e.title, 'Untitled event'),
      to: `/events/${e.id}/edit`,
      state: e.published ? 'published' : 'draft',
      publishAt: null,
      at: e.updatedAt ?? e.createdAt,
    });
  }

  for (const c of sources.community ?? []) {
    items.push({
      key: `community:${c.id}`,
      kind: 'community',
      title: titled(c.title, 'Untitled post'),
      to: `/community/${c.id}/edit`,
      state: c.published ? 'published' : 'draft',
      publishAt: null,
      at: c.updatedAt ?? c.createdAt,
    });
  }

  for (const plan of sources.plans ?? []) {
    const status: PlanStatus = planStatusOf(plan, now);
    // Retired on purpose: not work in progress and not visible.
    if (status === 'archived') continue;
    items.push({
      key: `plan:${plan.id}`,
      kind: 'plan',
      title: titled(plan.title, 'Untitled plan'),
      to: `/plans/${plan.id}/edit`,
      state: status,
      publishAt: status === 'scheduled' ? plan.publishAt : null,
      // A plan records when it first went live; for the list of what is live,
      // the last change is what orders it, as for every other kind.
      at: plan.updatedAt ?? plan.createdAt,
    });
  }

  for (const post of sources.media ?? []) {
    const state = mediaStateOf(post, now);
    items.push({
      key: `media:${post.id}`,
      kind: 'media',
      title: mediaLabel(post),
      to: `/media/${post.id}/edit`,
      state,
      publishAt: state === 'scheduled' ? post.publishAt : null,
      at: post.updatedAt ?? post.createdAt,
    });
  }

  const prophet = sources.prophet ?? [];
  const showing = currentProphetVerseId([...prophet], now);
  for (const verse of prophet) {
    const state = prophetStateOf(verse, now);
    // Published and due, but another verse is the one on show: members do not
    // see this one, and it is not work to do either.
    if (state === 'showing' && verse.id !== showing) continue;
    items.push({
      key: `prophet:${verse.id}`,
      kind: 'prophet',
      title: titled(verse.title, titled(verse.reference, 'Untitled verse')),
      to: `/prophet-verses/${verse.id}/edit`,
      state: state === 'showing' ? 'published' : state,
      publishAt: state === 'scheduled' ? verse.publishAt : null,
      at: verse.updatedAt ?? verse.createdAt,
    });
  }

  return items;
}

const time = (date: Date | null): number => (date ? date.getTime() : 0);

/** Drafts, the most recently touched first: the work someone left half-done. */
export function needsAttention(items: readonly DashboardItem[]): DashboardItem[] {
  return items
    .filter((item) => item.state === 'draft')
    .sort((a, b) => time(b.at) - time(a.at));
}

/** Scheduled items, the soonest to open first. */
export function comingUp(items: readonly DashboardItem[]): DashboardItem[] {
  return items
    .filter((item) => item.state === 'scheduled')
    .sort((a, b) => time(a.publishAt) - time(b.publishAt));
}

/** Published items, the most recently changed first. */
export function recentlyUpdated(items: readonly DashboardItem[]): DashboardItem[] {
  return items
    .filter((item) => item.state === 'published')
    .sort((a, b) => time(b.at) - time(a.at));
}

/** Events that have not started yet and that members can see, soonest first. */
export function upcomingEvents(events: readonly Event[], now: Date): Event[] {
  return events
    .filter(
      (event) =>
        event.published && event.startsAt && event.startsAt.getTime() >= now.getTime()
    )
    .sort((a, b) => time(a.startsAt) - time(b.startsAt));
}

export function liveEvent(events: readonly Event[]): Event | null {
  return events.find((event) => event.isLive) ?? null;
}

/** How many plans are in each status, as members are concerned (a scheduled plan whose time has come counts as published). */
export function countPlans(
  plans: readonly Plan[],
  now: Date
): Record<PlanStatus, number> {
  const counts: Record<PlanStatus, number> = {
    draft: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  };
  for (const plan of plans) counts[planStatusOf(plan, now)] += 1;
  return counts;
}

/** The reading plans most recently changed (none retired), newest first. */
export function recentPlans(items: readonly DashboardItem[], count = 3): DashboardItem[] {
  return items
    .filter((item) => item.kind === 'plan')
    .sort((a, b) => time(b.at) - time(a.at))
    .slice(0, count);
}

// ---- Tiles -----------------------------------------------------------------

/** "3 published · 1 scheduled · 2 draft". */
export function planCountsLine(counts: Record<PlanStatus, number>): string {
  return `${counts.published} published · ${counts.scheduled} scheduled · ${counts.draft} draft`;
}

export interface Tile {
  id: string;
  label: string;
  /** '—' while it cannot be known yet. */
  value: string;
  detail?: string;
  to: string;
}

const dash = '—';

function count(list: readonly unknown[] | null): string {
  return list === null ? dash : String(list.length);
}

/**
 * The row of figures under the heading. Each is a count of real documents and
 * each links to the page that holds them.
 */
export function buildTiles(
  sources: DashboardSources,
  now: Date,
  openReports: number | null | undefined
): Tile[] {
  const announcements = sources.announcements;
  const publishedAnnouncements = announcements?.filter((a) => a.published).length ?? 0;

  const planCounts = sources.plans ? countPlans(sources.plans, now) : null;

  const tiles: Tile[] = [
    {
      id: 'announcements',
      label: 'Announcements',
      value: count(announcements),
      detail: announcements
        ? `${publishedAnnouncements} published · ${announcements.length - publishedAnnouncements} draft`
        : undefined,
      to: '/announcements',
    },
    {
      id: 'plans',
      label: 'Reading plans',
      value: planCounts
        ? String(planCounts.published + planCounts.scheduled + planCounts.draft)
        : dash,
      detail: planCounts ? planCountsLine(planCounts) : undefined,
      to: '/plans',
    },
    {
      id: 'songs',
      label: 'Songs',
      value: count(sources.songs),
      detail: sources.songs
        ? `${sources.songs.filter((song) => song.published).length} published`
        : undefined,
      to: '/songs',
    },
    {
      id: 'events',
      label: 'Upcoming events',
      value: sources.events ? String(upcomingEvents(sources.events, now).length) : dash,
      detail: sources.events ? `${sources.events.length} in all` : undefined,
      to: '/events',
    },
  ];

  // Only for those who can read the queue (undefined: this role cannot).
  if (openReports !== undefined) {
    tiles.push({
      id: 'reports',
      label: 'Open reports',
      value: openReports === null ? dash : String(openReports),
      detail: openReports === 0 ? 'Nothing waiting' : undefined,
      to: '/reports',
    });
  }

  return tiles;
}

// ---- Quick actions -----------------------------------------------------------

export interface QuickAction {
  id: string;
  label: string;
  to: string;
}

/** Content administrators and above create and publish; a host runs the live stream and reads. */
export function canCreateContent(role: UserRole | string | null): boolean {
  return role === 'content_admin' || role === 'super_admin';
}

export function quickActionsFor(role: UserRole | string | null): QuickAction[] {
  if (canCreateContent(role)) {
    return [
      { id: 'announcement', label: 'New announcement', to: '/announcements/new' },
      { id: 'plan', label: 'New reading plan', to: '/plans/new' },
      { id: 'media', label: 'Upload to the media library', to: '/media-library' },
      { id: 'song', label: 'New song', to: '/songs/new' },
      { id: 'event', label: 'New event', to: '/events/new' },
      { id: 'notification', label: 'Send a notification', to: '/notifications' },
    ];
  }
  if (role === 'host') {
    return [
      { id: 'live', label: 'Manage the live stream', to: '/events' },
      { id: 'verse', label: 'See today’s verse', to: '/daily-verses' },
      { id: 'plans', label: 'Look at the reading plans', to: '/plans' },
    ];
  }
  return [];
}

// ---- Words about time ----------------------------------------------------------

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "just now", "5 min ago", "3 hours ago", "2 days ago", then the date. */
export function describeAge(date: Date | null, now: Date): string {
  if (!date) return '';
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  // A clock a little ahead of the server's is not a time in the future.
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return formatDate(date);
}

/** A future moment in words: "4 Nov, 06:00". */
export function describeWhen(date: Date | null): string {
  return date ? DATE_TIME.format(date) : '';
}
