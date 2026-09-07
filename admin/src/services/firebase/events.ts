/**
 * Firestore data layer for admin event management (Day 7). Mirrors
 * ./songs.ts's shape and reasoning exactly (see that module's header
 * comment for the full audit-log/authorization-boundary rationale, which
 * applies identically here).
 *
 * Two distinct write surfaces exist on events, matching firestore.rules'
 * isContentAdminOrAbove()-vs-isHostOrAbove() split:
 *  - createEvent/updateEvent/deleteEvent/setEventPublished manage the
 *    "content" fields (title/location/description/startsAt/published) --
 *    Content Admin and Super Admin only, enforced server-side by
 *    firestore.rules, not just by hiding UI here.
 *  - setEventLiveStream manages ONLY isLive/youtubeUrl -- Hosts (and
 *    above) may call this even though they cannot call any of the other
 *    functions above. It intentionally never touches title/location/
 *    description/startsAt/published/updatedAt, matching firestore.rules'
 *    Host update branch (`.diff().affectedKeys().hasOnly(['isLive',
 *    'youtubeUrl'])`) LITERALLY -- that check is `hasOnly`, not
 *    `hasAny`, so writing so much as `updatedAt` alongside isLive/
 *    youtubeUrl makes affectedKeys() include a key outside the allowed
 *    set and the whole write is rejected, even for a otherwise-valid
 *    live-stream toggle. (Caught in review: an earlier version of this
 *    function also wrote `updatedAt: serverTimestamp()`, which would
 *    have made every real Host live-stream update fail server-side even
 *    though it passed in tests that called Firestore directly with only
 *    isLive/youtubeUrl.) There is deliberately no "touch updatedAt some
 *    other way" workaround here -- Content Admin/Super Admin's own edits
 *    (updateEvent/setEventPublished) already stamp updatedAt on every
 *    field they're allowed to change; a live-stream toggle just doesn't
 *    update it, which is an acceptable trade-off for keeping the Host
 *    grant exactly as narrow as firestore.rules intends.
 *
 * No image upload here -- event cover images are explicitly out of scope
 * for Day 7 (see storage.rules' content/{imageType}/{fileName} rule,
 * which anticipates an `events` image type that this app deliberately
 * does not use yet).
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './app';
import { logAdminAction } from './auditLog';
import type { Event, EventFormInput } from '../../types';

const EVENTS_COLLECTION = 'events';

function toEvent(id: string, data: Record<string, unknown>): Event {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    location: typeof data.location === 'string' ? data.location : '',
    description: typeof data.description === 'string' ? data.description : '',
    startsAt: data.startsAt instanceof Timestamp ? data.startsAt.toDate() : null,
    published: data.published === true,
    isLive: data.isLive === true,
    youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * Subscribes to every event, soonest-starting first -- admins can read all
 * (firestore.rules' isContentAdminOrAbove() read branch), unlike members,
 * who only ever see published, upcoming ones (see
 * mobile/src/services/firebase/events.ts).
 */
export function subscribeToEvents(
  onNext: (events: Event[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, EVENTS_COLLECTION), orderBy('startsAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toEvent(d.id, d.data()))),
    onError
  );
}

/**
 * New events always start unpublished, not live, with no stream URL --
 * publishing and live-stream management are separate, explicit actions
 * (see setEventPublished/setEventLiveStream), same contract as
 * createSong()/createAnnouncement().
 */
export async function createEvent(input: EventFormInput): Promise<string> {
  const title = input.title.trim();
  const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
    title,
    location: input.location.trim(),
    description: input.description.trim(),
    startsAt: Timestamp.fromDate(new Date(input.startsAt)),
    published: false,
    isLive: false,
    youtubeUrl: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'events',
    documentId: docRef.id,
    changeSummary: `Created event "${title}"`,
  });
  return docRef.id;
}

/** Updates only the content fields -- never isLive/youtubeUrl (see setEventLiveStream). */
export async function updateEvent(id: string, input: EventFormInput): Promise<void> {
  const title = input.title.trim();
  await updateDoc(doc(db, EVENTS_COLLECTION, id), {
    title,
    location: input.location.trim(),
    description: input.description.trim(),
    startsAt: Timestamp.fromDate(new Date(input.startsAt)),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'events',
    documentId: id,
    changeSummary: `Updated event "${title}"`,
  });
}

/** `title` is passed in (rather than re-read) because it's no longer available once the doc is deleted. */
export async function deleteEvent(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, EVENTS_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'events',
    documentId: id,
    changeSummary: `Deleted event "${title}"`,
  });
}

export async function setEventPublished(
  id: string,
  title: string,
  published: boolean
): Promise<void> {
  await updateDoc(doc(db, EVENTS_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'events',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} event "${title}"`,
  });
}

/**
 * Live Stream Manager: updates ONLY isLive/youtubeUrl. This is the one
 * event write available to a Host (not just Content Admin/Super Admin) --
 * see the module doc comment above for why this function must never send
 * any other field.
 */
export async function setEventLiveStream(
  id: string,
  title: string,
  liveStream: { isLive: boolean; youtubeUrl: string }
): Promise<void> {
  // ONLY isLive/youtubeUrl -- see the module doc comment above for why
  // updatedAt (or any other field) must never be added here, even though
  // every other write function in this module stamps it.
  await updateDoc(doc(db, EVENTS_COLLECTION, id), {
    isLive: liveStream.isLive,
    youtubeUrl: liveStream.youtubeUrl.trim(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'events',
    documentId: id,
    changeSummary: `${liveStream.isLive ? 'Started' : 'Ended'} live stream for event "${title}"`,
  });
}
