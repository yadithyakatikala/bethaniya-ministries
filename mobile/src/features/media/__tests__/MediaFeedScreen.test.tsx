import React from 'react';
import { Share, Text } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { MediaFeedScreen } from '../MediaFeedScreen';
import { MEDIA_PAGE_SIZE } from '../../../services/firebase/media';

jest.mock('../../../services/firebase/app');

/**
 * The feed: what it shows, what it costs, and what it does for someone
 * without an account.
 *
 * Firestore is driven through the shared `firebase/firestore` mock rather
 * than by mocking the media service, so the pagination, the short-page
 * stop condition and the like/save reads are all really exercised.
 */
const Stack = createNativeStackNavigator();

function DetailStub() {
  return <Text testID="media-detail-stub">detail</Text>;
}

function docFor(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function mediaDoc(id: string, partial: Record<string, unknown> = {}) {
  return docFor(id, {
    type: 'image',
    mediaUrl: `https://example.org/${id}.jpg`,
    caption: `Caption ${id}`,
    published: true,
    publishAt: new Date('2026-04-01T00:00:00Z'),
    authorName: 'Pastor',
    ...partial,
  });
}

/**
 * Answers Firestore reads by collection. `getDocs` is used for the feed
 * pages AND for a member's likes and saves, so the mock has to tell them
 * apart -- it does so by what the caller asked for, in order.
 */
function mockReads(options: {
  pages?: ReturnType<typeof mediaDoc>[][];
  likes?: string[];
  saves?: string[];
}) {
  const pages = options.pages ?? [[]];
  let pageIndex = 0;
  (getDocs as jest.Mock).mockImplementation((request: unknown) => {
    const path = (request as { path?: string } | undefined)?.path ?? '';
    if (path.includes('mediaLikes')) {
      return Promise.resolve({ docs: (options.likes ?? []).map((id) => docFor(id, {})) });
    }
    if (path.includes('mediaSaves')) {
      return Promise.resolve({ docs: (options.saves ?? []).map((id) => docFor(id, {})) });
    }
    const page = pages[pageIndex] ?? [];
    pageIndex += 1;
    return Promise.resolve({ docs: page });
  });
}

/**
 * Asks the feed for its next page, the way reaching the bottom does.
 *
 * The handler is invoked through the list's own `onEndReached` prop
 * rather than by firing a scroll: VirtualizedList decides when to call
 * it from layout measurements that do not exist under Jest, so a scroll
 * event here would be testing React Native's windowing rather than this
 * screen. What IS this screen's contract -- reaching the end fetches
 * exactly one more page, appends it, and stops asking once the feed is
 * exhausted -- is what the prop exercises.
 */
async function reachEnd(list: { props: { onEndReached?: () => void } }) {
  await act(async () => {
    list.props.onEndReached?.();
  });
}

function mockSignedIn(uid: string | null) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(uid ? { uid, displayName: 'Ruth', email: null, phoneNumber: null } : null);
    return jest.fn();
  });
}

async function renderFeed() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="MediaFeed" component={MediaFeedScreen} />
            <Stack.Screen name="MediaDetail" component={DetailStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // The shared firestore mock's collection() returns undefined, so a
  // query carries no hint of what was asked for. Giving it a path (the
  // same shape doc() already has) is what lets mockReads tell a feed page
  // apart from a member's likes -- three different reads go through the
  // same getDocs.
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));
  (setDoc as jest.Mock).mockResolvedValue(undefined);
  (deleteDoc as jest.Mock).mockResolvedValue(undefined);
  mockSignedIn(null);
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe('what the feed shows', () => {
  it('renders published posts', async () => {
    mockReads({ pages: [[mediaDoc('a'), mediaDoc('b')]] });
    const screen = await renderFeed();

    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());
    expect(screen.getByTestId('media-card-b')).toBeTruthy();
    expect(screen.getByTestId('media-caption-a').props.children).toBe('Caption a');
  });

  it('shows a play marker on a video and none on an image', async () => {
    mockReads({
      pages: [
        [
          mediaDoc('img'),
          mediaDoc('vid', {
            type: 'video',
            mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
          }),
        ],
      ],
    });
    const screen = await renderFeed();

    await waitFor(() => expect(screen.getByTestId('media-card-vid')).toBeTruthy());
    expect(screen.getByTestId('media-play-vid')).toBeTruthy();
    expect(screen.queryByTestId('media-play-img')).toBeNull();
  });

  it('shows a verse when the post carries one', async () => {
    mockReads({
      pages: [[mediaDoc('a', { verseReference: 'John 3:16', verseText: 'For God...' })]],
    });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-verse-a')).toBeTruthy());
  });

  it('skips a post whose media link is unusable rather than rendering half a card', async () => {
    mockReads({
      pages: [[mediaDoc('good'), mediaDoc('bad', { mediaUrl: 'javascript:alert(1)' })]],
    });
    const screen = await renderFeed();

    await waitFor(() => expect(screen.getByTestId('media-card-good')).toBeTruthy());
    expect(screen.queryByTestId('media-card-bad')).toBeNull();
  });

  it('says so when the church has posted nothing', async () => {
    mockReads({ pages: [[]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-empty')).toBeTruthy());
  });

  it('offers a retry when the feed could not be read', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-error')).toBeTruthy());
  });
});

describe('pagination', () => {
  it('asks for one page, not the whole collection', async () => {
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    // One feed read. (Signed out, so no likes/saves reads either.)
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  it('fetches the next page when the member reaches the bottom, and appends it', async () => {
    const first = Array.from({ length: MEDIA_PAGE_SIZE }, (_, i) => mediaDoc(`p${i}`));
    mockReads({ pages: [first, [mediaDoc('next')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-p0')).toBeTruthy());

    await reachEnd(screen.getByTestId('media-feed'));

    // Asserted on the list's DATA, not on a rendered card: VirtualizedList
    // only renders its initial window under Jest, where nothing is
    // measured, so the eleventh item exists without being on screen.
    // Appending is the contract; which rows are mounted is React Native's
    // business.
    await waitFor(() =>
      expect(
        (screen.getByTestId('media-feed').props as { data: unknown[] }).data
      ).toHaveLength(MEDIA_PAGE_SIZE + 1)
    );
    expect(getDocs).toHaveBeenCalledTimes(2);
    // The first page is still there -- a next page appends, never replaces.
    expect(screen.getByTestId('media-card-p0')).toBeTruthy();
  });

  it('does not ask again once a short page says the feed is exhausted', async () => {
    // THE read-cost rule: scrolling to the bottom of a finished feed must
    // cost nothing. A short page means there is no more.
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await reachEnd(screen.getByTestId('media-feed'));
    await reachEnd(screen.getByTestId('media-feed'));

    expect(getDocs).toHaveBeenCalledTimes(1);
  });
});

describe('a signed-out visitor', () => {
  it('sees the feed in full', async () => {
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());
  });

  it('can share without an account, and nothing is written', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    mockReads({ pages: [[mediaDoc('a', { caption: 'Sunday worship' })]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-share-a'));

    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0]![0] as { message: string }).message;
    expect(message).toContain('Sunday worship');
    expect(message).toContain('https://example.org/a.jpg');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is told that liking needs an account, rather than nothing happening', async () => {
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-like-a'));

    await waitFor(() => expect(screen.getByTestId('media-sign-in-notice')).toBeTruthy());
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is told the same for saving', async () => {
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-save-a'));

    await waitFor(() => expect(screen.getByTestId('media-sign-in-notice')).toBeTruthy());
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('a signed-in member', () => {
  it('sees their existing likes and saves marked', async () => {
    mockSignedIn('member-1');
    mockReads({ pages: [[mediaDoc('a'), mediaDoc('b')]], likes: ['a'], saves: ['b'] });
    const screen = await renderFeed();

    await waitFor(() =>
      expect(screen.getByTestId('media-like-a').props.accessibilityState.selected).toBe(
        true
      )
    );
    expect(screen.getByTestId('media-like-b').props.accessibilityState.selected).toBe(
      false
    );
    expect(screen.getByTestId('media-save-b').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('writes a like to their OWN subcollection, keyed by the media id', async () => {
    mockSignedIn('member-1');
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-like-a'));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref] = (setDoc as jest.Mock).mock.calls[0] as [{ path: string }];
    expect(ref.path).toBe('users/member-1/mediaLikes/a');
  });

  it('unlikes by deleting that same document', async () => {
    mockSignedIn('member-1');
    mockReads({ pages: [[mediaDoc('a')]], likes: ['a'] });
    const screen = await renderFeed();
    await waitFor(() =>
      expect(screen.getByTestId('media-like-a').props.accessibilityState.selected).toBe(
        true
      )
    );

    await fireEvent.press(screen.getByTestId('media-like-a'));

    await waitFor(() => expect(deleteDoc).toHaveBeenCalled());
    const [ref] = (deleteDoc as jest.Mock).mock.calls[0] as [{ path: string }];
    expect(ref.path).toBe('users/member-1/mediaLikes/a');
  });

  it('saves a small copy of the post, so the Saved screen is one query', async () => {
    mockSignedIn('member-1');
    mockReads({ pages: [[mediaDoc('a', { caption: 'Sunday worship' })]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-save-a'));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref, data] = (setDoc as jest.Mock).mock.calls[0] as [
      { path: string },
      Record<string, unknown>,
    ];
    expect(ref.path).toBe('users/member-1/mediaSaves/a');
    expect(data.caption).toBe('Sunday worship');
    expect(data.mediaUrl).toBe('https://example.org/a.jpg');
    expect(data.type).toBe('image');
  });

  it('PUTS A FAILED LIKE BACK and says so, instead of claiming it worked', async () => {
    // The M6 BUG 1 lesson: an interface that reports success it did not
    // get is worse than one that is slow.
    mockSignedIn('member-1');
    mockReads({ pages: [[mediaDoc('a')]] });
    (setDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-like-a'));

    await waitFor(() => expect(screen.getByTestId('media-action-failed')).toBeTruthy());
    expect(screen.getByTestId('media-like-a').props.accessibilityState.selected).toBe(
      false
    );
  });

  it('opens the detail screen when a card is tapped', async () => {
    mockSignedIn('member-1');
    mockReads({ pages: [[mediaDoc('a')]] });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('media-card-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('media-open-a'));

    await waitFor(() => expect(screen.getByTestId('media-detail-stub')).toBeTruthy());
  });
});
