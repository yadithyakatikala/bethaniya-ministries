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
 *
 * =====================================================================
 * THE FIVE STARTER PLANS SHIP WITH THE APP
 * =====================================================================
 * ../../features/plans/seedPlans.ts has defined five reading plans since
 * V1, but nothing except its own test ever imported them: they reached
 * members only if somebody ran scripts/seed-plans.mjs against production
 * Firestore with credentials. Nobody had, so a member who tapped "Start a
 * Reading Plan" got "No reading plans yet" -- a finished feature that
 * looked unbuilt.
 *
 * The bundled plans are therefore a FALLBACK here, in the one module that
 * already owns the Firestore-to-domain mapping. Every consumer -- the
 * library, a plan's days, Home's "continue your plan" card -- gets them
 * without re-implementing the decision.
 *
 * FIRESTORE ALWAYS WINS. The fallback applies only when the collection
 * comes back EMPTY. The moment a content admin publishes one real plan,
 * the bundled five disappear and the church's own library is what members
 * see. There is no merge, and no way for a bundled plan to shadow an
 * administrator's.
 *
 * PROGRESS IS UNAFFECTED. Seed plan ids are stable slugs
 * ('seven-days-in-the-psalms'), so users/{uid}/planProgress/{planId}
 * behaves exactly as it does for a Firestore plan -- and keeps working if
 * that same plan is later seeded into Firestore under the same id, which
 * is what scripts/seed-plans.mjs does.
 *
 * NOTHING IS WRITTEN, and no rule changes. This is a read-side fallback
 * over data already compiled into the app, the same shape as the bundled
 * Bible in ../../features/bible/.
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
import { SEED_PLANS } from '../../features/plans/seedPlans';

/**
 * The bundled plans, in the shape the app reads them.
 *
 * Built once at module load. The ids are the seed slugs, so a bundled
 * plan and its later-seeded Firestore twin are the same plan as far as a
 * member's saved progress is concerned.
 */
const BUNDLED_PLANS: PublishedPlan[] = SEED_PLANS.map((seed) => ({
  id: seed.id,
  ...seed.plan,
}));

/**
 * A bundled plan's days, keyed by plan id, with a synthetic day id.
 *
 * `${planId}-day-${n}` mirrors what scripts/seed-plans.mjs writes, so a
 * screen keyed on the day id behaves the same whether the plan came from
 * Firestore or from here.
 */
const BUNDLED_PLAN_DAYS: Record<string, PublishedPlanDay[]> = Object.fromEntries(
  SEED_PLANS.map((seed) => [
    seed.id,
    seed.days.map((day) => ({ id: `${seed.id}-day-${day.dayNumber}`, ...day })),
  ])
);

/** Whether this id belongs to a plan that shipped with the app. */
export function isBundledPlanId(planId: string): boolean {
  return planId in BUNDLED_PLAN_DAYS;
}

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
    scriptureReference:
      typeof data.scriptureReference === 'string' ? data.scriptureReference : '',
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
  const q = query(
    collection(db, 'plans'),
    where('published', '==', true),
    orderBy('order', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const published = snapshot.docs.map((d) => toPublishedPlan(d.id, d.data()));
      // Only when the church has published NONE. One real plan and the
      // bundled five step aside -- see this file's header.
      onNext(published.length > 0 ? published : BUNDLED_PLANS);
    },
    // A failed read also falls back, rather than leaving a member who is
    // offline staring at an error for content the app is carrying.
    (error) => {
      onNext(BUNDLED_PLANS);
      onError(error);
    }
  );
}

/** Subscribes to a plan's days, ordered by dayNumber. Visibility follows the parent plan's published flag -- see firestore.rules' plans/{id}/days rule. */
export function subscribeToPlanDays(
  planId: string,
  onNext: (days: PublishedPlanDay[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const bundled = BUNDLED_PLAN_DAYS[planId];
  const q = query(collection(db, 'plans', planId, 'days'), orderBy('dayNumber', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const days = snapshot.docs.map((d) => toPublishedPlanDay(d.id, d.data()));
      // Same rule as the library above, per plan: a plan that exists in
      // Firestore with real days shows those, and a bundled plan nobody
      // has seeded shows the days it shipped with.
      onNext(days.length > 0 ? days : (bundled ?? []));
    },
    (error) => {
      if (bundled) onNext(bundled);
      onError(error);
    }
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
      // The bundled plan with this id, if there is one. Resolved BEFORE
      // the read, so a member who started a plan that ships with the app
      // still gets their "Continue your plan" card -- the plan document
      // genuinely does not exist in Firestore, and returning null here
      // would make the card vanish the moment they started reading.
      const bundled = BUNDLED_PLANS.find((plan) => plan.id === first.id) ?? null;
      void getDoc(doc(db, 'plans', first.id))
        .then((planSnapshot) => {
          if (planSnapshot.exists()) {
            onNext({
              planId: first.id,
              plan: toPublishedPlan(planSnapshot.id, planSnapshot.data()),
              progress,
            });
            return;
          }
          // No Firestore plan. Either it is a bundled one, or it is a
          // plan an administrator has since deleted -- in which case
          // there is nothing to continue and null is still right.
          onNext(bundled ? { planId: first.id, plan: bundled, progress } : null);
        })
        .catch(() => {
          onNext(bundled ? { planId: first.id, plan: bundled, progress } : null);
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
