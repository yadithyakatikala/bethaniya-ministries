/**
 * Firestore data layer for the reading-plan manager.
 *
 * =====================================================================
 * THE SHAPE
 * =====================================================================
 * A plan is /plans/{planId} plus a /plans/{planId}/days/{dayId}
 * subcollection (see firestore.rules' isValidPlan()/isValidPlanDay()). The
 * subcollection keeps a year-long plan well under the 1 MB document limit;
 * the cost is that `dayCount` on the plan must be kept in step with the
 * days, which this file does on every save (it is always `days.length`,
 * never typed).
 *
 * `planId` is the plan's unique, human-readable id ("seven-days-in-the-
 * psalms"), chosen on create and never changed: members' saved progress is
 * stored under it (users/{uid}/planProgress/{planId}), so renaming a plan's
 * id would orphan every member's place in it. The title can change freely.
 *
 * =====================================================================
 * SAVING IS ONE ACTION OVER THE WHOLE PLAN
 * =====================================================================
 * The editor holds the details and every day in memory; savePlan() writes
 * them together. The order of writes is deliberate:
 *
 *   1. check the plan can be created / has not changed under the editor,
 *   2. write the DAYS (only the ones that changed) and remove deleted ones,
 *   3. write the PLAN document last, with the new dayCount and status.
 *
 * Last, because the plan document is what makes everything visible. A
 * plan being published is therefore never live ahead of its days, a failed
 * save leaves the plan's own status and `updatedAt` as they were (so the
 * administrator can simply press Save again), and a create that fails
 * midway leaves only unreachable days, which are cleaned up.
 *
 * DAYS ARE WRITTEN IN SMALL BATCHES, NOT ONE BIG ONE. A batched write
 * shares a budget of 20 security-rule lookups, and each write here costs
 * the rules up to two (the caller's role). Ten writes per batch can never
 * exceed it, however the rules cache; a bigger batch would work in the
 * emulator and might be refused in production. The price is that a plan of
 * several hundred days is saved in a few dozen round trips instead of one.
 * Every write is idempotent and computed against the plan as it was
 * LOADED, so pressing Save again after a failure converges.
 *
 * Every write is followed by a logAdminAction call, as for every other
 * collection.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  type WriteBatch,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './app';
import { logAdminAction, type AuditAction } from './auditLog';
import type { Plan, PlanDay, PlanLanguage, PlanStatus } from '../../types';
import {
  formatScheduleTime,
  planStatusOf,
  statusFieldsFor,
  storedStatusOf,
  unchangedStatusFields,
  type PlanStatusChange,
  type StatusFieldsToWrite,
} from '../../features/plans/planStatus';
import { dayForStorage, type DayDraft } from '../../features/plans/planDays';
import type { PlanDetailsValues } from '../../features/plans/planDetails';

const PLANS_COLLECTION = 'plans';

/** See this module's header: ten writes can never exceed the batch's rule-lookup budget. */
export const WRITES_PER_BATCH = 10;

// ---- Reading ----------------------------------------------------------

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const STATUSES: readonly PlanStatus[] = ['draft', 'scheduled', 'published', 'archived'];

export function toPlan(id: string, data: Record<string, unknown>): Plan {
  const status = data.status;
  const language = data.language;
  const minutes = data.estimatedMinutes;
  return {
    id,
    title: text(data.title),
    subtitle: text(data.subtitle),
    description: text(data.description),
    category: text(data.category),
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
    language: language === 'en' || language === 'te' ? (language as PlanLanguage) : null,
    estimatedMinutes: typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : null,
    author: text(data.author),
    dayCount: typeof data.dayCount === 'number' ? data.dayCount : 0,
    order: typeof data.order === 'number' ? data.order : 0,
    published: data.published === true,
    status:
      typeof status === 'string' && (STATUSES as readonly string[]).includes(status)
        ? (status as PlanStatus)
        : null,
    publishAt: toDate(data.publishAt),
    publishedAt: toDate(data.publishedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toPlanDay(id: string, data: Record<string, unknown>): PlanDay {
  return {
    id,
    dayNumber: typeof data.dayNumber === 'number' ? data.dayNumber : 0,
    title: text(data.title),
    scriptureReference: text(data.scriptureReference),
    devotional: text(data.devotional),
    reflectionQuestion: text(data.reflectionQuestion),
    prayerPrompt: text(data.prayerPrompt),
    application: text(data.application),
    notes: text(data.notes),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/** Library order: the `order` field, then the title. */
export function comparePlans(a: Plan, b: Plan): number {
  return a.order - b.order || a.title.localeCompare(b.title);
}

/**
 * Subscribes to every plan. Sorted here, not by the query: a query ordered
 * by `order` silently leaves out any plan that has none (a plan loaded by
 * the starter-plan script, say), and an administrator must see everything.
 */
export function subscribeToPlans(
  onNext: (plans: Plan[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, PLANS_COLLECTION)),
    (snapshot) =>
      onNext(snapshot.docs.map((d) => toPlan(d.id, d.data())).sort(comparePlans)),
    onError
  );
}

export interface LoadedPlan {
  plan: Plan;
  /** In day order. */
  days: PlanDay[];
}

function daysCollection(planId: string) {
  return collection(db, PLANS_COLLECTION, planId, 'days');
}

/** The plan and all its days, or null if there is no such plan. */
export async function loadPlanForEditing(planId: string): Promise<LoadedPlan | null> {
  const snapshot = await getDoc(doc(db, PLANS_COLLECTION, planId));
  if (!snapshot.exists()) return null;
  const days = await getDocs(daysCollection(planId));
  return {
    plan: toPlan(snapshot.id, snapshot.data()),
    days: days.docs
      .map((d) => toPlanDay(d.id, d.data()))
      .sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

/** Just the plan document, for refreshing after a change that touched only it. */
export async function loadPlanDocument(planId: string): Promise<Plan | null> {
  const snapshot = await getDoc(doc(db, PLANS_COLLECTION, planId));
  return snapshot.exists() ? toPlan(snapshot.id, snapshot.data()) : null;
}

export async function planIdExists(planId: string): Promise<boolean> {
  return (await getDoc(doc(db, PLANS_COLLECTION, planId))).exists();
}

/** A fresh id for a day that has not been saved yet. Generated locally; no network. */
export function newDayId(planId: string): string {
  return doc(daysCollection(planId)).id;
}

// ---- Errors the editor reports in words -------------------------------

export class PlanIdTakenError extends Error {
  readonly planId: string;
  constructor(planId: string) {
    super(`A plan with the ID "${planId}" already exists.`);
    this.name = 'PlanIdTakenError';
    this.planId = planId;
  }
}

export class PlanMissingError extends Error {
  readonly planId: string;
  constructor(planId: string) {
    super(`The plan "${planId}" no longer exists.`);
    this.name = 'PlanMissingError';
    this.planId = planId;
  }
}

/** The plan was saved by someone else after this editor loaded it. */
export class PlanConflictError extends Error {
  readonly planId: string;
  constructor(planId: string) {
    super(`The plan "${planId}" was changed by someone else while you were editing it.`);
    this.name = 'PlanConflictError';
    this.planId = planId;
  }
}

// ---- Writing ----------------------------------------------------------

type WriteOp = (batch: WriteBatch) => void;

/** Commits writes in batches of WRITES_PER_BATCH, in order. */
async function commitInChunks(ops: readonly WriteOp[]): Promise<void> {
  for (let start = 0; start < ops.length; start += WRITES_PER_BATCH) {
    const batch = writeBatch(db);
    for (const op of ops.slice(start, start + WRITES_PER_BATCH)) op(batch);
    await batch.commit();
  }
}

function statusToStored(fields: StatusFieldsToWrite) {
  return {
    status: fields.status,
    published: fields.published,
    publishAt: fields.publishAt ? Timestamp.fromDate(fields.publishAt) : null,
  };
}

/** True when the stored plan's updatedAt is not the one the editor loaded. */
function changedSince(data: Record<string, unknown>, loadedUpdatedAt: Date | null): boolean {
  const current = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : null;
  const loaded = loadedUpdatedAt ? loadedUpdatedAt.getTime() : null;
  return current !== loaded;
}

/** A day to write: its id is fixed BEFORE the first attempt, so a retry overwrites rather than duplicates. */
export interface DayToSave extends DayDraft {
  id: string;
}

export interface SavePlanInput {
  mode: 'create' | 'edit';
  planId: string;
  details: PlanDetailsValues;
  /** In order: a day's number is its position. */
  days: readonly DayToSave[];
  /** The plan as the editor loaded it. Required to edit. */
  loaded: LoadedPlan | null;
  /** What to do to the status; null leaves it as it is (a new plan starts as a draft). */
  status: PlanStatusChange | null;
  uid: string;
}

function samePayload(
  day: PlanDay,
  number: number,
  payload: ReturnType<typeof dayForStorage>
): boolean {
  return (
    day.dayNumber === number &&
    day.title === payload.title &&
    day.scriptureReference === payload.scriptureReference &&
    day.devotional === payload.devotional &&
    day.reflectionQuestion === payload.reflectionQuestion &&
    day.prayerPrompt === payload.prayerPrompt &&
    day.application === payload.application &&
    day.notes === payload.notes
  );
}

function auditFor(
  mode: 'create' | 'edit',
  title: string,
  status: PlanStatusChange | null,
  before: PlanStatus | null,
  dayCount: number
): { action: AuditAction; summary: string } {
  const days = `${dayCount} day${dayCount === 1 ? '' : 's'}`;
  if (status?.to === 'published') {
    return { action: 'publish', summary: `Published plan "${title}" (${days})` };
  }
  if (status?.to === 'scheduled') {
    return {
      action: 'update',
      summary: `Scheduled plan "${title}" (${days}) to open ${formatScheduleTime(status.publishAt)}`,
    };
  }
  if (status?.to === 'archived') {
    return {
      action: before === 'published' ? 'unpublish' : 'update',
      summary: `Archived plan "${title}"`,
    };
  }
  if (status?.to === 'draft' && (before === 'published' || before === 'scheduled')) {
    return { action: 'unpublish', summary: `Unpublished plan "${title}"` };
  }
  return mode === 'create'
    ? { action: 'create', summary: `Created plan "${title}" (${days})` }
    : { action: 'update', summary: `Updated plan "${title}" (${days})` };
}

/**
 * Writes a plan and all its days. See the module header for the order of
 * writes and why. Throws PlanIdTakenError, PlanMissingError or
 * PlanConflictError for the three ways the plan can be wrong underneath the
 * editor; anything else is a Firestore error and is safe to retry.
 */
export async function savePlan(input: SavePlanInput): Promise<void> {
  const { mode, planId, details, days, loaded, status, uid } = input;
  const planRef = doc(db, PLANS_COLLECTION, planId);

  const first = await getDoc(planRef);
  if (mode === 'create' && first.exists()) throw new PlanIdTakenError(planId);
  if (mode === 'edit') {
    if (!first.exists()) throw new PlanMissingError(planId);
    if (!loaded || changedSince(first.data(), loaded.plan.updatedAt)) {
      throw new PlanConflictError(planId);
    }
  }

  // ---- 1. The days ----------------------------------------------------
  const previous = new Map((loaded?.days ?? []).map((day) => [day.id, day]));
  const kept = new Set<string>();
  const dayOps: WriteOp[] = [];
  const written: string[] = [];

  days.forEach((draft, index) => {
    const dayNumber = index + 1;
    const payload = dayForStorage(draft);
    const ref = doc(daysCollection(planId), draft.id);
    const before = previous.get(draft.id);
    kept.add(draft.id);
    if (before && samePayload(before, dayNumber, payload)) return;
    written.push(draft.id);
    if (before) {
      dayOps.push((batch) =>
        batch.set(
          ref,
          { dayNumber, ...payload, updatedAt: serverTimestamp() },
          { merge: true }
        )
      );
    } else {
      dayOps.push((batch) =>
        batch.set(ref, {
          dayNumber,
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });
  for (const day of loaded?.days ?? []) {
    if (kept.has(day.id)) continue;
    dayOps.push((batch) => batch.delete(doc(daysCollection(planId), day.id)));
  }

  try {
    await commitInChunks(dayOps);
  } catch (error) {
    if (mode === 'create') await removeDays(planId, written).catch(() => undefined);
    throw error;
  }

  // ---- 2. The plan, last ---------------------------------------------
  const current = loaded?.plan ?? null;
  const fields: StatusFieldsToWrite = status
    ? statusFieldsFor(status)
    : current
      ? unchangedStatusFields(current)
      : statusFieldsFor({ to: 'draft' });
  // `publishedAt` records the moment a plan FIRST went live. A plan that is
  // already live when it is saved (including one from before the manager,
  // which never recorded a time) keeps what it has: stamping it now would
  // claim it went live today.
  const becomesPublished =
    fields.status === 'published' &&
    (current === null || storedStatusOf(current) !== 'published');

  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(planRef);
    if (mode === 'create' && snapshot.exists()) throw new PlanIdTakenError(planId);
    if (mode === 'edit') {
      if (!snapshot.exists()) throw new PlanMissingError(planId);
      if (changedSince(snapshot.data(), loaded?.plan.updatedAt ?? null)) {
        throw new PlanConflictError(planId);
      }
    }

    const alreadyPublishedAt = snapshot.exists() ? snapshot.data().publishedAt : null;
    const body = {
      ...details,
      dayCount: days.length,
      ...statusToStored(fields),
      ...(becomesPublished && !(alreadyPublishedAt instanceof Timestamp)
        ? { publishedAt: serverTimestamp() }
        : {}),
      updatedAt: serverTimestamp(),
    };
    if (mode === 'create') {
      tx.set(planRef, {
        ...body,
        publishedAt: becomesPublished ? serverTimestamp() : null,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
    } else {
      tx.update(planRef, body);
    }
  });

  const audit = auditFor(
    mode,
    details.title,
    status,
    current ? planStatusOf(current, new Date()) : null,
    days.length
  );
  await logAdminAction({
    action: audit.action,
    collection: 'plans',
    documentId: planId,
    changeSummary: audit.summary,
  });
}

/** Deletes day documents by id, in small batches. */
async function removeDays(planId: string, ids: readonly string[]): Promise<void> {
  await commitInChunks(
    ids.map((id) => (batch: WriteBatch) => batch.delete(doc(daysCollection(planId), id)))
  );
}

/**
 * Changes only a plan's status -- the quick actions on the list. The
 * caller has already checked the plan is ready if it is going live. The
 * real number of days is counted here, so `dayCount` cannot be stale.
 */
export async function setPlanStatus(
  plan: Pick<Plan, 'id' | 'title' | 'status' | 'published' | 'publishAt'>,
  change: PlanStatusChange
): Promise<void> {
  const days = await getDocs(daysCollection(plan.id));
  const fields = statusFieldsFor(change);
  const before = planStatusOf(plan, new Date());
  const snapshot = await getDoc(doc(db, PLANS_COLLECTION, plan.id));
  if (!snapshot.exists()) throw new PlanMissingError(plan.id);
  const alreadyPublishedAt = snapshot.data().publishedAt;

  await updateDoc(doc(db, PLANS_COLLECTION, plan.id), {
    ...statusToStored(fields),
    dayCount: days.size,
    ...(fields.status === 'published' && !(alreadyPublishedAt instanceof Timestamp)
      ? { publishedAt: serverTimestamp() }
      : {}),
    updatedAt: serverTimestamp(),
  });

  const audit = auditFor('edit', plan.title, change, before, days.size);
  await logAdminAction({
    action: audit.action,
    collection: 'plans',
    documentId: plan.id,
    changeSummary: audit.summary,
  });
}

export interface DuplicatePlanInput {
  sourceId: string;
  newId: string;
  newTitle: string;
  uid: string;
}

/** A copy of a plan, and all its days, as a new DRAFT. */
export async function duplicatePlan(input: DuplicatePlanInput): Promise<void> {
  const { sourceId, newId, newTitle, uid } = input;
  const source = await loadPlanForEditing(sourceId);
  if (!source) throw new PlanMissingError(sourceId);
  if (await planIdExists(newId)) throw new PlanIdTakenError(newId);

  const ids: string[] = [];
  const ops: WriteOp[] = source.days.map((day, index) => {
    const id = newDayId(newId);
    ids.push(id);
    return (batch) =>
      batch.set(doc(daysCollection(newId), id), {
        dayNumber: index + 1,
        title: day.title,
        scriptureReference: day.scriptureReference,
        devotional: day.devotional,
        reflectionQuestion: day.reflectionQuestion,
        prayerPrompt: day.prayerPrompt,
        application: day.application,
        notes: day.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
  });

  try {
    await commitInChunks(ops);
    const p = source.plan;
    await runTransaction(db, async (tx) => {
      const ref = doc(db, PLANS_COLLECTION, newId);
      if ((await tx.get(ref)).exists()) throw new PlanIdTakenError(newId);
      tx.set(ref, {
        title: newTitle.trim(),
        subtitle: p.subtitle,
        description: p.description,
        category: p.category,
        coverImageUrl: p.coverImageUrl,
        language: p.language ?? 'en',
        estimatedMinutes: p.estimatedMinutes,
        author: p.author,
        order: p.order,
        dayCount: source.days.length,
        ...statusToStored(statusFieldsFor({ to: 'draft' })),
        publishedAt: null,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    await removeDays(newId, ids).catch(() => undefined);
    throw error;
  }

  await logAdminAction({
    action: 'create',
    collection: 'plans',
    documentId: newId,
    changeSummary: `Duplicated plan "${source.plan.title}" as "${newTitle.trim()}" (${source.days.length} days)`,
  });
}

export interface DeletePlanResult {
  /** Days that could not be removed. They are unreachable (their plan is gone) and harmless. */
  leftoverDays: number;
}

/**
 * Deletes a plan and its days. The plan goes FIRST, so members lose access
 * at once; Firestore does not cascade, so the days are then removed
 * explicitly, and any that cannot be are reported rather than hidden.
 * Members' saved progress on the plan is theirs and is not touched.
 */
export async function deletePlan(id: string, title: string): Promise<DeletePlanResult> {
  const days = await getDocs(daysCollection(id));
  await deleteDoc(doc(db, PLANS_COLLECTION, id));
  let leftoverDays = 0;
  try {
    await removeDays(
      id,
      days.docs.map((d) => d.id)
    );
  } catch {
    leftoverDays = days.size;
  }
  await logAdminAction({
    action: 'delete',
    collection: 'plans',
    documentId: id,
    changeSummary: `Deleted plan "${title}" and its ${days.size} day${days.size === 1 ? '' : 's'}`,
  });
  return { leftoverDays };
}
