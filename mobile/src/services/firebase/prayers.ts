/**
 * Firestore data layer for the Prayers feature -- a new V1 feature added
 * per explicit owner decision (Plans/Prayers/Community are genuine new V1
 * features, not part of FINAL_ARCHITECTURE_SPECIFICATION.md's original
 * scope -- see PRODUCTION_READINESS.md).
 *
 * Prayer requests are fully private per-owner: `users/{uid}/prayers/{id}`,
 * never admin-managed or shared with anyone else (see firestore.rules'
 * `users/{userId}/prayers` rule -- isOwner(userId) is the entire
 * authorization boundary, same as the parent /users/{userId} document
 * itself). There is no audit-log call here, unlike the admin CRUD
 * services -- logAdminAction() exists to record admin actions on shared
 * content, not a member's own private data.
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

export interface Prayer {
  id: string;
  text: string;
  answered: boolean;
  createdAt: Date | null;
  answeredAt: Date | null;
}

function toPrayer(id: string, data: Record<string, unknown>): Prayer {
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    answered: data.answered === true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    answeredAt: data.answeredAt instanceof Timestamp ? data.answeredAt.toDate() : null,
  };
}

function prayersCollection(uid: string) {
  return collection(db, 'users', uid, 'prayers');
}

/** Subscribes to a member's own prayers, newest first. */
export function subscribeToPrayers(
  uid: string,
  onNext: (prayers: Prayer[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(prayersCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPrayer(d.id, d.data()))),
    onError
  );
}

export async function createPrayer(uid: string, text: string): Promise<string> {
  const docRef = await addDoc(prayersCollection(uid), {
    text: text.trim(),
    answered: false,
    createdAt: serverTimestamp(),
    answeredAt: null,
  });
  return docRef.id;
}

export async function setPrayerAnswered(
  uid: string,
  prayerId: string,
  answered: boolean
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'prayers', prayerId), {
    answered,
    answeredAt: answered ? serverTimestamp() : null,
  });
}

export async function deletePrayer(uid: string, prayerId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'prayers', prayerId));
}
