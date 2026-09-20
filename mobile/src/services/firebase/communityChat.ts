/**
 * The church's group chat -- M7.
 *
 * =====================================================================
 * THIS IS NOT ./communityPosts.ts
 * =====================================================================
 * ./communityPosts.ts is the admin-authored `community` collection --
 * testimonies and church-family updates, written by an administrator and
 * read by everyone. It stays exactly as it is. THIS module is the
 * congregation talking to each other: everyone writes, everyone reads,
 * and the two live in different collections with different permissions
 * so that neither can be mistaken for the other.
 *
 * =====================================================================
 * THE SCHEMA
 * =====================================================================
 *   community_messages/{messageId}
 *     text          what was said
 *     authorUid     who said it
 *     authorName    DENORMALIZED -- see below
 *     createdAt     server clock
 *     removed       an administrator removed it; the app shows a tombstone
 *     removedAt / removedByUid
 *
 * `authorName` is copied onto the message because firestore.rules does
 * not let a member read another member's profile: looking the sender up
 * at read time would not merely be slow, it would be denied. Same
 * decision as ./media.ts's posts and comments.
 *
 * A message is NEVER EDITED, by anyone. Rules allow no update except an
 * administrator's removal flag. See firestore.rules' community_messages
 * block for why.
 *
 * =====================================================================
 * ONE LISTENER, ON ONE PAGE
 * =====================================================================
 * A chat is the one surface in this app where real time is the product,
 * so this module does subscribe -- but to the NEWEST page only, bounded
 * by `limit(MESSAGES_PAGE_SIZE)`. History is fetched with plain reads,
 * one page at a time, and never listened to. So the standing cost is a
 * read when something in the last thirty messages changes, not a read
 * every time anything in a collection that grows forever changes.
 *
 * =====================================================================
 * WHY NOTHING IS INSERTED OPTIMISTICALLY
 * =====================================================================
 * The composer calls sendMessage() and clears the box. It does NOT push
 * a copy of the message into the list, because the Firestore SDK applies
 * a write locally and fires the snapshot BEFORE the server has seen it --
 * so the message already appears instantly, from the same code path that
 * renders everybody else's. Adding an optimistic row on top of that is
 * how a sent message appears twice and then flickers when the server
 * confirms it. The duplicate is prevented by construction, not by
 * de-duplicating afterwards.
 *
 * ORDER. Queried newest-first (`createdAt desc`) because that is the page
 * a limit() has to select, and rendered in an inverted list, which is
 * also what puts a growing conversation the right way up without
 * measuring anything. A message whose serverTimestamp() has not resolved
 * yet has a null `createdAt`; it is the one just sent, so it sorts to the
 * newest end -- see MESSAGE_PENDING_SORT_KEY.
 */
import {
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
} from 'firebase/firestore';
import { db } from './app';

export const COMMUNITY_MESSAGES_COLLECTION = 'community_messages';

/**
 * One screenful and a bit. Large enough that opening the chat shows a
 * conversation rather than a fragment, small enough that the standing
 * listener stays cheap.
 */
export const MESSAGES_PAGE_SIZE = 30;
export const MAX_MESSAGE_LENGTH = 2000;

export interface CommunityMessage {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  /** Null for the few hundred milliseconds before the server stamps it. */
  createdAt: Date | null;
  removed: boolean;
}

export type MessageCursor = QueryDocumentSnapshot<DocumentData>;

export interface MessagePage {
  messages: CommunityMessage[];
  /** Hand back to fetchOlderMessages. `null` when history is exhausted. */
  cursor: MessageCursor | null;
}

export function toCommunityMessage(
  id: string,
  data: Record<string, unknown>
): CommunityMessage | null {
  const { text } = data;
  if (typeof text !== 'string' || text.length === 0) return null;
  return {
    id,
    text,
    authorUid: typeof data.authorUid === 'string' ? data.authorUid : '',
    authorName:
      typeof data.authorName === 'string' && data.authorName.trim().length > 0
        ? data.authorName.trim()
        : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    removed: data.removed === true,
  };
}

/**
 * Where a message with no server timestamp yet sorts: the newest end.
 *
 * It is the message this device has just sent -- nothing else can have an
 * unresolved timestamp -- so putting it last in a newest-first list is
 * both correct and what the sender expects to see.
 */
export const MESSAGE_PENDING_SORT_KEY = Number.MAX_SAFE_INTEGER;

export function messageSortKey(message: CommunityMessage): number {
  return message.createdAt ? message.createdAt.getTime() : MESSAGE_PENDING_SORT_KEY;
}

/**
 * Merges a page of history into the messages already on screen, newest
 * first, with no duplicates.
 *
 * Exported and pure so ../../features/community/__tests__ can assert the
 * de-duplication directly. The live page and a history page can overlap
 * by a message or two when something is sent between the two reads; `id`
 * is the identity, and the LATER copy wins, because the live page's copy
 * of a message is the one that carries a removal an administrator has
 * just made.
 */
export function mergeMessages(
  existing: readonly CommunityMessage[],
  incoming: readonly CommunityMessage[]
): CommunityMessage[] {
  const byId = new Map<string, CommunityMessage>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => messageSortKey(b) - messageSortKey(a));
}

/**
 * Subscribes to the newest page of the conversation.
 *
 * `onNext` also receives the OLDEST snapshot in the live page, which is
 * the anchor history pages are read from -- the caller keeps the first
 * one it is given rather than the latest, because the live page's oldest
 * message slides forward as new ones arrive and a moving anchor would
 * skip messages.
 */
export function subscribeToRecentMessages(
  onNext: (messages: CommunityMessage[], oldest: MessageCursor | null) => void,
  onError: (error: FirestoreError) => void,
  pageSize: number = MESSAGES_PAGE_SIZE
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COMMUNITY_MESSAGES_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    ),
    (snapshot) => {
      const messages = snapshot.docs
        .map((d) => toCommunityMessage(d.id, d.data()))
        .filter((message): message is CommunityMessage => message !== null);
      const oldest = snapshot.docs[snapshot.docs.length - 1] ?? null;
      onNext(messages, oldest);
    },
    onError
  );
}

/**
 * One page of history, older than `cursor`. A plain read: history does
 * not change, so there is nothing to listen to.
 */
export async function fetchOlderMessages(
  cursor: MessageCursor,
  pageSize: number = MESSAGES_PAGE_SIZE
): Promise<MessagePage> {
  const snapshot = await getDocs(
    query(
      collection(db, COMMUNITY_MESSAGES_COLLECTION),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(pageSize)
    )
  );
  const messages = snapshot.docs
    .map((d) => toCommunityMessage(d.id, d.data()))
    .filter((message): message is CommunityMessage => message !== null);
  const last = snapshot.docs[snapshot.docs.length - 1];
  return {
    messages,
    cursor: snapshot.docs.length < pageSize ? null : (last ?? null),
  };
}

export async function sendMessage(input: {
  uid: string;
  authorName: string;
  text: string;
}): Promise<void> {
  await addDoc(collection(db, COMMUNITY_MESSAGES_COLLECTION), {
    text: input.text.trim(),
    authorUid: input.uid,
    authorName: input.authorName.trim(),
    createdAt: serverTimestamp(),
    // Written explicitly rather than left absent: firestore.rules
    // requires `removed == false` on creation, so a message can never
    // arrive already claiming to have been moderated.
    removed: false,
  });
}

/** A member withdrawing their own message. Hard delete: it was theirs. */
export async function deleteOwnMessage(messageId: string): Promise<void> {
  await deleteDoc(doc(db, COMMUNITY_MESSAGES_COLLECTION, messageId));
}
