import type { PublishedAnnouncement } from '../../services/firebase/announcements';
import type { PublishedCommunityPost } from '../../services/firebase/communityPosts';

/**
 * What the church says, as ONE list.
 *
 * An administrator publishes two kinds of thing: an ANNOUNCEMENT (a notice
 * -- the youth meeting moved) and a CHURCH POST (a testimony, news from the
 * church family). They live in two collections and always had two screens,
 * which to a member was one question asked twice: "what has the church said
 * lately?" So they are one feed here, newest first, each item labelled with
 * what it is (decision Q3 a). The collections, the rules and the admin pages
 * are untouched.
 */
export type UpdateKind = 'announcement' | 'post';

export interface UpdateItem {
  /** Unique across both kinds: two collections can hand out the same id. */
  key: string;
  kind: UpdateKind;
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date | null;
  /** The original record, for the detail screen's route params. */
  announcement?: PublishedAnnouncement;
  post?: PublishedCommunityPost;
}

/**
 * Merges the two lists, newest first. An item with no date (it can have
 * none) goes last rather than first: "no date" is not "newest".
 */
export function mergeUpdates(
  announcements: readonly PublishedAnnouncement[],
  posts: readonly PublishedCommunityPost[]
): UpdateItem[] {
  const items: UpdateItem[] = [
    ...announcements.map((announcement) => ({
      key: `announcement-${announcement.id}`,
      kind: 'announcement' as const,
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      imageUrl: announcement.imageUrl,
      createdAt: announcement.createdAt,
      announcement,
    })),
    ...posts.map((post) => ({
      key: `post-${post.id}`,
      kind: 'post' as const,
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      post,
    })),
  ];
  const time = (item: UpdateItem) =>
    item.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  // Array.prototype.sort is stable, so equal dates keep announcements first.
  return items.sort((a, b) => time(b) - time(a));
}
