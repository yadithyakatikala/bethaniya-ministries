import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { PrayerWallScreen } from '../PrayerWallScreen';
import {
  PRAYER_REQUESTS_PAGE_SIZE,
  createPrayerRequest,
  deleteOwnPrayerRequest,
  fetchOwnPrayerRequestIds,
  fetchPrayerRequestPage,
  setPrayerRequestStatus,
  updatePrayerRequest,
  type PrayerRequest,
} from '../../../services/firebase/prayerRequests';
import {
  fetchReportedItemKeys,
  reportedItemKey,
  submitReport,
} from '../../../services/firebase/reports';
import { lightTokens } from '../../../theme/tokens';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/prayerRequests');
// Only the two functions that read and write; the key helper stays real.
jest.mock('../../../services/firebase/reports', () => ({
  ...jest.requireActual('../../../services/firebase/reports'),
  fetchReportedItemKeys: jest.fn(),
  submitReport: jest.fn(),
}));

/**
 * The Requests view of Prayers -- the church's shared prayer wall.
 *
 * A tester found two Home buttons ("Prayers" and "Prayer requests") that
 * led to the same kind of thing. This screen is the one that survived:
 * the shared feed, with "Ask for prayer" on it. What these tests defend
 * is the flow the brief asks for -- see the feed, tap Ask for prayer,
 * fill the form in, submit, land back on the feed -- the anonymity
 * behaviour that must survive it, and the parts of the approved design a
 * member can see: the All | Yours chips, the notices, the floating
 * button, the confirmation toast and the dialog that precedes a delete.
 */
function request(overrides: Partial<PrayerRequest> = {}): PrayerRequest {
  return {
    id: 'p1',
    title: 'Please pray',
    body: 'For my family this week.',
    category: 'family',
    anonymous: false,
    authorName: 'Asha Kumar',
    status: 'open',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    updatedAt: null,
    removed: false,
    ...overrides,
  };
}

function renderWall(header?: React.ReactNode) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PrayerWallScreen header={header} />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function signedIn(extra: Record<string, unknown> = {}) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({
      uid: 'member-1',
      displayName: 'Asha',
      email: null,
      phoneNumber: null,
      ...extra,
    });
    return jest.fn();
  });
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

/** Boxes ruled across their top edge, anywhere in the rendered tree. */
function countHairlines(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) return node.reduce((n, child) => n + countHairlines(child), 0);
  const { props, children } = node as {
    props?: { style?: unknown };
    children?: unknown[] | null;
  };
  const style = (StyleSheet.flatten(props?.style as never) ?? {}) as Record<
    string,
    unknown
  >;
  return (style.borderTopWidth === 1 ? 1 : 0) + countHairlines(children ?? []);
}

type Page = { requests: PrayerRequest[]; cursor: unknown };

/**
 * Serves the wall by cursor, whoever asks and however often: the screen reads its
 * first page once for each identity the auth listener reports (none, then the
 * member), so a queue of one-off answers would be spent on the wrong call.
 * `first` answers the request with no cursor; the others answer `{ after: key }`.
 */
function servePages(pages: Record<string, Page | (() => Promise<Page>)>) {
  (fetchPrayerRequestPage as jest.Mock).mockImplementation(
    async (options?: { cursor?: { after?: string } | null }) => {
      const key = options?.cursor?.after ?? 'first';
      const page = pages[key];
      if (!page) throw new Error(`no page served for ${key}`);
      return typeof page === 'function' ? page() : page;
    }
  );
}

/** Further pages asked for by a cursor (the first page has none). */
function pagesAskedByCursor() {
  return (fetchPrayerRequestPage as jest.Mock).mock.calls.filter(
    ([options]) => options?.cursor
  ).length;
}

beforeEach(() => {
  jest.clearAllMocks();
  (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  signedIn();
  (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
    requests: [request()],
    cursor: null,
  });
  (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set<string>());
  (fetchReportedItemKeys as jest.Mock).mockResolvedValue(new Set<string>());
  (createPrayerRequest as jest.Mock).mockResolvedValue('new-id');
  (updatePrayerRequest as jest.Mock).mockResolvedValue(undefined);
  (deleteOwnPrayerRequest as jest.Mock).mockResolvedValue(undefined);
  (setPrayerRequestStatus as jest.Mock).mockResolvedValue(undefined);
  (submitReport as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  await cleanup();
});

describe('the feed', () => {
  it('shows the church’s prayer requests', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeTruthy());
    expect(screen.getByText('Please pray')).toBeTruthy();
    expect(screen.getByText('For my family this week.')).toBeTruthy();
  });

  it('offers "Ask for prayer" as the one floating button over the list', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    expect(screen.getByText('Ask for prayer')).toBeTruthy();
    expect(flat(screen.getByTestId('prayer-wall-compose')).borderRadius).toBe(999);
  });

  it('draws the hub’s title and tabs at the top of the list, so they scroll away with it', async () => {
    const screen = await renderWall(<Text>HUB HEADER</Text>);
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeTruthy());
    expect(
      within(screen.getByTestId('prayer-wall-list')).getByText('HUB HEADER')
    ).toBeTruthy();
  });

  it('draws the title and tabs in every state, not only when there is a list', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const loading = await renderWall(<Text>HUB HEADER</Text>);
    expect(loading.getByText('HUB HEADER')).toBeTruthy();
    await loading.unmount();

    (fetchPrayerRequestPage as jest.Mock).mockRejectedValue(new Error('offline'));
    const failed = await renderWall(<Text>HUB HEADER</Text>);
    await waitFor(() => expect(failed.getByTestId('prayer-wall-error')).toBeTruthy());
    expect(failed.getByText('HUB HEADER')).toBeTruthy();
  });

  it('reserves room under the last row so the floating button never covers it', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeTruthy());
    expect(
      flat({
        props: {
          style: screen.getByTestId('prayer-wall-list').props.contentContainerStyle,
        },
      }).paddingBottom
    ).toBeGreaterThanOrEqual(80);
  });

  it('draws the list’s top hairline only when there are rows', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [],
      cursor: null,
    });
    const empty = await renderWall();
    await waitFor(() => expect(empty.getByTestId('prayer-wall-empty')).toBeTruthy());
    const emptyRules = countHairlines(empty.toJSON());
    await empty.unmount();

    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [request()],
      cursor: null,
    });
    const full = await renderWall();
    await waitFor(() => expect(full.getByText('Please pray')).toBeTruthy());
    // The rule above the first row (each row draws its own foot as a bottom border).
    expect(countHairlines(full.toJSON())).toBeGreaterThan(emptyRules);
  });
});

describe('before there is a list', () => {
  it('shows a skeleton while the first page loads, announced as loading', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockReturnValue(new Promise(() => undefined));
    const screen = await renderWall();
    expect(
      screen.getByTestId('prayer-wall-loading', { includeHiddenElements: true })
    ).toBeTruthy();
    // Nothing to add to yet: no floating button.
    expect(screen.queryByTestId('prayer-wall-compose')).toBeNull();
  });

  it('says so in words, with its own button, when nobody has asked for anything yet', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-empty')).toBeTruthy());
    expect(screen.getByText('No requests yet')).toBeTruthy();
    expect(
      screen.getByText('Be the first to ask the church to pray with you.')
    ).toBeTruthy();
    // The way to add one is still there -- as the empty state's own button, not a second one.
    expect(screen.getAllByTestId('prayer-wall-compose')).toHaveLength(1);
    expect(screen.getByText('Ask for prayer')).toBeTruthy();
  });

  it('opens the form from the empty state’s button', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());
  });

  it('says it could not load, with the way to try again, and no floating button', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockRejectedValue(new Error('offline'));
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-error')).toBeTruthy());
    expect(screen.getByText('Requests could not be loaded')).toBeTruthy();
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByTestId('prayer-wall-compose')).toBeNull();
  });

  it('loads again when the member chooses Try again', async () => {
    let online = false;
    (fetchPrayerRequestPage as jest.Mock).mockImplementation(async () => {
      if (!online) throw new Error('offline');
      return { requests: [request()], cursor: null };
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-error')).toBeTruthy());

    online = true;
    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByText('Please pray')).toBeTruthy());
    expect(screen.queryByTestId('prayer-wall-error')).toBeNull();
  });
});

describe('All | Yours', () => {
  const mine = request({ id: 'mine', title: 'My own request', authorName: 'Asha' });
  const theirs = request({ id: 'theirs', title: 'Someone else’s request' });

  beforeEach(() => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [mine, theirs],
      cursor: null,
    });
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['mine']));
  });

  it('offers two chips, All chosen', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-filter-all')).toBeTruthy()
    );
    expect(
      screen.getByTestId('prayer-wall-filter-all').props.accessibilityState.selected
    ).toBe(true);
    expect(
      screen.getByTestId('prayer-wall-filter-yours').props.accessibilityState.selected
    ).toBe(false);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Yours')).toBeTruthy();
  });

  it('shows everyone’s requests under All', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('My own request')).toBeTruthy());
    expect(screen.getByText('Someone else’s request')).toBeTruthy();
  });

  it('shows only the member’s own under Yours', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('My own request')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));
    await waitFor(() => expect(screen.queryByText('Someone else’s request')).toBeNull());
    expect(screen.getByText('My own request')).toBeTruthy();
    expect(
      screen.getByTestId('prayer-wall-filter-yours').props.accessibilityState.selected
    ).toBe(true);
  });

  it('goes back to everyone’s under All', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('My own request')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-all'));
    await waitFor(() => expect(screen.getByText('Someone else’s request')).toBeTruthy());
  });

  it('says "You have not asked for prayer yet" under Yours when there are none, with its own button', async () => {
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set<string>());
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('Someone else’s request')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));

    await waitFor(() => expect(screen.getByTestId('prayer-wall-no-own')).toBeTruthy());
    expect(screen.getByText('You have not asked for prayer yet')).toBeTruthy();
    expect(screen.getAllByTestId('prayer-wall-compose')).toHaveLength(1);
    // A different state from the church having no requests at all.
    expect(screen.queryByTestId('prayer-wall-empty')).toBeNull();
  });

  it('reads further pages to find the member’s own, and shows a skeleton -- not a false "none" -- meanwhile', async () => {
    const older = request({ id: 'older-mine', title: 'An older request of mine' });
    let releaseSecondPage: (page: Page) => void = () => undefined;
    servePages({
      first: { requests: [theirs], cursor: { after: 'c1' } },
      c1: () =>
        new Promise<Page>((resolve) => {
          releaseSecondPage = resolve;
        }),
    });
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['older-mine']));

    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('Someone else’s request')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));

    // Looking: a skeleton, not "You have not asked for prayer yet".
    await waitFor(() =>
      expect(
        screen.getByTestId('prayer-wall-loading', { includeHiddenElements: true })
      ).toBeTruthy()
    );
    expect(screen.queryByTestId('prayer-wall-no-own')).toBeNull();

    releaseSecondPage({ requests: [older], cursor: null });
    await waitFor(() =>
      expect(screen.getByText('An older request of mine')).toBeTruthy()
    );
    expect(screen.queryByTestId('prayer-wall-no-own')).toBeNull();
    // The second page was asked for by its cursor, once.
    expect(pagesAskedByCursor()).toBe(1);
  });

  it('does not read further when everything of the member’s is already on the page', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('My own request')).toBeTruthy());
    (fetchPrayerRequestPage as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));
    await waitFor(() => expect(screen.queryByText('Someone else’s request')).toBeNull());
    expect(fetchPrayerRequestPage).not.toHaveBeenCalled();
  });

  it('stops at the end of the wall even when an index entry is never found', async () => {
    // An orphaned entry in the member's own index must not walk the wall forever.
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['ghost']));
    servePages({
      first: { requests: [theirs], cursor: { after: 'c1' } },
      c1: { requests: [], cursor: null },
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('Someone else’s request')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));
    await waitFor(() => expect(screen.getByTestId('prayer-wall-no-own')).toBeTruthy());
    expect(pagesAskedByCursor()).toBe(1);
  });

  it('gives up after a bounded number of pages rather than reading the whole wall', async () => {
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['ghost']));
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [request({ id: 'x' })],
      cursor: { after: 'more' },
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('Please pray')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-filter-yours'));
    await waitFor(() => expect(screen.getByTestId('prayer-wall-no-own')).toBeTruthy());
    // Ten further pages after the first, and no more.
    expect(pagesAskedByCursor()).toBe(10);
    expect(PRAYER_REQUESTS_PAGE_SIZE).toBe(15);
  });
});

describe('notices', () => {
  it('says posting is paused for a suspended member, and disables the floating button', async () => {
    // A suspended member's profile, as PreferencesContext's listener receives it.
    (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
      onNext({ exists: () => true, data: () => ({ accountStatus: 'suspended' }) });
      return jest.fn();
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-suspended')).toBeTruthy());
    expect(screen.getByText('Posting is paused')).toBeTruthy();
    // They can still read everything...
    expect(screen.getByText('Please pray')).toBeTruthy();
    // ...but cannot ask: the button is there, disabled, and the notice says why.
    expect(
      screen.getByTestId('prayer-wall-compose').props.accessibilityState.disabled
    ).toBe(true);
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    expect(screen.queryByTestId('prayer-form-title')).toBeNull();
  });

  it('offers no "Ask for prayer" button at all on an empty wall to a suspended member', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
      onNext({ exists: () => true, data: () => ({ accountStatus: 'suspended' }) });
      return jest.fn();
    });
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-empty')).toBeTruthy());
    expect(screen.queryByTestId('prayer-wall-compose')).toBeNull();
  });

  it('says something did not work when a status change fails, and keeps the list', async () => {
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['p1']));
    (setPrayerRequestStatus as jest.Mock).mockRejectedValue(new Error('offline'));
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-answered-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-answered-p1'));

    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-action-failed')).toBeTruthy()
    );
    expect(screen.getByText('That did not work. Please try again.')).toBeTruthy();
    expect(screen.getByText('Please pray')).toBeTruthy();
  });

  it('clears that notice when the next action starts', async () => {
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['p1']));
    (setPrayerRequestStatus as jest.Mock)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-answered-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-answered-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-action-failed')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-answered-p1'));
    await waitFor(() =>
      expect(screen.queryByTestId('prayer-wall-action-failed')).toBeNull()
    );
  });
});

describe('asking for prayer', () => {
  it('opens the complete form', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));

    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());
    // Every M7 field, on one form.
    expect(screen.getByTestId('prayer-form-body')).toBeTruthy();
    expect(screen.getByTestId('prayer-form-category')).toBeTruthy();
    expect(screen.getByTestId('prayer-form-anonymous')).toBeTruthy();
    expect(screen.getByTestId('prayer-form-submit')).toBeTruthy();
  });

  it('submits what was typed and returns to the feed', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('prayer-form-title'), 'Travelling');
    await fireEvent.changeText(
      screen.getByTestId('prayer-form-body'),
      'Please pray for safety on the road.'
    );
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));

    await waitFor(() => expect(createPrayerRequest).toHaveBeenCalled());
    const input = (createPrayerRequest as jest.Mock).mock.calls[0][0];
    expect(input.title).toBe('Travelling');
    expect(input.body).toBe('Please pray for safety on the road.');

    // Back on the feed: the form is gone.
    await waitFor(() => expect(screen.queryByTestId('prayer-form-title')).toBeNull());
    expect(screen.getByTestId('prayer-wall-list')).toBeTruthy();
  });

  it('confirms with a toast: "Your request was shared"', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    expect(screen.queryByTestId('toast')).toBeNull();
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('prayer-form-title'), 'Travelling');
    await fireEvent.changeText(screen.getByTestId('prayer-form-body'), 'Safe roads.');
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));

    await waitFor(() => expect(screen.getByTestId('toast')).toBeTruthy());
    expect(
      within(screen.getByTestId('toast')).getByText('Your request was shared')
    ).toBeTruthy();
  });

  it('reloads the wall after sharing, so the new request lands where the server puts it', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    (fetchPrayerRequestPage as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('prayer-form-title'), 'Travelling');
    await fireEvent.changeText(screen.getByTestId('prayer-form-body'), 'Safe roads.');
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));
    await waitFor(() => expect(fetchPrayerRequestPage).toHaveBeenCalled());
  });

  it('refuses an empty request rather than posting a blank one', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-submit')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('prayer-form-submit'));
    expect(createPrayerRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Please write a subject.')).toBeTruthy();
  });

  it('carries the anonymous choice through to the write', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-anonymous')).toBeTruthy());

    await fireEvent(screen.getByTestId('prayer-form-anonymous'), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('prayer-form-title'), 'Something hard');
    await fireEvent.changeText(
      screen.getByTestId('prayer-form-body'),
      'I would rather not say who this is.'
    );
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));

    await waitFor(() => expect(createPrayerRequest).toHaveBeenCalled());
    // The service is what strips the identity (and firestore.rules
    // refuses the write if it does not) -- what matters here is that the
    // member's choice actually reaches it.
    expect((createPrayerRequest as jest.Mock).mock.calls[0][0].anonymous).toBe(true);
  });
});

describe('editing your own request', () => {
  beforeEach(() => {
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['p1']));
  });

  it('opens the form on that request, and saves the change without a toast', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-edit-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-edit-p1'));

    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());
    expect(screen.getByTestId('prayer-form-title').props.value).toBe('Please pray');
    await fireEvent.changeText(
      screen.getByTestId('prayer-form-title'),
      'Please pray hard'
    );
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));

    await waitFor(() => expect(updatePrayerRequest).toHaveBeenCalled());
    expect((updatePrayerRequest as jest.Mock).mock.calls[0][0]).toBe('p1');
    expect((updatePrayerRequest as jest.Mock).mock.calls[0][1].title).toBe(
      'Please pray hard'
    );
    expect(createPrayerRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('prayer-form-title')).toBeNull());
    // An edit is not a sharing: no "Your request was shared".
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('marks it answered in place', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-answered-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-answered-p1'));
    await waitFor(() =>
      expect(setPrayerRequestStatus).toHaveBeenCalledWith('p1', 'answered')
    );
    await waitFor(() => expect(screen.getByText('Still praying')).toBeTruthy());
  });
});

describe('deleting your own request', () => {
  beforeEach(() => {
    (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set(['p1']));
  });

  it('asks first, in the app’s own dialog, and says it is for everyone and cannot be undone', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-delete-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-delete-p1'));

    const dialog = within(screen.getByTestId('prayer-wall-delete-dialog'));
    expect(dialog.getByText('Delete this request?')).toBeTruthy();
    expect(
      dialog.getByText('It will be removed for everyone. This cannot be undone.')
    ).toBeTruthy();
    expect(deleteOwnPrayerRequest).not.toHaveBeenCalled();
  });

  it('deletes it, and takes it off the list, once confirmed', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-delete-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-delete-p1'));
    await fireEvent.press(
      within(screen.getByTestId('prayer-wall-delete-dialog')).getByText('Delete')
    );

    await waitFor(() =>
      expect(deleteOwnPrayerRequest).toHaveBeenCalledWith('member-1', 'p1')
    );
    await waitFor(() => expect(screen.queryByText('Please pray')).toBeNull());
  });

  it('deletes nothing when cancelled', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-delete-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-delete-p1'));
    await fireEvent.press(
      within(screen.getByTestId('prayer-wall-delete-dialog')).getByText('Cancel')
    );
    expect(deleteOwnPrayerRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Please pray')).toBeTruthy();
  });

  it('keeps the request, and says it did not work, when the delete fails', async () => {
    (deleteOwnPrayerRequest as jest.Mock).mockRejectedValue(new Error('offline'));
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-delete-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-delete-p1'));
    await fireEvent.press(
      within(screen.getByTestId('prayer-wall-delete-dialog')).getByText('Delete')
    );
    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-action-failed')).toBeTruthy()
    );
    expect(screen.getByText('Please pray')).toBeTruthy();
  });
});

describe('reporting someone else’s request', () => {
  it('opens the report sheet with no reason chosen, and Send report waiting for one', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-report-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-report-p1'));

    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-report-submit')).toBeTruthy()
    );
    expect(
      screen.getByTestId('prayer-wall-report-submit').props.accessibilityState.disabled
    ).toBe(true);
  });

  it('sends the report for that request and then says "Reported" on its row', async () => {
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-report-p1')).toBeTruthy()
    );
    await fireEvent.press(screen.getByTestId('prayer-request-report-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-report-reason-spam')).toBeTruthy()
    );

    await fireEvent.press(screen.getByTestId('prayer-wall-report-reason-harassment'));
    await fireEvent.press(screen.getByTestId('prayer-wall-report-submit'));

    await waitFor(() => expect(submitReport).toHaveBeenCalled());
    expect((submitReport as jest.Mock).mock.calls[0][0]).toMatchObject({
      targetType: 'prayer_request',
      targetId: 'p1',
      reason: 'harassment',
    });
    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-report-sent')).toBeTruthy()
    );

    await fireEvent.press(screen.getByTestId('prayer-wall-report-done'));
    await waitFor(() =>
      expect(
        screen.getByTestId('prayer-request-report-p1').props.accessibilityState.disabled
      ).toBe(true)
    );
    expect(
      within(screen.getByTestId('prayer-request-p1')).getByText('Reported')
    ).toBeTruthy();
  });

  it('shows a request already reported as "Reported" from the start', async () => {
    (fetchReportedItemKeys as jest.Mock).mockResolvedValue(
      new Set([reportedItemKey('prayer_request', 'p1')])
    );
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-report-p1')).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('prayer-request-p1')).getByText('Reported')
      ).toBeTruthy()
    );
  });
});

describe('paging', () => {
  it('shows "Loading more…" as plain words under the list while the next page comes', async () => {
    let release: (page: Page) => void = () => undefined;
    servePages({
      first: { requests: [request()], cursor: { after: 'c1' } },
      c1: () =>
        new Promise<Page>((resolve) => {
          release = resolve;
        }),
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('Please pray')).toBeTruthy());

    await fireEvent(screen.getByTestId('prayer-wall-list'), 'endReached');
    await waitFor(() =>
      expect(screen.getByTestId('prayer-wall-loading-more')).toBeTruthy()
    );
    expect(screen.getByText('Loading more…')).toBeTruthy();

    release({ requests: [request({ id: 'p2', title: 'A second page' })], cursor: null });
    await waitFor(() => expect(screen.getByText('A second page')).toBeTruthy());
    expect(screen.queryByTestId('prayer-wall-loading-more')).toBeNull();
  });

  it('asks for one page at a time, and not at all once the wall has ended', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByText('Please pray')).toBeTruthy());
    (fetchPrayerRequestPage as jest.Mock).mockClear();
    // The first page ended the wall (cursor: null).
    await fireEvent(screen.getByTestId('prayer-wall-list'), 'endReached');
    await fireEvent(screen.getByTestId('prayer-wall-list'), 'endReached');
    expect(fetchPrayerRequestPage).not.toHaveBeenCalled();
  });
});

describe('anonymity on the feed', () => {
  it('shows "Anonymous" and no name for an anonymous request', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [request({ anonymous: true, authorName: null })],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeTruthy());

    expect(screen.getByText('Anonymous')).toBeTruthy();
    // Queried rather than serialised: a whole screen's tree carries
    // React context providers, which are circular. The row-level test
    // in ./PrayerRequestRow.test.tsx does the full-tree sweep, where
    // the subtree is small enough to serialise.
    expect(screen.queryByText('Asha Kumar')).toBeNull();
    expect(screen.queryByTestId('prayer-request-author-p1')?.props.children).toBe(
      'Anonymous'
    );
  });

  it('colours nothing of an anonymous request as the member’s own', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [request({ anonymous: true, authorName: null })],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() =>
      expect(screen.getByTestId('prayer-request-author-p1')).toBeTruthy()
    );
    expect(flat(screen.getByTestId('prayer-request-author-p1')).color).toBe(
      lightTokens.ink
    );
  });
});
