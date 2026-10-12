import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { UpdatesFeed } from '../UpdatesFeed';
import { subscribeToPublishedAnnouncements } from '../../../services/firebase/announcements';
import { subscribeToPublishedCommunityPosts } from '../../../services/firebase/communityPosts';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/announcements');
jest.mock('../../../services/firebase/communityPosts');

/**
 * The Updates feed -- the first tab of Community. It is where the old
 * Announcements list and the old Community list went, as one feed, and it
 * carries the shelf to Events, Songs and Photos and videos.
 *
 * What these defend is what a member can see: both kinds of update in one
 * list, each opening its own detail, the shelf always there, and the chat
 * NOT opened by it (a tester had reported Community and the chat as one
 * feature listed twice).
 */
const Stack = createNativeStackNavigator();

/** Prints the params it was opened with, so a test can see WHAT it was sent. */
function paramsStub(testID: string) {
  return function ParamsStub() {
    const { params } = useRoute();
    return <Text testID={testID}>{JSON.stringify(params ?? null)}</Text>;
  };
}

function Host() {
  return <UpdatesFeed header={<Text testID="hub-header">Community</Text>} />;
}

const AnnouncementDetailStub = paramsStub('announcement-detail-stub');
const PostDetailStub = paramsStub('post-detail-stub');
const EventsStub = paramsStub('events-stub');
const SongsStub = paramsStub('songs-stub');
const MediaStub = paramsStub('media-stub');
const ChatStub = paramsStub('chat-stub');

function renderFeed() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="Host" component={Host} />
            <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailStub} />
            <Stack.Screen name="CommunityPostDetail" component={PostDetailStub} />
            <Stack.Screen name="EventsList" component={EventsStub} />
            <Stack.Screen name="SongsList" component={SongsStub} />
            <Stack.Screen name="MediaFeed" component={MediaStub} />
            <Stack.Screen name="CommunityChat" component={ChatStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

const announcement = {
  id: 'a1',
  title: 'Youth meeting moved',
  content: 'Now at 6pm.',
  imageUrl: null,
  createdAt: new Date(2026, 2, 5, 12, 0),
};
const post = {
  id: 'p1',
  title: 'A testimony',
  content: 'What the Lord has done.',
  imageUrl: null,
  createdAt: new Date(2026, 2, 7, 12, 0),
};

function deliver(announcements: unknown[], posts: unknown[]) {
  (subscribeToPublishedAnnouncements as jest.Mock).mockImplementation((next) => {
    next(announcements);
    return jest.fn();
  });
  (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation((next) => {
    next(posts);
    return jest.fn();
  });
}

function fail(which: 'announcements' | 'posts' | 'both') {
  const failing = (_next: unknown, onError: (e: unknown) => void) => {
    onError({ code: 'unavailable' });
    return jest.fn();
  };
  const empty = (next: (items: unknown[]) => void) => {
    next([]);
    return jest.fn();
  };
  (subscribeToPublishedAnnouncements as jest.Mock).mockImplementation(
    which === 'posts' ? empty : failing
  );
  (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation(
    which === 'announcements' ? empty : failing
  );
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

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
});

describe('what the church has said', () => {
  it('lists announcements and church posts together, newest first, each labelled', async () => {
    deliver([announcement], [post]);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-post-p1')).toBeTruthy());

    const list = screen.getByTestId('community-list');
    const rows = within(list).getAllByRole('button', { name: /\./ });
    expect(rows.map((row) => row.props.testID)).toEqual([
      'community-post-p1',
      'announcement-a1',
    ]);
    expect(screen.getByText('A testimony')).toBeTruthy();
    expect(screen.getByText('Youth meeting moved')).toBeTruthy();
    expect(screen.getByText(/^Announcement/)).toBeTruthy();
    expect(screen.getByText(/^From the church/)).toBeTruthy();
  });

  it('opens an announcement on its own detail, with the record it holds', async () => {
    deliver([announcement], [post]);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('announcement-a1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('announcement-a1'));
    await waitFor(() =>
      expect(screen.getByTestId('announcement-detail-stub')).toBeTruthy()
    );
    const params = JSON.parse(
      screen.getByTestId('announcement-detail-stub').props.children as string
    );
    expect(params.announcement).toMatchObject({ id: 'a1', title: 'Youth meeting moved' });
    expect(params.post).toBeUndefined();
  });

  it('opens a post on the post detail, not the announcement one', async () => {
    deliver([announcement], [post]);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-post-p1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('community-post-p1'));
    await waitFor(() => expect(screen.getByTestId('post-detail-stub')).toBeTruthy());
    expect(screen.queryByTestId('announcement-detail-stub')).toBeNull();
    const params = JSON.parse(
      screen.getByTestId('post-detail-stub').props.children as string
    );
    expect(params.post).toMatchObject({ id: 'p1', title: 'A testimony' });
  });

  it('shows the hub’s own title and tabs at the top of the list, so they scroll away with it', async () => {
    deliver([announcement], []);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('announcement-a1')).toBeTruthy());
    expect(
      within(screen.getByTestId('community-list')).getByTestId('hub-header')
    ).toBeTruthy();
  });
});

describe('before there is anything to show', () => {
  it('shows a skeleton while it waits, announced as loading', async () => {
    (subscribeToPublishedAnnouncements as jest.Mock).mockImplementation(() => jest.fn());
    (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation(() => jest.fn());
    const screen = await renderFeed();
    expect(
      screen.getByTestId('community-loading', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(screen.queryByTestId('community-empty')).toBeNull();
    expect(screen.queryByTestId('community-error')).toBeNull();
  });

  it('says so in words when the church has published nothing, and invents nothing', async () => {
    deliver([], []);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-empty')).toBeTruthy());
    expect(screen.getByText('No announcements yet')).toBeTruthy();
    expect(screen.getByText('Church announcements will appear here.')).toBeTruthy();
    expect(screen.queryByTestId('community-loading')).toBeNull();
  });

  it('says it could not load when BOTH reads fail', async () => {
    fail('both');
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-error')).toBeTruthy());
    expect(screen.queryByTestId('community-empty')).toBeNull();
  });

  it('still shows the posts when only the announcements cannot be read', async () => {
    (subscribeToPublishedAnnouncements as jest.Mock).mockImplementation(
      (_next, onError) => {
        onError({ code: 'unavailable' });
        return jest.fn();
      }
    );
    (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation((next) => {
      next([post]);
      return jest.fn();
    });
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-post-p1')).toBeTruthy());
    expect(screen.queryByTestId('community-error')).toBeNull();
  });

  it('draws the list’s top hairline only when there are rows to rule', async () => {
    deliver([], []);
    const empty = await renderFeed();
    await waitFor(() => expect(empty.getByTestId('community-empty')).toBeTruthy());
    const emptyRules = countHairlines(empty.toJSON());
    await empty.unmount();

    deliver([announcement], []);
    const full = await renderFeed();
    await waitFor(() => expect(full.getByTestId('announcement-a1')).toBeTruthy());
    // One more: the rule above the first row.
    expect(countHairlines(full.toJSON())).toBeGreaterThan(emptyRules);
  });
});

describe('the shelf: Events, Songs, and Photos and videos', () => {
  it.each([
    ['community-open-events', 'events-stub'],
    ['community-open-songs', 'songs-stub'],
    ['community-open-media', 'media-stub'],
  ])('%s opens %s', async (chip, stub) => {
    deliver([announcement], []);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId(chip)).toBeTruthy());

    expect(screen.getByTestId(chip).props.accessibilityRole).toBe('button');
    await fireEvent.press(screen.getByTestId(chip));
    await waitFor(() => expect(screen.getByTestId(stub)).toBeTruthy());
  });

  it('names the three doors in words', async () => {
    deliver([], []);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-shelf')).toBeTruthy());
    expect(screen.getByTestId('community-open-events').props.accessibilityLabel).toBe(
      'Events'
    );
    expect(screen.getByTestId('community-open-songs').props.accessibilityLabel).toBe(
      'Songs'
    );
    expect(screen.getByTestId('community-open-media').props.accessibilityLabel).toBe(
      'Photos and videos'
    );
  });

  it.each([
    [
      'loading',
      () => {
        (subscribeToPublishedAnnouncements as jest.Mock).mockImplementation(() =>
          jest.fn()
        );
        (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation(() =>
          jest.fn()
        );
      },
    ],
    ['empty', () => deliver([], [])],
    ['failed', () => fail('both')],
    ['full', () => deliver([announcement], [post])],
  ])(
    'is there when the feed is %s: the doors do not depend on the read',
    async (_state, arrange) => {
      arrange();
      const screen = await renderFeed();
      expect(screen.getByTestId('community-open-events')).toBeTruthy();
      expect(screen.getByTestId('community-open-songs')).toBeTruthy();
      expect(screen.getByTestId('community-open-media')).toBeTruthy();
    }
  );

  it('side-scrolls and is 44 high, so it never wraps and never shrinks Telugu', async () => {
    deliver([], []);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-shelf')).toBeTruthy());
    expect(screen.getByTestId('community-shelf').props.horizontal).toBe(true);
    expect(
      screen.getByTestId('community-shelf').props.showsHorizontalScrollIndicator
    ).toBe(false);
  });
});

describe('Community is not the chat', () => {
  it('does not open the chat by itself, and offers no chat door of its own', async () => {
    deliver([announcement], [post]);
    const screen = await renderFeed();
    await waitFor(() => expect(screen.getByTestId('community-list')).toBeTruthy());
    // The chat is the OTHER tab of the hub, a sibling of this feed.
    expect(screen.queryByTestId('chat-stub')).toBeNull();
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(screen.queryByTestId('community-open-chat')).toBeNull();
  });
});
