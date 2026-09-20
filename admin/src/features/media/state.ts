/**
 * The three states a media post can be in.
 *
 * In its own module rather than beside the list page, because it is a
 * pure function worth testing directly -- and because a file that
 * exports components and helpers together breaks Fast Refresh. Same
 * shape, and the same reasoning, as ../prophet-verses/state.ts.
 *
 * =====================================================================
 * WHY THREE STATES AND NOT TWO
 * =====================================================================
 * DRAFT and SCHEDULED look identical to a member: neither is visible.
 * They are entirely different to an administrator -- one still needs
 * publishing, the other is finished and waiting for its moment.
 * Collapsing them into "not visible" leaves somebody unable to tell
 * whether Sunday's post is ready, which is the question the list exists
 * to answer.
 */
import type { MediaRecord } from '../../services/firebase/media';

export type MediaState = 'draft' | 'scheduled' | 'published';

export function stateOf(post: MediaRecord, now: Date): MediaState {
  if (!post.published) return 'draft';
  if (!post.publishAt || post.publishAt.getTime() > now.getTime()) return 'scheduled';
  return 'published';
}

export const MEDIA_STATE_LABELS: Record<MediaState, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
};

/** A caption is the closest thing a post has to a title. */
export function labelFor(post: { caption: string }): string {
  const caption = post.caption.trim();
  if (caption.length === 0) return 'Untitled post';
  return caption.length > 60 ? `${caption.slice(0, 57)}…` : caption;
}
