/**
 * Firestore data layer for the mobile Plans feature -- a new V1 feature
 * added per explicit owner decision (Plans/Prayers/Community are genuine
 * new V1 features, not part of FINAL_ARCHITECTURE_SPECIFICATION.md's
 * original scope -- see PRODUCTION_READINESS.md).
 *
 * Mirrors mobile/src/services/firebase/announcements.ts's read-only,
 * published-only shape for the plan library itself, plus a private
 * per-owner progress record at users/{uid}/planProgress/{planId} (same
 * isOwner(userId)-only authorization boundary as ./prayers.ts).
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './app';

export interface PublishedPlan {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  dayCount: number;
}

export interface PublishedPlanDay {
  id: string;
  dayNumber: number;
  title: string;
  scriptureReference: string;
  devotional: string;
  prayerPrompt: string;
}

export interface PlanProgress {
  startedAt: Date | null;
  currentDay: number;
  completedDays: number[];
  lastReadAt: Date | null;
}

function toPublishedPlan(id: string, data: Record<string, unknown>): PublishedPlan {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    category: typeof data.category === 'string' ? data.category : '',
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
    dayCount: typeof data.dayCount === 'number' ? data.dayCount : 0,
  };
}

function toPublishedPlanDay(id: string, data: Record<string, unknown>): PublishedPlanDay {
  return {
    id,
    dayNumber: typeof data.dayNumber === 'number' ? data.dayNumber : 0,
    title: typeof data.title === 'string' ? data.title : '',
    scriptureReference: typeof data.scriptureReference === 'string' ? data.scriptureReference : '',
    devotional: typeof data.devotional === 'string' ? data.devotional : '',
    prayerPrompt: typeof data.prayerPrompt === 'string' ? data.prayerPrompt : '',
  };
}

function toPlanProgress(data: Record<string, unknown>): PlanProgress {
  return {
    startedAt: data.startedAt instanceof Timestamp ? data.startedAt.toDate() : null,
    currentDay: typeof data.currentDay === 'number' ? data.currentDay : 1,
    completedDays: Array.isArray(data.completedDays)
      ? data.completedDays.filter((n): n is number => typeof n === 'number')
      : [],
    lastReadAt: data.lastReadAt instanceof Timestamp ? data.lastReadAt.toDate() : null,
  };
}

/** Subscribes to every published plan, ordered for the library (see admin's `order` field). */
export function subscribeToPublishedPlans(
  onNext: (plans: PublishedPlan[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'plans'), where('published', '==', true), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPublishedPlan(d.id, d.data()))),
    onError
  );
}

/** Subscribes to a plan's days, ordered by dayNumber. Visibility follows the parent plan's published flag -- see firestore.rules' plans/{id}/days rule. */
export function subscribeToPlanDays(
  planId: string,
  onNext: (days: PublishedPlanDay[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'plans', planId, 'days'), orderBy('dayNumber', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toPublishedPlanDay(d.id, d.data()))),
    onError
  );
}

/** Subscribes to a member's own progress on a plan -- null while no progress document exists yet (plan not started). */
export function subscribeToPlanProgress(
  uid: string,
  planId: string,
  onNext: (progress: PlanProgress | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid, 'planProgress', planId),
    (snapshot) => onNext(snapshot.exists() ? toPlanProgress(snapshot.data()) : null),
    onError
  );
}

/** Creates a plan's progress document if one doesn't already exist -- does not overwrite existing progress (see getDoc guard). */
export async function startPlan(uid: string, planId: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'planProgress', planId);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  await setDoc(ref, {
    startedAt: serverTimestamp(),
    currentDay: 1,
    completedDays: [],
    lastReadAt: serverTimestamp(),
  });
}

export interface ActivePlanSummary {
  planId: string;
  plan: PublishedPlan;
  progress: PlanProgress;
}

/**
 * Subscribes to the member's most recently active plan (by lastReadAt),
 * resolving its plan document too -- backs the Home Screen's "Continue
 * your plan" card (see ../../features/auth/HomeScreen.tsx). `null` means
 * no plan has been started yet, matching subscribeToPlanProgress's own
 * "no progress document" contract.
 *
 * Queries the member's own planProgress subcollection directly (not a
 * collectionGroup query) -- this is scoped to one user's own documents,
 * ordered by a single field, so it needs no firestore.indexes.json entry
 * (same reasoning as ../../services/firebase/dailyVerses.ts's `date`
 * sort).
 */
export function subscribeToMostRecentPlanProgress(
  uid: string,
  onNext: (summary: ActivePlanSummary | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', uid, 'planProgress'),
    orderBy('lastReadAt', 'desc'),
    limit(1)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const first = snapshot.docs[0];
      if (!first) {
        onNext(null);
        return;
      }
      const progress = toPlanProgress(first.data());
      void getDoc(doc(db, 'plans', first.id)).then((planSnapshot) => {
        if (!planSnapshot.exists()) {
          onNext(null);
          return;
        }
        onNext({
          planId: first.id,
          plan: toPublishedPlan(planSnapshot.id, planSnapshot.data()),
          progress,
        });
      });
    },
    onError
  );
}

/** Marks a day complete and advances currentDay if this was the current day -- called from ../features/plans/PlanDayScreen.tsx. */
export async function markDayComplete(
  uid: string,
  planId: string,
  dayNumber: number,
  currentDay: number,
  completedDays: number[]
): Promise<void> {
  const nextCompleted = completedDays.includes(dayNumber)
    ? completedDays
    : [...completedDays, dayNumber];
  await updateDoc(doc(db, 'users', uid, 'planProgress', planId), {
    completedDays: nextCompleted,
    currentDay: dayNumber >= currentDay ? dayNumber + 1 : currentDay,
    lastReadAt: serverTimestamp(),
  });
}
