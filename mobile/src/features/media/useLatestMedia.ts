import { useEffect, useState } from 'react';
import { fetchMediaPage, type MediaPost } from '../../services/firebase/media';

/**
 * The newest few media posts, for Home's "Photos and videos" row.
 *
 * =====================================================================
 * IT COSTS ONE SMALL READ, AND NOTHING WHEN THERE IS NOTHING
 * =====================================================================
 * One query for `count` documents, fetched once per mount, no listener. The
 * row is a doorway to the media feed, not a feed: Home already carries the
 * verse, the reading position, the Prophet Verse, the next event, and a
 * full feed dropped into it would bury them. The EXPERIENCE is
 * ../media/MediaFeedScreen.tsx.
 *
 * And when the church has posted nothing -- or the read fails -- this is
 * simply an empty list: the row still opens the feed, it just shows no
 * thumbnails. Home never shows an error panel for a secondary row.
 */
export function useLatestMedia(count: number): MediaPost[] {
  const [posts, setPosts] = useState<MediaPost[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const page = await fetchMediaPage({ pageSize: count });
        if (active) setPosts(page.posts);
      } catch (error) {
        console.warn('[media] could not load the Home media thumbnails:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [count]);

  return posts;
}
