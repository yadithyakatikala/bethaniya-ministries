/**
 * Real-time listener for published announcements -- the mobile-side half
 * of Day 4's "Mobile: Real-time listener on announcements collection
 * (updates home screen instantly)" plan item. Members only ever see
 * published announcements (firestore.rules' `announcements` read rule:
 * `isSignedIn() && resource.data.published == true` for anyone who isn't
 * Content Admin+) -- the `where('published', '==', true)` clause below
 * mirrors that rule, so an unpublished announcement is never even
 * downloaded, not just hidden by the UI.
 *
 * Query shape (published == true, ordered by createdAt desc) matches the
 * existing composite index already declared in firestore.indexes.json
 * (added Day 1, unused until now).
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

export interface PublishedAnnouncement {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date | null;
}

function toPublishedAnnouncement(
  id: string,
  data: Record<string, unknown>
): PublishedAnnouncement {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    content: typeof data.content === 'string' ? data.content : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  };
}

export function subscribeToPublishedAnnouncements(
  onNext: (announcements: PublishedAnnouncement[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'announcements'),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) =>
      onNext(snapshot.docs.map((d) => toPublishedAnnouncement(d.id, d.data()))),
    onError
  );
}
