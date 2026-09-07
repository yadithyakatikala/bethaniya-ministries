/**
 * Real-time listener for published events the mobile app should show --
 * the mobile-side half of Day 7's "Mobile: Real-time listener on events
 * collection" plan item. Mirrors songs.ts's shape: members only ever see
 * published events (firestore.rules' `events` read rule matches songs'/
 * announcements' -- `isSignedIn() && resource.data.published == true`
 * for anyone who isn't Content Admin+), so the `where('published', '==',
 * true)` clause below mirrors that rule server-side, not just in the UI.
 *
 * VISIBILITY RULE (fixed in review after Day 7's first pass): "upcoming"
 * is not simply "startsAt in the future". A published event whose
 * `startsAt` has already passed must still be visible -- with WATCH LIVE
 * available -- while a Host has it marked `isLive`. The original
 * single-query version (`startsAt >= now`) made a live event vanish from
 * the list the instant its scheduled time passed, even mid-stream. The
 * fix runs two independent, merged subscriptions instead of one query:
 *
 *  - `upcomingQuery`: published == true && startsAt >= now, ordered by
 *    startsAt asc -- unchanged from the original, and still exactly the
 *    query the existing composite index (firestore.indexes.json:
 *    `published` ASC, `startsAt` ASC) was declared for.
 *  - `liveQuery`: published == true && isLive == true, with NO orderBy
 *    and NO range filter. Two equality filters need no composite index
 *    at all under Firestore's automatic indexing (composite indexes are
 *    only required when a range/inequality filter is combined with
 *    another filter or with an orderBy on a different field) -- so this
 *    doesn't add a new index declaration either.
 *
 * Results are merged client-side (deduped by id, since a live event that
 * hasn't started yet can match both queries) and re-sorted by startsAt
 * ascending on every update from either listener, preserving the
 * original ordering contract. A published event whose startsAt has
 * passed and which is NOT live still correctly disappears -- it matches
 * neither query -- per the "non-live past events don't need to appear"
 * requirement.
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

export interface PublishedEvent {
  id: string;
  title: string;
  location: string;
  description: string;
  startsAt: Date | null;
  isLive: boolean;
  /** A YouTube URL for the live stream/recording, or '' if none is set -- see features/events/youtube.ts for how this is parsed into a playable embed URL. */
  youtubeUrl: string;
}

function toPublishedEvent(id: string, data: Record<string, unknown>): PublishedEvent {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    location: typeof data.location === 'string' ? data.location : '',
    description: typeof data.description === 'string' ? data.description : '',
    startsAt: data.startsAt instanceof Timestamp ? data.startsAt.toDate() : null,
    isLive: data.isLive === true,
    youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : '',
  };
}

function sortByStartsAtAsc(events: PublishedEvent[]): PublishedEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.startsAt ? a.startsAt.getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.startsAt ? b.startsAt.getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

/**
 * Subscribes to every published event the mobile app should currently
 * show: events that haven't started yet, PLUS any published event
 * currently marked live regardless of its scheduled startsAt -- see the
 * module doc comment above for the two-query/merge reasoning. Calls
 * `onNext` with the merged, startsAt-ascending list once both underlying
 * listeners have delivered at least one snapshot, and again on every
 * subsequent update from either. `onError` fires (and the other listener
 * stays active) if either subscription errors.
 */
export function subscribeToPublishedEvents(
  onNext: (events: PublishedEvent[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  let upcoming: PublishedEvent[] | null = null;
  let live: PublishedEvent[] | null = null;

  function emitIfReady() {
    if (upcoming === null || live === null) return;
    const merged = new Map<string, PublishedEvent>();
    for (const event of upcoming) merged.set(event.id, event);
    for (const event of live) merged.set(event.id, event);
    onNext(sortByStartsAtAsc(Array.from(merged.values())));
  }

  const upcomingQuery = query(
    collection(db, 'events'),
    where('published', '==', true),
    where('startsAt', '>=', Timestamp.now()),
    orderBy('startsAt', 'asc')
  );
  const liveQuery = query(
    collection(db, 'events'),
    where('published', '==', true),
    where('isLive', '==', true)
  );

  const unsubscribeUpcoming = onSnapshot(
    upcomingQuery,
    (snapshot) => {
      upcoming = snapshot.docs.map((d) => toPublishedEvent(d.id, d.data()));
      emitIfReady();
    },
    onError
  );
  const unsubscribeLive = onSnapshot(
    liveQuery,
    (snapshot) => {
      live = snapshot.docs.map((d) => toPublishedEvent(d.id, d.data()));
      emitIfReady();
    },
    onError
  );

  return () => {
    unsubscribeUpcoming();
    unsubscribeLive();
  };
}
