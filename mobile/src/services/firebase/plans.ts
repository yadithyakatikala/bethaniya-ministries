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
 *
 * =====================================================================
 * PLANS THE ADMIN SITE PUBLISHES
 * =====================================================================
 * The admin site's plan manager (admin/src/features/plans/) writes the
 * plans members read here. Two kinds are visible to a member
 * (firestore.rules' isPlanReadableByMembers()):
 *
 *   published   `published == true`. Read by the library query below.
 *   scheduled   `status == 'scheduled'` and `publishAt` has passed, by the
 *               SERVER's clock. There is no server job on the Spark plan to
 *               flip the flag, so the phone asks for these separately
 *               (subscribeToDuePlans) and merges them in.
 *
 * Drafts and archived plans are never returned: the rules refuse any
 * member query that could reach them, so nothing here has to hide them.
 * Plans written before the manager existed have no `status`, `language`,
 * `author` or `order`; every field below degrades to a sensible default.
 *
 * A member's progress is keyed by the plan's id, which the manager never
 * changes, so unpublishing and publishing again, or editing a plan, keeps
 * everyone's place.
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
const BUNDLED_PLANS: PublishedPlan[] = SEED_PLANS.map((seed, index) => ({
  id: seed.id,
  subtitle: '',
  // They are written in English, which is what the library says beside
  // one in a Telugu app.
  language: 'en',
  estimatedMinutes: null,
  author: '',
  order: index,
  ...seed.plan,
}));

/** A bundled plan by id -- for a member who started one and whose library no longer lists it. */
export function getBundledPlan(planId: string): PublishedPlan | undefined {
  return BUNDLED_PLANS.find((plan) => plan.id === planId);
}

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
    seed.days.map((day) => ({
      id: `${seed.id}-day-${day.dayNumber}`,
      reflectionQuestion: '',
      application: '',
      notes: '',
      ...day,
    })),
  ])
);

/** Whether this id belongs to a plan that shipped with the app. */
export function isBundledPlanId(planId: string): boolean {
  return planId in BUNDLED_PLAN_DAYS;
}

/** The languages a plan can be written in: the two the app supports. */
export type PlanLanguage = 'en' | 'te';

export interface PublishedPlan {
  id: string;
  title: string;
  /** A short line under the title. '' when the church wrote none. */
  subtitle: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  dayCount: number;
  /** The language the plan is written in, when the church said. A plan from before the plan manager has none. */
  language: PlanLanguage | null;
  /** About how many minutes a day takes, when the church said. */
  estimatedMinutes: number | null;
  /** Who wrote it. '' when not given. */
  author: string;
  /** Where the church put it in the library; lower comes first. 0 for a plan with none. */
  order: number;
}

export interface PublishedPlanDay {
  id: string;
  dayNumber: number;
  title: string;
  scriptureReference: string;
  /** Every one of these, from here on, is optional: '' when the church left it out. */
  devotional: string;
  reflectionQuestion: string;
  application: string;
  prayerPrompt: string;
  notes: string;
}

export interface PlanProgress {
  startedAt: Date | null;
  currentDay: number;
  completedDays: number[];
  lastReadAt: Date | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A plan document -> what the app reads. Written to accept ANY plan ever
 * stored: a missing or wrongly typed field becomes its default and never
 * throws, so one odd document cannot blank the library.
 */
export function toPublishedPlan(
  id: string,
  data: Record<string, unknown>
): PublishedPlan {
  const minutes = finiteNumber(data.estimatedMinutes);
  return {
    id,
    title: text(data.title),
    subtitle: text(data.subtitle),
    description: text(data.description),
    category: text(data.category),
    coverImageUrl:
      typeof data.coverImageUrl === 'string' && data.coverImageUrl.length > 0
        ? data.coverImageUrl
        : null,
    dayCount: finiteNumber(data.dayCount) ?? 0,
    language: data.language === 'en' || data.language === 'te' ? data.language : null,
    estimatedMinutes: minutes !== null && minutes > 0 ? minutes : null,
    author: text(data.author),
    order: finiteNumber(data.order) ?? 0,
  };
}

export function toPublishedPlanDay(
  id: string,
  data: Record<string, unknown>
): PublishedPlanDay {
  return {
    id,
    dayNumber: typeof data.dayNumber === 'number' ? data.dayNumber : 0,
    title: text(data.title),
    scriptureReference: text(data.scriptureReference),
    devotional: text(data.devotional),
    reflectionQuestion: text(data.reflectionQuestion),
    application: text(data.application),
    prayerPrompt: text(data.prayerPrompt),
    notes: text(data.notes),
  };
}

/** Library order: the church's number, then the title. */
export function comparePublishedPlans(a: PublishedPlan, b: PublishedPlan): number {
  return a.order - b.order || a.title.localeCompare(b.title);
}

/** The library: plans with the same id are one plan, and the church's order decides the rest. */
function mergePlans(...lists: readonly PublishedPlan[][]): PublishedPlan[] {
  const byId = new Map<string, PublishedPlan>();
  for (const list of lists) for (const plan of list) byId.set(plan.id, plan);
  return [...byId.values()].sort(comparePublishedPlans);
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

/**
 * How far behind the phone's own clock the "due" bound is set. The server
 * refuses a bound later than its own clock (a phone's clock can run a little
 * fast), and a plan opening a minute after its time is no loss.
 */
const DUE_MARGIN_MS = 60_000;
/** The bound used once, after the server refuses the first: a phone well ahead of the server. */
const DUE_RETRY_MARGIN_MS = 10 * 60_000;
/** How often an open library asks again, so a plan whose time arrives meanwhile appears. */
const DUE_REFRESH_MS = 5 * 60_000;

export interface PlanLibraryOptions {
  /** The clock, for tests. */
  now?: () => Date;
}

/**
 * Subscribes to the scheduled plans whose time has come.
 *
 * This is a second query because the rules open a scheduled plan on the
 * SERVER's clock (`publishAt <= request.time`) and a query can only ask for
 * what the rules can prove it may read: "scheduled, and due by <a time not
 * later than the server's>". It needs the (status, publishAt) index in
 * firestore.indexes.json.
 *
 * It is quiet by design. If it fails -- offline, an index not yet built, the
 * rules not yet deployed -- scheduled plans simply do not appear; the library
 * of published plans is unaffected and no error reaches the member. The bound
 * moves forward every few minutes, so a plan whose time arrives while the
 * library is open is picked up without reopening it.
 */
function subscribeToDuePlans(
  onNext: (plans: PublishedPlan[]) => void,
  now: () => Date
): Unsubscribe {
  let stopped = false;
  let unsubscribe: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function listen(marginMs: number, mayRetryEarlier: boolean) {
    unsubscribe?.();
    const bound = Timestamp.fromDate(new Date(now().getTime() - marginMs));
    unsubscribe = onSnapshot(
      query(
        collection(db, 'plans'),
        where('status', '==', 'scheduled'),
        where('publishAt', '<=', bound)
      ),
      (snapshot) => {
        if (!stopped) onNext(snapshot.docs.map((d) => toPublishedPlan(d.id, d.data())));
      },
      (error) => {
        if (stopped) return;
        if (mayRetryEarlier && error.code === 'permission-denied') {
          listen(DUE_RETRY_MARGIN_MS, false);
          return;
        }
        onNext([]);
      }
    );
  }

  function scheduleRefresh() {
    timer = setTimeout(() => {
      if (stopped) return;
      listen(DUE_MARGIN_MS, true);
      scheduleRefresh();
    }, DUE_REFRESH_MS);
    // Never keep a process alive for a refresh (Node, in tests).
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  listen(DUE_MARGIN_MS, true);
  scheduleRefresh();

  return () => {
    stopped = true;
    unsubscribe?.();
    if (timer) clearTimeout(timer);
  };
}

/**
 * Subscribes to the plans a member may read: every published plan, plus the
 * scheduled ones whose time has come, in the church's order.
 *
 * The published query asks for nothing in particular about `order`: asking
 * Firestore to order by a field silently leaves out every document without
 * it, and a plan from before the plan manager (or one the starter-plan
 * script wrote) has none. The sort happens here instead, so such a plan is
 * listed (first, as order 0) rather than invisible.
 */
export function subscribeToPublishedPlans(
  onNext: (plans: PublishedPlan[]) => void,
  onError: (error: FirestoreError) => void,
  options: PlanLibraryOptions = {}
): Unsubscribe {
  const now = options.now ?? (() => new Date());
  let published: PublishedPlan[] | null = null;
  let due: PublishedPlan[] = [];

  function emit() {
    if (published === null) return;
    const library = mergePlans(published, due);
    // Only when the church has published NONE. One real plan and the
    // bundled five step aside -- see this file's header.
    onNext(library.length > 0 ? library : BUNDLED_PLANS);
  }

  const stopPublished = onSnapshot(
    query(collection(db, 'plans'), where('published', '==', true)),
    (snapshot) => {
      published = snapshot.docs.map((d) => toPublishedPlan(d.id, d.data()));
      emit();
    },
    // A failed read also falls back, rather than leaving a member who is
    // offline staring at an error for content the app is carrying.
    (error) => {
      onNext(BUNDLED_PLANS);
      onError(error);
    }
  );
  const stopDue = subscribeToDuePlans((plans) => {
    due = plans;
    emit();
  }, now);

  return () => {
    stopPublished();
    stopDue();
  };
}

/** Subscribes to a plan's days, ordered by dayNumber. A plan's days are readable exactly when the plan is (published, or scheduled and due) -- see firestore.rules' plans/{id}/days rule. */
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

/**
 * How many plans the member has started -- the number on the Saved tab's
 * "Reading plans" row. A count of the documents under their own
 * `planProgress`, read as one small listener; nothing about a plan is
 * fetched.
 */
export function subscribeToStartedPlanCount(
  uid: string,
  onNext: (count: number) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'planProgress'),
    (snapshot) => onNext(snapshot.docs.length),
    onError
  );
}

/**
 * The member's progress on EVERY plan they have started, keyed by plan id --
 * what sorts the Bible's Plans view into "My plans" (started, not finished),
 * "Find plans" (not started) and "Completed". One small listener on their own
 * `planProgress` collection; no plan document is fetched (the library already
 * holds them).
 */
export function subscribeToAllPlanProgress(
  uid: string,
  onNext: (progress: Record<string, PlanProgress>) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'planProgress'),
    (snapshot) => {
      const all: Record<string, PlanProgress> = {};
      snapshot.docs.forEach((d) => {
        all[d.id] = toPlanProgress(d.data());
      });
      onNext(all);
    },
    onError
  );
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
