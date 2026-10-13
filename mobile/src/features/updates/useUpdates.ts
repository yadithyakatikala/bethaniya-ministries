import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToPublishedAnnouncements,
  type PublishedAnnouncement,
} from '../../services/firebase/announcements';
import {
  subscribeToPublishedCommunityPosts,
  type PublishedCommunityPost,
} from '../../services/firebase/communityPosts';
import { mergeUpdates, type UpdateItem } from './updates';

export type UpdatesState =
  | { status: 'loading'; items: [] }
  | { status: 'error'; items: [] }
  | { status: 'ready'; items: UpdateItem[] };

/** `undefined` while in flight; `'error'` once it has failed. */
type Source<T> = T[] | 'error' | undefined;

/**
 * The Updates feed: announcements and church posts, live, as one list.
 *
 * Both are real-time listeners (the same two subscriptions the separate
 * screens held), so a new announcement appears without a refresh.
 *
 *   loading  until BOTH have answered (a list that re-sorts under a finger
 *            when its second half arrives is worse than a beat of skeleton)
 *   ready    at least one answered with data; a source that failed simply
 *            contributes nothing -- the other half of the church's voice is
 *            still worth showing
 *   error    both failed
 *
 * Empty is `ready` with no items; the screen says so in words.
 */
export function useUpdates(): UpdatesState {
  const [announcements, setAnnouncements] = useState<Source<PublishedAnnouncement>>();
  const [posts, setPosts] = useState<Source<PublishedCommunityPost>>();

  useEffect(
    () =>
      subscribeToPublishedAnnouncements(
        (next) => setAnnouncements(next),
        () => setAnnouncements('error')
      ),
    []
  );
  useEffect(
    () =>
      subscribeToPublishedCommunityPosts(
        (next) => setPosts(next),
        () => setPosts('error')
      ),
    []
  );

  return useMemo<UpdatesState>(() => {
    if (announcements === undefined || posts === undefined) {
      return { status: 'loading', items: [] };
    }
    if (announcements === 'error' && posts === 'error') {
      return { status: 'error', items: [] };
    }
    return {
      status: 'ready',
      items: mergeUpdates(
        announcements === 'error' ? [] : announcements,
        posts === 'error' ? [] : posts
      ),
    };
  }, [announcements, posts]);
}
