/**
 * Firestore + Storage data layer for admin reading-plan management -- a
 * new V1 feature added per explicit owner decision (see
 * ../../types/index.ts's Plan doc comment for provenance).
 *
 * A plan is /plans/{planId} plus a /plans/{planId}/days/{dayId}
 * subcollection (see firestore.rules' isValidPlan()/isValidPlanDay() for
 * the server-enforced shape of each). The subcollection shape means an
 * admin can add/edit/delete one day without rewriting the entire plan
 * document -- the tradeoff is that `dayCount` on the plan document must be
 * kept in sync by this file (every create/delete of a day recomputes and
 * writes it), since firestore.rules cannot count a subcollection's
 * documents without an unbounded read (see isValidPlan()'s comment).
 *
 * Every write here is followed by a logAdminAction call, same as
 * ./announcements.ts/./communityPosts.ts.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './app';
import { logAdminAction } from './auditLog';
import type { Plan, PlanDay, PlanDayFormInput, PlanFormInput } from '../../types';

const PLANS_COLLECTION = 'plans';

function toPlan(id: string, data: Record<string, unknown>): Plan {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    category: typeof data.category === 'string' ? data.category : '',
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
    dayCount: typeof data.dayCount === 'number' ? data.dayCount : 0,
    order: typeof data.order === 'number' ? data.order : 0,
    published: data.published === true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

function toPlanDay(id: string, data: Record<string, unknown>): PlanDay {
  return {
    id,
    dayNumber: typeof data.dayNumber === 'number' ? data.dayNumber : 0,
    title: typeof data.title === 'string' ? data.title : '',
    scriptureReference: typeof data.scriptureReference === 'string' ? data.scriptureReference : '',
    devotional: typeof data.devotional === 'string' ? data.devotional : '',
    prayerPrompt: typeof data.prayerPrompt === 'string' ? data.prayerPrompt : '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/** Subscribes to every plan, ordered for display (published first not required here -- admins see everything, sorted by `order`). */
export function subscribeToPlans(
  onNext: (plans: Plan[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, PLANS_COLLECTION), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPlan(d.id, d.data()))),
    onError
  );
}

/** New plans always start unpublished and with zero days -- see setPlanPublished / createPlanDay. */
export async function createPlan(input: PlanFormInput): Promise<string> {
  const title = input.title.trim();
  const docRef = await addDoc(collection(db, PLANS_COLLECTION), {
    title,
    description: input.description.trim(),
    category: input.category.trim(),
    coverImageUrl: input.coverImageUrl,
    dayCount: 0,
    order: input.order,
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'create',
    collection: 'plans',
    documentId: docRef.id,
    changeSummary: `Created plan "${title}"`,
  });
  return docRef.id;
}

export async function updatePlan(id: string, input: PlanFormInput): Promise<void> {
  const title = input.title.trim();
  await updateDoc(doc(db, PLANS_COLLECTION, id), {
    title,
    description: input.description.trim(),
    category: input.category.trim(),
    coverImageUrl: input.coverImageUrl,
    order: input.order,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'plans',
    documentId: id,
    changeSummary: `Updated plan "${title}"`,
  });
}

/** `title` is passed in (rather than re-read) because it's no longer available once the doc is deleted. Does not cascade-delete the days subcollection -- see this function's own doc note below. */
export async function deletePlan(id: string, title: string): Promise<void> {
  await deleteDoc(doc(db, PLANS_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'plans',
    documentId: id,
    changeSummary: `Deleted plan "${title}"`,
  });
  // Note: Firestore does not cascade-delete subcollections, and there is
  // no Cloud Function here to do it server-side (this project's Cloud
  // Functions are limited to what FINAL_ARCHITECTURE_SPECIFICATION.md
  // already specifies -- see functions/src/). A deleted plan's
  // /days documents become unreachable (no rule permits reading a day
  // whose parent plan doc no longer exists, since isValidPlanDay's
  // get() on the parent fails closed) but are not physically removed.
  // Acceptable at V1 scale; a cleanup Cloud Function can be added later
  // without any client-side change.
}

export async function setPlanPublished(id: string, title: string, published: boolean): Promise<void> {
  await updateDoc(doc(db, PLANS_COLLECTION, id), {
    published,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: published ? 'publish' : 'unpublish',
    collection: 'plans',
    documentId: id,
    changeSummary: `${published ? 'Published' : 'Unpublished'} plan "${title}"`,
  });
}

/** Uploads a plan cover image to Storage. Same emulator-only-until-Blaze limitation as ./announcements.ts's uploadAnnouncementImage. */
export async function uploadPlanCoverImage(file: File): Promise<string> {
  const path = `content/plans/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ---- Plan days (subcollection) --------------------------------------------

function daysCollection(planId: string) {
  return collection(db, PLANS_COLLECTION, planId, 'days');
}

/** Subscribes to a plan's days, ordered by dayNumber -- single-field sort, no firestore.indexes.json entry needed (same reasoning as daily_verses' `date` sort). */
export function subscribeToPlanDays(
  planId: string,
  onNext: (days: PlanDay[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(daysCollection(planId), orderBy('dayNumber', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPlanDay(d.id, d.data()))),
    onError
  );
}

/** Recomputes and writes the parent plan's dayCount from the real days subcollection -- see this module's header comment for why this can't be enforced by firestore.rules directly. */
async function syncPlanDayCount(planId: string): Promise<void> {
  const snapshot = await getDocs(daysCollection(planId));
  await updateDoc(doc(db, PLANS_COLLECTION, planId), {
    dayCount: snapshot.size,
    updatedAt: serverTimestamp(),
  });
}

export async function createPlanDay(planId: string, planTitle: string, input: PlanDayFormInput): Promise<string> {
  const docRef = await addDoc(daysCollection(planId), {
    dayNumber: input.dayNumber,
    title: input.title.trim(),
    scriptureReference: input.scriptureReference.trim(),
    devotional: input.devotional.trim(),
    prayerPrompt: input.prayerPrompt.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await syncPlanDayCount(planId);
  await logAdminAction({
    action: 'create',
    collection: 'plans',
    documentId: `${planId}/days/${docRef.id}`,
    changeSummary: `Added day ${input.dayNumber} to plan "${planTitle}"`,
  });
  return docRef.id;
}

export async function updatePlanDay(
  planId: string,
  planTitle: string,
  dayId: string,
  input: PlanDayFormInput
): Promise<void> {
  await updateDoc(doc(db, PLANS_COLLECTION, planId, 'days', dayId), {
    dayNumber: input.dayNumber,
    title: input.title.trim(),
    scriptureReference: input.scriptureReference.trim(),
    devotional: input.devotional.trim(),
    prayerPrompt: input.prayerPrompt.trim(),
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'plans',
    documentId: `${planId}/days/${dayId}`,
    changeSummary: `Updated day ${input.dayNumber} of plan "${planTitle}"`,
  });
}

export async function deletePlanDay(
  planId: string,
  planTitle: string,
  dayId: string,
  dayNumber: number
): Promise<void> {
  await deleteDoc(doc(db, PLANS_COLLECTION, planId, 'days', dayId));
  await syncPlanDayCount(planId);
  await logAdminAction({
    action: 'delete',
    collection: 'plans',
    documentId: `${planId}/days/${dayId}`,
    changeSummary: `Removed day ${dayNumber} from plan "${planTitle}"`,
  });
}
