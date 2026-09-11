/**
 * Real-time listener for published community posts -- a new V1 feature
 * (per explicit owner decision; not part of
 * FINAL_ARCHITECTURE_SPECIFICATION.md's original scope -- see
 * PRODUCTION_READINESS.md). Mirrors
 * mobile/src/services/firebase/announcements.ts exactly: admin-authored
 * content (testimonies, church-family updates), members only ever see
 * published posts (firestore.rules' `community` read rule), the
 * `where('published', '==', true)` clause mirrors that rule so an
 * unpublished post is never even downloaded. This is deliberately NOT an
 * open member-posting feed -- see admin/src/services/firebase/
 * communityPosts.ts for the admin-only write side.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from './app';

export interface PublishedCommunityPost {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date | null;
}

function toPublishedCommunityPost(
  id: string,
  data: Record<string, unknown>
): PublishedCommunityPost {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    content: typeof data.content === 'string' ? data.content : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}

export function subscribeToPublishedCommunityPosts(
  onNext: (posts: PublishedCommunityPost[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'community'),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPublishedCommunityPost(d.id, d.data()))),
    onError
  );
}
