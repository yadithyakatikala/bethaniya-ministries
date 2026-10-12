import {
  markDayComplete,
  startPlan,
  type PlanProgress,
  type PublishedPlan,
} from '../../services/firebase/plans';
import { completedCount } from './planGroups';

/**
 * Which plan, and which day of it, a reading was opened from -- carried by the
 * reader's route so it can show the plan's chip ("Day 2 of 7 · Seven Days in
 * the Psalms · Mark Complete") and keep it across chapters.
 *
 * Plain values only, no `PublishedPlan`: a route's params should be
 * serialisable (a plan carries Dates), and the chip needs just these four.
 */
export interface PlanReading {
  planId: string;
  title: string;
  dayCount: number;
  dayNumber: number;
}

export function planReadingFor(plan: PublishedPlan, dayNumber: number): PlanReading {
  return { planId: plan.id, title: plan.title, dayCount: plan.dayCount, dayNumber };
}

/**
 * The plan, rebuilt from a `PlanReading`, for the one screen that takes a whole
 * plan -- "Plan complete", which prints its title and length and nothing else.
 */
export function planFromReading(reading: PlanReading): PublishedPlan {
  return {
    id: reading.planId,
    title: reading.title,
    description: '',
    category: '',
    coverImageUrl: null,
    dayCount: reading.dayCount,
  };
}

/**
 * Marks one day of a plan done for a member, and says whether that finished the
 * plan.
 *
 * The plan is started first if the member has no progress for it yet, so
 * marking a day from the reader of a plan they have not begun is one action, not
 * two. A plan is FINISHED when every one of its days is marked (see
 * ./planGroups.ts), not when the day marked is the last number.
 */
export async function markPlanDay({
  uid,
  planId,
  dayNumber,
  dayCount,
  progress,
}: {
  uid: string;
  planId: string;
  dayNumber: number;
  dayCount: number;
  progress: PlanProgress | null;
}): Promise<{ finished: boolean }> {
  const base: PlanProgress = progress ?? {
    startedAt: null,
    currentDay: 1,
    completedDays: [],
    lastReadAt: null,
  };
  if (!progress) await startPlan(uid, planId);
  await markDayComplete(uid, planId, dayNumber, base.currentDay, base.completedDays);
  const nowDone = completedCount({
    ...base,
    completedDays: [...base.completedDays, dayNumber],
  });
  return { finished: dayCount > 0 && nowDone >= dayCount };
}
