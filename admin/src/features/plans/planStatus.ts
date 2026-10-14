/**
 * Where a reading plan stands as MEMBERS are concerned, and what to write
 * when an administrator changes it.
 *
 * =====================================================================
 * WHAT IS STORED, AND WHAT IS MEANT
 * =====================================================================
 * Two fields say whether members can see a plan, and they must agree
 * (firestore.rules enforces it): `published`, which members' devices ask
 * for, and `status`, which says why.
 *
 *   status        published   publishAt   members see it?
 *   draft         false       null        no
 *   scheduled     false       a time      from that time (server clock)
 *   published     true        null        yes
 *   archived      false       null        no
 *
 * A plan written before the manager existed has no `status`, only
 * `published`; it reads as published or draft.
 *
 * A SCHEDULED PLAN WHOSE TIME HAS COME is stored as `scheduled` still --
 * there is no server job on the Spark plan to rewrite it -- but members can
 * read it, so for an administrator it IS published, and `planStatusOf`
 * says so. (The next time anyone saves it, it can be saved as published.)
 */
import { formatDateTime } from '../../components/ui/formatDate';
import type { Plan, PlanStatus } from '../../types';
import { toDateTimeLocalValue } from '../prophet-verses/validation';

type StatusFields = Pick<Plan, 'status' | 'published' | 'publishAt'>;

export function planStatusOf(plan: StatusFields, now: Date): PlanStatus {
  switch (plan.status) {
    case 'archived':
      return 'archived';
    case 'published':
      return 'published';
    case 'draft':
      return 'draft';
    case 'scheduled':
      return plan.publishAt !== null && plan.publishAt.getTime() <= now.getTime()
        ? 'published'
        : 'scheduled';
    default:
      // Written before the manager: `published` is all there is.
      return plan.published ? 'published' : 'draft';
  }
}

/** Whether a member's device can read the plan right now. */
export function isVisibleToMembers(plan: StatusFields, now: Date): boolean {
  return planStatusOf(plan, now) === 'published';
}

/**
 * The status as it is STORED -- what a save that does not change the status
 * writes back. Unlike `planStatusOf` this does not promote a due schedule,
 * because rewriting `scheduled` as `published` would be a status change the
 * administrator did not ask for.
 */
export function storedStatusOf(plan: StatusFields): PlanStatus {
  return plan.status ?? (plan.published ? 'published' : 'draft');
}

export type PlanStatusChange =
  | { to: 'draft' }
  | { to: 'published' }
  | { to: 'archived' }
  | { to: 'scheduled'; publishAt: Date };

export interface StatusFieldsToWrite {
  status: PlanStatus;
  published: boolean;
  publishAt: Date | null;
}

/** The fields a status change writes. `published` always agrees with `status`. */
export function statusFieldsFor(change: PlanStatusChange): StatusFieldsToWrite {
  switch (change.to) {
    case 'published':
      return { status: 'published', published: true, publishAt: null };
    case 'scheduled':
      return { status: 'scheduled', published: false, publishAt: change.publishAt };
    case 'archived':
      return { status: 'archived', published: false, publishAt: null };
    case 'draft':
      return { status: 'draft', published: false, publishAt: null };
  }
}

/** The fields to write when a save leaves the status alone. */
export function unchangedStatusFields(plan: StatusFields): StatusFieldsToWrite {
  const status = storedStatusOf(plan);
  return {
    status,
    published: status === 'published',
    publishAt: status === 'scheduled' ? plan.publishAt : null,
  };
}

/** True when the change makes (or keeps) the plan live or about to be. */
export function isGoingLive(change: PlanStatusChange | null): boolean {
  return change !== null && (change.to === 'published' || change.to === 'scheduled');
}

export function formatScheduleTime(date: Date): string {
  return formatDateTime(date);
}

/** The words for a status chip: "Scheduled · 12 Oct 2026, 09:00" for a future plan. */
export function statusLabelFor(plan: StatusFields, now: Date): string | undefined {
  if (planStatusOf(plan, now) === 'scheduled' && plan.publishAt) {
    return `Scheduled · ${formatScheduleTime(plan.publishAt)}`;
  }
  return undefined;
}

/** Tomorrow at six in the morning, where the administrator is. */
export function defaultScheduleValue(from: Date): string {
  const tomorrow = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
    6,
    0
  );
  return toDateTimeLocalValue(tomorrow);
}
