import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Unsubscribe } from 'firebase/firestore';

vi.mock('../../../services/firebase/announcements');
vi.mock('../../../services/firebase/communityPosts');
vi.mock('../../../services/firebase/dailyVerses');
vi.mock('../../../services/firebase/events');
vi.mock('../../../services/firebase/media');
vi.mock('../../../services/firebase/notifications');
vi.mock('../../../services/firebase/plans');
vi.mock('../../../services/firebase/prophetVerses');
vi.mock('../../../services/firebase/reports');
vi.mock('../../../services/firebase/songs');
vi.mock('../../../services/firebase/votd');

import { subscribeToAnnouncements } from '../../../services/firebase/announcements';
import { subscribeToCommunityPosts } from '../../../services/firebase/communityPosts';
import { subscribeToDailyVerses } from '../../../services/firebase/dailyVerses';
import { subscribeToEvents } from '../../../services/firebase/events';
import { subscribeToMedia } from '../../../services/firebase/media';
import { subscribeToNotificationLog } from '../../../services/firebase/notifications';
import { subscribeToPlans } from '../../../services/firebase/plans';
import { subscribeToProphetVerses } from '../../../services/firebase/prophetVerses';
import { subscribeToOpenReportCount } from '../../../services/firebase/reports';
import { subscribeToSongs } from '../../../services/firebase/songs';
import {
  subscribeToActiveVersePool,
  subscribeToVersePool,
  subscribeToVotdConfig,
} from '../../../services/firebase/votd';
import { useAuthStore } from '../../../store/authStore';
import { renderThemed } from '../../../components/media/__tests__/helpers';
import { indiaDateKey } from '../../daily-verses/votdDate';
import { makePlan } from '../../plans/__tests__/fixtures';
import { DashboardPage } from '../DashboardPage';
import type {
  Announcement,
  DailyVerse,
  Event,
  NotificationLogEntry,
  Song,
} from '../../../types';
import type { ProphetVerseRecord } from '../../../services/firebase/prophetVerses';

const NOW = Date.now();
const ago = (hours: number) => new Date(NOW - hours * 3_600_000);
const ahead = (hours: number) => new Date(NOW + hours * 3_600_000);

type Subscribe<T> = (
  onNext: (value: T) => void,
  onError: (error: never) => void
) => Unsubscribe;

/** Makes a subscription answer at once with `value`. */
function feed<T>(subscribe: unknown, value: T) {
  vi.mocked(subscribe as Subscribe<T>).mockImplementation((onNext) => {
    onNext(value);
    return () => undefined;
  });
}
/** Makes a subscription never answer: still loading. */
function hang(subscribe: unknown) {
  vi.mocked(subscribe as Subscribe<unknown>).mockImplementation(() => () => undefined);
}
/** Makes a subscription fail. */
function fail(subscribe: unknown) {
  vi.mocked(subscribe as Subscribe<unknown>).mockImplementation((_next, onError) => {
    onError({ code: 'permission-denied' } as never);
    return () => undefined;
  });
}

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
  artist: 'T',
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
const notification = (o: Partial<NotificationLogEntry> = {}): NotificationLogEntry => ({
  id: 'n1',
  title: 'Service moved',
  message: 'x',
  imageUrl: null,
  recipientGroup: 'all_members',
  recipientCount: 12,
  sentBy: 'u',
  sentByEmail: null,
  sentAt: ago(3),
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

/** Every source answers, with nothing in it. */
function allEmpty() {
  feed(subscribeToAnnouncements, []);
  feed(subscribeToSongs, []);
  feed(subscribeToEvents, []);
  feed(subscribeToCommunityPosts, []);
  feed(subscribeToPlans, []);
  feed(subscribeToMedia, []);
  feed(subscribeToProphetVerses, []);
  feed(subscribeToDailyVerses, []);
  feed(subscribeToVersePool, []);
  feed(subscribeToActiveVersePool, []);
  feed(subscribeToVotdConfig, {
    enabled: true,
    seed: 'x',
    poolVersion: 1,
    timezone: 'Asia/Kolkata',
    updatedAt: null,
  });
  feed(subscribeToNotificationLog, []);
  feed(subscribeToOpenReportCount, 0);
}

function renderDashboard(
  role: 'content_admin' | 'super_admin' | 'host' | 'member' = 'content_admin'
) {
  useAuthStore.setState({
    user: { uid: 'u1', email: 'pastor@example.org' } as never,
    role,
  });
  return renderThemed(<DashboardPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  allEmpty();
});

describe('the heading', () => {
  it('welcomes the signed-in administrator and names their role', () => {
    renderDashboard('content_admin');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome, pastor@example.org' })
    ).toBeInTheDocument();
    expect(screen.getByText('Content Admin')).toBeInTheDocument();
  });

  it('signs out when asked', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signOut });
    const user = userEvent.setup();
    renderDashboard();
    useAuthStore.setState({ signOut });
    await user.click(screen.getByTestId('sign-out-button'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('while it loads', () => {
  it('shows placeholders and dashes, never a zero or an "all clear"', () => {
    hang(subscribeToAnnouncements);
    renderDashboard();
    expect(screen.getByTestId('dashboard-tile-announcements')).toHaveTextContent('—');
    expect(
      within(screen.getByTestId('dashboard-attention')).getByRole('status', {
        name: 'Loading drafts',
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('dashboard-attention-list-empty')
    ).not.toBeInTheDocument();
  });

  it('shows what has arrived while the rest is on its way', () => {
    hang(subscribeToAnnouncements);
    feed(subscribeToSongs, [song(), song({ id: 's2' })]);
    renderDashboard();
    expect(screen.getByTestId('dashboard-tile-songs')).toHaveTextContent('2');
  });
});

describe('with nothing written yet', () => {
  it('says so in each list, plainly', () => {
    renderDashboard();
    expect(screen.getByTestId('dashboard-attention-list-empty')).toHaveTextContent(
      /No drafts waiting/
    );
    expect(screen.getByTestId('dashboard-upcoming-list-empty')).toHaveTextContent(
      /Nothing is scheduled/
    );
    expect(screen.getByTestId('dashboard-recent-list-empty')).toHaveTextContent(
      /Nothing has been published yet/
    );
    expect(screen.getByTestId('dashboard-plans-list-empty')).toHaveTextContent(
      'No reading plans yet.'
    );
    expect(screen.getByTestId('dashboard-notification')).toHaveTextContent(
      'No notifications sent yet.'
    );
  });

  it('shows zero for what has been read and found empty', () => {
    renderDashboard();
    expect(screen.getByTestId('dashboard-tile-announcements')).toHaveTextContent('0');
    expect(screen.getByTestId('dashboard-tile-reports')).toHaveTextContent(
      'Nothing waiting'
    );
  });
});

describe('with content', () => {
  beforeEach(() => {
    feed(subscribeToAnnouncements, [
      announcement({
        id: 'draft-1',
        title: 'Christmas plans',
        published: false,
        updatedAt: ago(2),
      }),
      announcement({ id: 'live-1', title: 'Easter service', updatedAt: ago(30) }),
    ]);
    feed(subscribeToSongs, [
      song({ id: 's1', title: 'Old hymn', published: false, updatedAt: ago(60) }),
    ]);
    feed(subscribeToPlans, [
      makePlan({
        id: 'psalms',
        title: 'Seven Days in the Psalms',
        status: 'published',
        published: true,
        updatedAt: ago(5),
      }),
      makePlan({
        id: 'lent',
        title: 'Lent',
        status: 'scheduled',
        published: false,
        publishAt: ahead(48),
        updatedAt: ago(8),
      }),
      makePlan({
        id: 'advent',
        title: 'Advent',
        status: 'draft',
        published: false,
        updatedAt: ago(1),
      }),
      makePlan({
        id: 'old',
        title: 'Retired',
        status: 'archived',
        published: false,
        updatedAt: ago(0.1),
      }),
    ]);
    feed(subscribeToEvents, [
      event({ id: 'e1', title: 'Sunday service', startsAt: ahead(24) }),
    ]);
  });

  it('lists the drafts, most recently touched first, each opening for editing', () => {
    renderDashboard('content_admin');
    const list = within(screen.getByTestId('dashboard-attention-list'));
    const rows = list.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Advent'),
      expect.stringContaining('Christmas plans'),
      expect.stringContaining('Old hymn'),
    ]);
    expect(list.getByRole('link', { name: /Christmas plans/ })).toHaveAttribute(
      'href',
      '/announcements/draft-1/edit'
    );
    expect(list.getByRole('link', { name: /Old hymn/ })).toHaveAttribute(
      'href',
      '/songs/s1/edit'
    );
    expect(list.getByRole('link', { name: /Advent/ })).toHaveAttribute(
      'href',
      '/plans/advent/edit'
    );
    // What kind of thing each is, and how stale.
    expect(rows[0]).toHaveTextContent('Reading plan');
    expect(rows[1]).toHaveTextContent('Draft · edited 2 hours ago');
  });

  it('says what kind of thing each row is -- except in the panel that holds only plans', () => {
    renderDashboard();
    // A mixed list needs the label...
    expect(screen.getByTestId('dashboard-attention-list')).toHaveTextContent('Song');
    // ...a list of one kind does not repeat it down every row.
    const plans = screen.getByTestId('dashboard-plans-list');
    expect(plans).toHaveTextContent('Seven Days in the Psalms');
    expect(plans).not.toHaveTextContent('Reading plan');
  });

  it('lists what is scheduled, with when it opens', () => {
    renderDashboard();
    const list = within(screen.getByTestId('dashboard-upcoming-list'));
    expect(list.getByRole('link', { name: /Lent/ })).toHaveAttribute(
      'href',
      '/plans/lent/edit'
    );
    expect(screen.getByTestId('dashboard-upcoming-list')).toHaveTextContent(
      /Opens \d+ \w+, \d\d:\d\d/
    );
  });

  it('lists what is published, most recently changed first, and never a retired plan', () => {
    renderDashboard();
    const text = screen.getByTestId('dashboard-recent-list').textContent;
    expect(text!.indexOf('Seven Days in the Psalms')).toBeLessThan(
      text!.indexOf('Easter service')
    );
    expect(screen.queryByText('Retired')).not.toBeInTheDocument();
  });

  it('counts real documents on the tiles, each linking to its page', () => {
    renderDashboard();
    const announcements = screen.getByTestId('dashboard-tile-announcements');
    expect(announcements).toHaveTextContent('2');
    expect(announcements).toHaveTextContent('1 published · 1 draft');
    expect(announcements).toHaveAttribute('href', '/announcements');
    expect(screen.getByTestId('dashboard-tile-plans')).toHaveTextContent(
      '1 published · 1 scheduled · 1 draft'
    );
    expect(screen.getByTestId('dashboard-tile-events')).toHaveTextContent('1');
  });

  it('shows the plans most recently changed, with their counts', () => {
    renderDashboard();
    expect(screen.getByTestId('dashboard-plans-counts')).toHaveTextContent(
      '1 published · 1 scheduled · 1 draft'
    );
    const list = within(screen.getByTestId('dashboard-plans-list'));
    expect(list.getAllByRole('listitem')).toHaveLength(3);
    expect(list.getByRole('link', { name: /Advent/ })).toBeInTheDocument();
  });

  it('truncates a long list and says how many more', () => {
    feed(
      subscribeToAnnouncements,
      Array.from({ length: 9 }, (_, n) =>
        announcement({
          id: `d${n}`,
          title: `Draft ${n}`,
          published: false,
          updatedAt: ago(n + 1),
        })
      )
    );
    renderDashboard();
    expect(
      within(screen.getByTestId('dashboard-attention-list')).getAllByRole('listitem')
    ).toHaveLength(6);
    // 9 announcement drafts, 1 song draft, 1 plan draft: 11 in all.
    expect(screen.getByTestId('dashboard-attention')).toHaveTextContent('and 5 more');
  });
});

describe('who sees what', () => {
  beforeEach(() => {
    feed(subscribeToAnnouncements, [
      announcement({ id: 'draft-1', title: 'Christmas plans', published: false }),
    ]);
  });

  it('gives a content administrator the shortcuts to create, and the moderation count', () => {
    renderDashboard('content_admin');
    const actions = within(screen.getByTestId('dashboard-quick-actions'));
    expect(actions.getAllByRole('link')).toHaveLength(6);
    expect(actions.getByRole('link', { name: /New reading plan/ })).toHaveAttribute(
      'href',
      '/plans/new'
    );
    expect(actions.getByRole('link', { name: /New announcement/ })).toHaveAttribute(
      'href',
      '/announcements/new'
    );
    expect(screen.getByTestId('dashboard-tile-reports')).toBeInTheDocument();
    expect(subscribeToOpenReportCount).toHaveBeenCalled();
  });

  it('gives a super administrator the same', () => {
    renderDashboard('super_admin');
    expect(
      within(screen.getByTestId('dashboard-quick-actions')).getAllByRole('link')
    ).toHaveLength(6);
  });

  it('gives a host their own work, plain rows they cannot open, and no moderation count', () => {
    renderDashboard('host');
    const actions = within(screen.getByTestId('dashboard-quick-actions'));
    expect(actions.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      ['/events', '/daily-verses', '/plans']
    );
    expect(
      within(screen.getByTestId('dashboard-attention-list')).queryByRole('link')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-attention-list')).toHaveTextContent(
      'Christmas plans'
    );
    expect(screen.queryByTestId('dashboard-tile-reports')).not.toBeInTheDocument();
    // The queue is not even asked for.
    expect(subscribeToOpenReportCount).not.toHaveBeenCalled();
  });

  describe('for a host, who may not read everything', () => {
    // firestore.rules refuses a host the photo and video posts, the Prophet
    // verses, the whole verse pool and the moderation queue. Asking anyway
    // gave the page four "permission denied" answers and a banner telling a
    // host to check their connection.
    it('does not ask for what the rules refuse, so there is no false alarm', () => {
      renderDashboard('host');
      expect(subscribeToMedia).not.toHaveBeenCalled();
      expect(subscribeToProphetVerses).not.toHaveBeenCalled();
      expect(subscribeToVersePool).not.toHaveBeenCalled();
      expect(subscribeToOpenReportCount).not.toHaveBeenCalled();
      expect(screen.queryByTestId('dashboard-read-errors')).not.toBeInTheDocument();
    });

    it('reads the verse pool the way a member\'s phone does, and still names today\'s verse', () => {
      renderDashboard('host');
      expect(subscribeToActiveVersePool).toHaveBeenCalled();
      expect(screen.getByTestId('dashboard-verse-reference')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-verse-source')).toBeInTheDocument();
    });

    it('does not show a Prophet verse panel that could only ever say "none"', () => {
      renderDashboard('host');
      expect(screen.queryByTestId('dashboard-prophet')).not.toBeInTheDocument();
    });

    it('is not left on a loading state by the sources it does not read', () => {
      renderDashboard('host');
      expect(screen.queryByRole('status', { name: 'Loading drafts' })).not.toBeInTheDocument();
    });
  });

  describe('for a content administrator', () => {
    it('reads everything, the whole verse pool included', () => {
      renderDashboard('content_admin');
      expect(subscribeToMedia).toHaveBeenCalled();
      expect(subscribeToProphetVerses).toHaveBeenCalled();
      expect(subscribeToVersePool).toHaveBeenCalled();
      expect(subscribeToActiveVersePool).not.toHaveBeenCalled();
      expect(screen.getByTestId('dashboard-prophet')).toBeInTheDocument();
    });
  });

  it('offers no shortcuts to someone with no role to act in', () => {
    renderDashboard('member');
    expect(screen.queryByTestId('dashboard-quick-actions')).not.toBeInTheDocument();
  });
});

describe('when something cannot be read', () => {
  it('says which, and still shows everything else', () => {
    fail(subscribeToSongs);
    feed(subscribeToAnnouncements, [announcement()]);
    renderDashboard();
    expect(screen.getByTestId('dashboard-read-errors')).toHaveTextContent(
      /Could not read songs/
    );
    expect(screen.getByTestId('dashboard-tile-announcements')).toHaveTextContent('1');
    // The failed one reads as empty rather than holding the page on its loading state.
    expect(screen.getByTestId('dashboard-tile-songs')).toHaveTextContent('0');
  });

  it('lists several in one sentence', () => {
    fail(subscribeToSongs);
    fail(subscribeToPlans);
    renderDashboard();
    expect(screen.getByTestId('dashboard-read-errors')).toHaveTextContent(
      /songs, reading plans/
    );
  });

  it('does not call a failed moderation count "nothing waiting"', () => {
    fail(subscribeToOpenReportCount);
    renderDashboard('content_admin');
    expect(screen.getByTestId('dashboard-tile-reports')).toHaveTextContent('—');
    expect(screen.getByTestId('dashboard-tile-reports')).not.toHaveTextContent(
      'Nothing waiting'
    );
    expect(screen.getByTestId('dashboard-read-errors')).toHaveTextContent(/reports/);
  });

  it('says nothing is wrong when nothing is', () => {
    renderDashboard();
    expect(screen.queryByTestId('dashboard-read-errors')).not.toBeInTheDocument();
  });
});

describe('today’s verse', () => {
  it('names the verse the app is showing and says it was chosen for them, when nobody set one', () => {
    renderDashboard();
    expect(
      screen.getByTestId('dashboard-verse-reference').textContent!.length
    ).toBeGreaterThan(0);
    // The default is the app's own rotation: not "Not set".
    expect(screen.getByTestId('dashboard-verse-source')).toHaveTextContent(
      'From the app’s built-in year'
    );
    expect(screen.getByTestId('dashboard-verse')).not.toHaveTextContent(/not set/i);
  });

  it('says when a verse was set by hand, and shows that one', () => {
    const override: DailyVerse = {
      id: 'v1',
      reference: 'Romans 8:28',
      text: 'And we know that all things work together for good.',
      imageUrl: null,
      date: indiaDateKey(),
      createdAt: ago(10),
      updatedAt: ago(10),
    } as DailyVerse;
    feed(subscribeToDailyVerses, [override]);
    renderDashboard();
    expect(screen.getByTestId('dashboard-verse-reference')).toHaveTextContent(
      'Romans 8:28'
    );
    expect(screen.getByTestId('dashboard-verse-source')).toHaveTextContent('Set by hand');
  });

  it('links to the Verse of the Day page', () => {
    renderDashboard();
    expect(
      within(screen.getByTestId('dashboard-verse')).getByRole('link', { name: 'Open' })
    ).toHaveAttribute('href', '/daily-verses');
  });

  it('says it could not check when the verse sources cannot be read', () => {
    fail(subscribeToVersePool);
    renderDashboard();
    expect(screen.getByTestId('dashboard-verse')).toHaveTextContent(
      'Could not check today’s verse.'
    );
  });

  it('waits for all three sources rather than guessing', () => {
    hang(subscribeToVersePool);
    renderDashboard();
    expect(
      within(screen.getByTestId('dashboard-verse')).getByRole('status', {
        name: 'Loading today’s verse',
      })
    ).toBeInTheDocument();
  });
});

describe('the Prophet verse', () => {
  it('names the one that is showing', () => {
    feed(subscribeToProphetVerses, [
      prophet({ id: 'p1', title: 'A word for the week', reference: 'Isaiah 40:31' }),
    ]);
    renderDashboard();
    const panel = screen.getByTestId('dashboard-prophet');
    expect(panel).toHaveTextContent('A word for the week');
    expect(panel).toHaveTextContent('Showing now · Isaiah 40:31');
  });

  it('says none is showing when only a draft or a future one exists', () => {
    feed(subscribeToProphetVerses, [
      prophet({ published: false }),
      prophet({ id: 'p2', publishAt: ahead(10) }),
    ]);
    renderDashboard();
    expect(screen.getByTestId('dashboard-prophet')).toHaveTextContent(
      'No Prophet verse is showing.'
    );
  });
});

describe('a live event', () => {
  it('is announced at the top, with the way to manage it', () => {
    feed(subscribeToEvents, [
      event({ id: 'live', title: 'Sunday worship', isLive: true }),
    ]);
    renderDashboard();
    const banner = screen.getByTestId('dashboard-live');
    expect(banner).toHaveTextContent('LIVE NOW');
    expect(banner).toHaveTextContent('Sunday worship');
    expect(
      within(banner).getByRole('link', { name: 'Manage the live stream' })
    ).toHaveAttribute('href', '/events');
  });

  it('is not there when nothing is live', () => {
    feed(subscribeToEvents, [event()]);
    renderDashboard();
    expect(screen.queryByTestId('dashboard-live')).not.toBeInTheDocument();
  });
});

describe('the last notification', () => {
  it('says what was sent, to how many, and when — without claiming it was delivered', () => {
    feed(subscribeToNotificationLog, [
      notification({ title: 'Service moved', recipientCount: 12, sentAt: ago(3) }),
    ]);
    renderDashboard();
    const panel = screen.getByTestId('dashboard-notification');
    expect(panel).toHaveTextContent('“Service moved”');
    expect(panel).toHaveTextContent('Matched 12 users · 3 hours ago');
    expect(panel).not.toHaveTextContent(/delivered/i);
  });

  it('says "1 user" for one', () => {
    feed(subscribeToNotificationLog, [notification({ recipientCount: 1 })]);
    renderDashboard();
    expect(screen.getByTestId('dashboard-notification')).toHaveTextContent(
      'Matched 1 user ·'
    );
  });
});

describe('stopping', () => {
  it('lets go of every listener when the page goes away', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(subscribeToSongs).mockImplementation((onNext) => {
      onNext([]);
      return unsubscribe;
    });
    const view = renderDashboard();
    await waitFor(() => expect(subscribeToSongs).toHaveBeenCalled());
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
