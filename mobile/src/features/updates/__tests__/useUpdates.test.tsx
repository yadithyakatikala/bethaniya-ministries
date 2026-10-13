import { act, renderHook } from '@testing-library/react-native';
import { useUpdates } from '../useUpdates';
import { subscribeToPublishedAnnouncements } from '../../../services/firebase/announcements';
import { subscribeToPublishedCommunityPosts } from '../../../services/firebase/communityPosts';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/announcements');
jest.mock('../../../services/firebase/communityPosts');

const unsubscribeAnnouncements = jest.fn();
const unsubscribePosts = jest.fn();

type Next<T> = (items: T[]) => void;
type Fail = (error: unknown) => void;

let emitAnnouncements: Next<unknown>;
let failAnnouncements: Fail;
let emitPosts: Next<unknown>;
let failPosts: Fail;

const a1 = {
  id: 'a1',
  title: 'Youth meeting moved',
  content: 'Now at 6pm.',
  imageUrl: null,
  createdAt: new Date('2026-03-05T09:00:00Z'),
};
const p1 = {
  id: 'p1',
  title: 'A testimony',
  content: 'What the Lord has done.',
  imageUrl: null,
  createdAt: new Date('2026-03-07T09:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  (subscribeToPublishedAnnouncements as jest.Mock).mockImplementation((next, fail) => {
    emitAnnouncements = next;
    failAnnouncements = fail;
    return unsubscribeAnnouncements;
  });
  (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation((next, fail) => {
    emitPosts = next;
    failPosts = fail;
    return unsubscribePosts;
  });
});

describe('useUpdates', () => {
  it('is loading until BOTH sources have answered', async () => {
    const { result } = await renderHook(() => useUpdates());
    expect(result.current).toEqual({ status: 'loading', items: [] });

    // Half the church's voice is not the feed: it would re-sort under a finger.
    await act(async () => emitAnnouncements([a1]));
    expect(result.current.status).toBe('loading');
    expect(result.current.items).toEqual([]);

    await act(async () => emitPosts([p1]));
    expect(result.current.status).toBe('ready');
    expect(result.current.items.map((item) => item.key)).toEqual([
      'post-p1',
      'announcement-a1',
    ]);
  });

  it('is ready and empty when the church has published nothing', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      emitAnnouncements([]);
      emitPosts([]);
    });
    expect(result.current).toEqual({ status: 'ready', items: [] });
  });

  it('shows the other half when one source fails: it is still worth reading', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      failAnnouncements({ code: 'unavailable' });
      emitPosts([p1]);
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.items.map((item) => item.key)).toEqual(['post-p1']);
  });

  it('shows the announcements when the posts fail', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      emitAnnouncements([a1]);
      failPosts({ code: 'permission-denied' });
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.items.map((item) => item.key)).toEqual(['announcement-a1']);
  });

  it('is an error only when BOTH fail', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      failAnnouncements({ code: 'unavailable' });
      failPosts({ code: 'unavailable' });
    });
    expect(result.current).toEqual({ status: 'error', items: [] });
  });

  it('is ready with a source that failed and one that is empty: empty, not an error', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      failAnnouncements({ code: 'unavailable' });
      emitPosts([]);
    });
    expect(result.current).toEqual({ status: 'ready', items: [] });
  });

  it('is live: a new announcement appears without a refresh', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      emitAnnouncements([]);
      emitPosts([p1]);
    });
    expect(result.current.items).toHaveLength(1);

    await act(async () => emitAnnouncements([a1]));
    expect(result.current.items.map((item) => item.key)).toEqual([
      'post-p1',
      'announcement-a1',
    ]);
  });

  it('recovers when a failed source later answers', async () => {
    const { result } = await renderHook(() => useUpdates());
    await act(async () => {
      failAnnouncements({ code: 'unavailable' });
      failPosts({ code: 'unavailable' });
    });
    expect(result.current.status).toBe('error');

    await act(async () => emitPosts([p1]));
    expect(result.current.status).toBe('ready');
  });

  it('subscribes once to each source, and lets go of both when it unmounts', async () => {
    const { unmount } = await renderHook(() => useUpdates());
    expect(subscribeToPublishedAnnouncements).toHaveBeenCalledTimes(1);
    expect(subscribeToPublishedCommunityPosts).toHaveBeenCalledTimes(1);

    await unmount();
    expect(unsubscribeAnnouncements).toHaveBeenCalledTimes(1);
    expect(unsubscribePosts).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe again on a re-render', async () => {
    const { rerender } = await renderHook(() => useUpdates());
    await rerender({});
    await rerender({});
    expect(subscribeToPublishedAnnouncements).toHaveBeenCalledTimes(1);
    expect(subscribeToPublishedCommunityPosts).toHaveBeenCalledTimes(1);
  });
});
