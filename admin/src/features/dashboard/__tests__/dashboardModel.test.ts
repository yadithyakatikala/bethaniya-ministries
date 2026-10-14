import { describe, expect, it } from 'vitest';
import type { Announcement, CommunityPost, Event, Song } from '../../../types';
import type { MediaRecord } from '../../../services/firebase/media';
import type { ProphetVerseRecord } from '../../../services/firebase/prophetVerses';
import { makePlan } from '../../plans/__tests__/fixtures';
import {
  KIND_LABELS,
  buildItems,
  buildTiles,
  canCreateContent,
  comingUp,
  countPlans,
  describeAge,
  describeWhen,
  isLoaded,
  liveEvent,
  needsAttention,
  planCountsLine,
  quickActionsFor,
  recentPlans,
  recentlyUpdated,
  upcomingEvents,
  type DashboardSources,
} from '../dashboardModel';

const NOW = new Date('2026-06-10T12:00:00Z');
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const ahead = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

const announcement = (o: Partial<Announcement> = {}): Announcement => ({
  id: 'a1',
  title: 'Easter service',
  content: 'x',
  imageUrl: null,
  published: true,
  createdAt: ago(48),
  updatedAt: ago(24),
  ...o,
});
const song = (o: Partial<Song> = {}): Song => ({
  id: 's1',
  title: 'Amazing Grace',
  artist: 'Traditional',
  category: 'Hymn',
  lyrics: 'x',
  audioUrl: 'https://example.org/a.mp3',
  coverUrl: null,
  published: true,
  createdAt: ago(48),
  updatedAt: ago(24),
  ...o,
});
const event = (o: Partial<Event> = {}): Event => ({
  id: 'e1',
  title: 'Sunday service',
  location: 'Hall',
  description: '',
  startsAt: ahead(24),
  published: true,
  isLive: false,
  youtubeUrl: '',
  createdAt: ago(48),
  updatedAt: ago(24),
  ...o,
});
const post = (o: Partial<CommunityPost> = {}): CommunityPost => ({
  id: 'c1',
  title: 'Prayer night',
  content: 'x',
  imageUrl: null,
  published: true,
  createdAt: ago(48),
  updatedAt: ago(24),
  ...o,
});
const media = (o: Partial<MediaRecord> = {}): MediaRecord => ({
  id: 'm1',
  type: 'image',
  mediaUrl: 'https://example.org/p.jpg',
  caption: 'Baptism day',
  verseReference: null,
  verseText: null,
  published: true,
  publishAt: ago(24),
  authorName: 'A',
  authorUid: 'u',
  createdAt: ago(48),
  updatedAt: ago(24),
  ...o,
});
const prophet = (o: Partial<ProphetVerseRecord> = {}): ProphetVerseRecord => ({
  id: 'p1',
  title: 'A word for the week',
  reference: 'Isaiah 40:31',
  text: 'x',
  attribution: null,
  imageUrl: null,
  published: true,
  publishAt: ago(24),
  createdAt: ago(48),
  updatedAt: ago(24),
  ...o,
});

const EMPTY: DashboardSources = {
  announcements: [],
  songs: [],
  events: [],
  community: [],
  plans: [],
  media: [],
  prophet: [],
};
const sources = (o: Partial<DashboardSources>): DashboardSources => ({ ...EMPTY, ...o });

describe('buildItems', () => {
  it('describes every kind of content the same way, with where to open it', () => {
    const items = buildItems(
      sources({
        announcements: [announcement({ id: 'a1' })],
        songs: [song({ id: 's1' })],
        events: [event({ id: 'e1' })],
        community: [post({ id: 'c1' })],
        plans: [makePlan({ id: 'psalms', status: 'published', published: true })],
        media: [media({ id: 'm1' })],
        prophet: [prophet({ id: 'p1' })],
      }),
      NOW
    );
    expect(items.map((i) => [i.kind, i.to, i.state])).toEqual([
      ['announcement', '/announcements/a1/edit', 'published'],
      ['song', '/songs/s1/edit', 'published'],
      ['event', '/events/e1/edit', 'published'],
      ['community', '/community/c1/edit', 'published'],
      ['plan', '/plans/psalms/edit', 'published'],
      ['media', '/media/m1/edit', 'published'],
      ['prophet', '/prophet-verses/p1/edit', 'published'],
    ]);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('treats a source still loading as having nothing, without failing', () => {
    expect(
      buildItems(
        {
          announcements: null,
          songs: null,
          events: null,
          community: null,
          plans: null,
          media: null,
          prophet: null,
        },
        NOW
      )
    ).toEqual([]);
  });

  it('calls an unpublished record a draft', () => {
    const items = buildItems(
      sources({
        announcements: [announcement({ published: false })],
        songs: [song({ published: false })],
      }),
      NOW
    );
    expect(items.map((i) => i.state)).toEqual(['draft', 'draft']);
  });

  it('names something with no title, rather than leaving a blank row', () => {
    const items = buildItems(
      sources({
        announcements: [announcement({ title: '  ' })],
        songs: [song({ title: '' })],
        media: [media({ caption: '' })],
        plans: [makePlan({ title: ' ' })],
      }),
      NOW
    );
    expect(items.map((i) => i.title)).toEqual([
      'Untitled announcement',
      'Untitled song',
      'Untitled plan',
      'Untitled post',
    ]);
  });

  it('tells a scheduled photo from a draft and from one that is up', () => {
    const items = buildItems(
      sources({
        media: [
          media({ id: 'draft', published: false }),
          media({ id: 'later', publishAt: ahead(5) }),
          media({ id: 'up', publishAt: ago(5) }),
        ],
      }),
      NOW
    );
    expect(items.map((i) => [i.key, i.state])).toEqual([
      ['media:draft', 'draft'],
      ['media:later', 'scheduled'],
      ['media:up', 'published'],
    ]);
    expect(items[1]!.publishAt).toEqual(ahead(5));
    expect(items[0]!.publishAt).toBeNull();
  });

  it('reads a reading plan the way members do', () => {
    const items = buildItems(
      sources({
        plans: [
          makePlan({ id: 'draft', status: 'draft', published: false }),
          makePlan({
            id: 'later',
            status: 'scheduled',
            published: false,
            publishAt: ahead(10),
          }),
          // Its time has passed, so members can read it: it is published.
          makePlan({
            id: 'due',
            status: 'scheduled',
            published: false,
            publishAt: ago(1),
          }),
          makePlan({ id: 'old', status: null, published: true }),
          makePlan({ id: 'shelved', status: 'archived', published: false }),
        ],
      }),
      NOW
    );
    expect(items.map((i) => [i.key, i.state])).toEqual([
      ['plan:draft', 'draft'],
      ['plan:later', 'scheduled'],
      ['plan:due', 'published'],
      ['plan:old', 'published'],
    ]);
    // A retired plan is not work in progress and is not visible.
    expect(items.find((i) => i.key === 'plan:shelved')).toBeUndefined();
    expect(items[1]!.publishAt).toEqual(ahead(10));
  });

  it('lists only the Prophet verse that is on show, not the ones it has replaced', () => {
    const items = buildItems(
      sources({
        prophet: [
          prophet({ id: 'newest', publishAt: ago(1) }),
          prophet({ id: 'replaced', publishAt: ago(100) }),
          prophet({ id: 'next', publishAt: ahead(30) }),
          prophet({ id: 'draft', published: false }),
        ],
      }),
      NOW
    );
    expect(items.map((i) => [i.key, i.state])).toEqual([
      ['prophet:newest', 'published'],
      ['prophet:next', 'scheduled'],
      ['prophet:draft', 'draft'],
    ]);
  });

  it('falls back to a Prophet verse’s reference when it has no title', () => {
    const [item] = buildItems(sources({ prophet: [prophet({ title: '' })] }), NOW);
    expect(item!.title).toBe('Isaiah 40:31');
  });

  it('orders by the last change, using creation when nothing was ever changed', () => {
    const [item] = buildItems(
      sources({ songs: [song({ updatedAt: null, createdAt: ago(7) })] }),
      NOW
    );
    expect(item!.at).toEqual(ago(7));
  });
});

describe('the lists', () => {
  const items = buildItems(
    sources({
      announcements: [
        announcement({ id: 'old-draft', published: false, updatedAt: ago(100) }),
        announcement({ id: 'new-draft', published: false, updatedAt: ago(2) }),
        announcement({ id: 'live-new', updatedAt: ago(1) }),
        announcement({ id: 'live-old', updatedAt: ago(80) }),
      ],
      media: [
        media({ id: 'soon', publishAt: ahead(3) }),
        media({ id: 'later', publishAt: ahead(50) }),
      ],
    }),
    NOW
  );

  it('puts the draft touched most recently first', () => {
    expect(needsAttention(items).map((i) => i.key)).toEqual([
      'announcement:new-draft',
      'announcement:old-draft',
    ]);
  });

  it('puts the scheduled item that opens soonest first', () => {
    expect(comingUp(items).map((i) => i.key)).toEqual(['media:soon', 'media:later']);
  });

  it('puts the published item changed most recently first', () => {
    expect(recentlyUpdated(items).map((i) => i.key)).toEqual([
      'announcement:live-new',
      'announcement:live-old',
    ]);
  });

  it('does not change the list it is given', () => {
    const before = items.map((i) => i.key);
    needsAttention(items);
    comingUp(items);
    recentlyUpdated(items);
    expect(items.map((i) => i.key)).toEqual(before);
  });

  it('is empty when there is nothing of that kind', () => {
    expect(needsAttention([])).toEqual([]);
    expect(comingUp([])).toEqual([]);
    expect(recentlyUpdated([])).toEqual([]);
  });
});

describe('events', () => {
  it('lists the published events still to come, soonest first', () => {
    const upcoming = upcomingEvents(
      [
        event({ id: 'past', startsAt: ago(5) }),
        event({ id: 'far', startsAt: ahead(100) }),
        event({ id: 'soon', startsAt: ahead(2) }),
        event({ id: 'draft', published: false, startsAt: ahead(3) }),
        event({ id: 'undated', startsAt: null }),
      ],
      NOW
    );
    expect(upcoming.map((e) => e.id)).toEqual(['soon', 'far']);
  });

  it('finds the event that is live', () => {
    expect(liveEvent([event({ id: 'a' }), event({ id: 'b', isLive: true })])?.id).toBe(
      'b'
    );
    expect(liveEvent([event()])).toBeNull();
  });
});

describe('reading-plan figures', () => {
  const plans = [
    makePlan({ id: 'a', status: 'published', published: true }),
    makePlan({ id: 'b', status: 'draft', published: false, updatedAt: ago(1) }),
    makePlan({
      id: 'c',
      status: 'scheduled',
      published: false,
      publishAt: ahead(5),
      updatedAt: ago(3),
    }),
    makePlan({
      id: 'd',
      status: 'scheduled',
      published: false,
      publishAt: ago(5),
      updatedAt: ago(10),
    }),
    makePlan({ id: 'e', status: 'archived', published: false, updatedAt: ago(0.5) }),
  ];

  it('counts each status as members would see it', () => {
    expect(countPlans(plans, NOW)).toEqual({
      draft: 1,
      scheduled: 1,
      published: 2,
      archived: 1,
    });
  });

  it('says it in a line', () => {
    expect(planCountsLine({ draft: 1, scheduled: 1, published: 2, archived: 1 })).toBe(
      '2 published · 1 scheduled · 1 draft'
    );
  });

  it('shows the three plans changed most recently, never a retired one', () => {
    const items = buildItems(sources({ plans }), NOW);
    expect(recentPlans(items).map((i) => i.key)).toEqual(['plan:b', 'plan:c', 'plan:d']);
    expect(recentPlans(items, 2)).toHaveLength(2);
  });
});

describe('isLoaded', () => {
  it('is true only once every source has answered', () => {
    expect(isLoaded(EMPTY)).toBe(true);
    expect(isLoaded({ ...EMPTY, plans: null })).toBe(false);
  });
});

describe('buildTiles', () => {
  const full = sources({
    announcements: [
      announcement({ id: 'a' }),
      announcement({ id: 'b', published: false }),
    ],
    songs: [song({ id: 's1' }), song({ id: 's2', published: false }), song({ id: 's3' })],
    events: [event({ id: 'e1' }), event({ id: 'e2', startsAt: ago(3) })],
    plans: [
      makePlan({ id: 'p1', status: 'published', published: true }),
      makePlan({ id: 'p2', status: 'draft', published: false }),
    ],
  });
  const byId = (tiles: ReturnType<typeof buildTiles>, id: string) =>
    tiles.find((t) => t.id === id)!;

  it('counts real documents, with a word about each', () => {
    const tiles = buildTiles(full, NOW, undefined);
    expect(byId(tiles, 'announcements')).toMatchObject({
      value: '2',
      detail: '1 published · 1 draft',
      to: '/announcements',
    });
    expect(byId(tiles, 'plans')).toMatchObject({
      value: '2',
      detail: '1 published · 0 scheduled · 1 draft',
      to: '/plans',
    });
    expect(byId(tiles, 'songs')).toMatchObject({ value: '3', detail: '2 published' });
    // Only the event still to come is "upcoming".
    expect(byId(tiles, 'events')).toMatchObject({ value: '1', detail: '2 in all' });
  });

  it('shows a dash, never a zero, for what has not been read yet', () => {
    const tiles = buildTiles(
      {
        announcements: null,
        songs: null,
        events: null,
        community: null,
        plans: null,
        media: null,
        prophet: null,
      },
      NOW,
      undefined
    );
    expect(tiles.map((t) => t.value)).toEqual(['—', '—', '—', '—']);
    expect(tiles.every((t) => t.detail === undefined)).toBe(true);
  });

  it('adds the open reports for those who can read them, and not for those who cannot', () => {
    expect(buildTiles(full, NOW, undefined).map((t) => t.id)).not.toContain('reports');
    const withReports = buildTiles(full, NOW, 3);
    expect(byId(withReports, 'reports')).toMatchObject({ value: '3', to: '/reports' });
    expect(byId(buildTiles(full, NOW, 0), 'reports').detail).toBe('Nothing waiting');
    expect(byId(buildTiles(full, NOW, null), 'reports').value).toBe('—');
  });
});

describe('quick actions', () => {
  it('gives content administrators and above the ways to create things', () => {
    for (const role of ['content_admin', 'super_admin']) {
      expect(quickActionsFor(role).map((a) => a.to)).toEqual([
        '/announcements/new',
        '/plans/new',
        '/media-library',
        '/songs/new',
        '/events/new',
        '/notifications',
      ]);
    }
  });

  it('gives a host only their own work', () => {
    expect(quickActionsFor('host').map((a) => a.to)).toEqual([
      '/events',
      '/daily-verses',
      '/plans',
    ]);
  });

  it('gives a member, or nobody, nothing', () => {
    expect(quickActionsFor('member')).toEqual([]);
    expect(quickActionsFor(null)).toEqual([]);
  });

  it('lets only content administrators and above create', () => {
    expect(canCreateContent('content_admin')).toBe(true);
    expect(canCreateContent('super_admin')).toBe(true);
    expect(canCreateContent('host')).toBe(false);
    expect(canCreateContent('member')).toBe(false);
    expect(canCreateContent(null)).toBe(false);
  });
});

describe('words about time', () => {
  it.each([
    [0, 'just now'],
    [59, 'just now'],
    [60, '1 min ago'],
    [59 * 60, '59 min ago'],
    [3600, '1 hour ago'],
    [3 * 3600, '3 hours ago'],
    [86_400, '1 day ago'],
    [6 * 86_400, '6 days ago'],
  ])('says %i seconds ago as "%s"', (seconds, words) => {
    expect(describeAge(new Date(NOW.getTime() - seconds * 1000), NOW)).toBe(words);
  });

  it('gives the date once it is a week old', () => {
    expect(describeAge(new Date('2026-05-01T00:00:00Z'), NOW)).toBe('1 May 2026');
  });

  it('does not say "in the future" for a clock slightly ahead', () => {
    expect(describeAge(new Date(NOW.getTime() + 30_000), NOW)).toBe('just now');
  });

  it('says nothing for no date', () => {
    expect(describeAge(null, NOW)).toBe('');
    expect(describeWhen(null)).toBe('');
  });

  it('gives a future moment as a day, month and time', () => {
    expect(describeWhen(new Date(2026, 10, 4, 6, 0))).toMatch(/4 Nov.*06:00/);
  });

  it('names every kind of content', () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual([
      'announcement',
      'community',
      'event',
      'media',
      'plan',
      'prophet',
      'song',
    ]);
  });
});
