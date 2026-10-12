import type { PlanProgress, PublishedPlan } from '../../services/firebase/plans';
import { scriptOf } from '../../theme/scriptFace';

/**
 * How the Bible's Plans view sorts the library for one member.
 *
 *   my          started, not finished -- the ones they are in the middle of
 *   find        not started
 *   completed   every day done
 *
 * A plan is COMPLETED when each of its days has been marked complete (the
 * count of distinct completed days reaches the plan's length), not when
 * `currentDay` has run past the end: `currentDay` advances when the CURRENT day
 * is marked, so it can pass a plan's length while an earlier day was skipped.
 * A plan with no days (dayCount 0) can never be completed -- there is nothing
 * to have done -- and one that has been started stays in "my".
 */
export interface PlanGroups {
  my: PublishedPlan[];
  find: PublishedPlan[];
  completed: PublishedPlan[];
}

export function completedCount(progress: PlanProgress): number {
  return new Set(progress.completedDays).size;
}

export function isPlanCompleted(
  plan: PublishedPlan,
  progress: PlanProgress | undefined
): boolean {
  return (
    Boolean(progress) && plan.dayCount > 0 && completedCount(progress!) >= plan.dayCount
  );
}

/** Whole percent, 0 to 100: days completed over days in the plan. */
export function percentComplete(
  plan: PublishedPlan,
  progress: PlanProgress | undefined
): number {
  if (!progress || plan.dayCount <= 0) return 0;
  return Math.min(100, Math.round((completedCount(progress) / plan.dayCount) * 100));
}

/** The day the member is on, never past the plan's last. */
export function currentDayOf(
  plan: PublishedPlan,
  progress: PlanProgress | undefined
): number {
  const day = progress?.currentDay ?? 1;
  return Math.max(1, plan.dayCount > 0 ? Math.min(day, plan.dayCount) : day);
}

export function groupPlans(
  plans: readonly PublishedPlan[],
  progress: Readonly<Record<string, PlanProgress>>
): PlanGroups {
  const groups: PlanGroups = { my: [], find: [], completed: [] };
  for (const plan of plans) {
    const started = progress[plan.id];
    if (!started) groups.find.push(plan);
    else if (isPlanCompleted(plan, started)) groups.completed.push(plan);
    else groups.my.push(plan);
  }
  // The one read most recently first, so the plan the member left a moment ago is on top.
  groups.my.sort(
    (a, b) =>
      (progress[b.id]?.lastReadAt?.getTime() ?? 0) -
      (progress[a.id]?.lastReadAt?.getTime() ?? 0)
  );
  return groups;
}

/** The first sentence of a description: what a Find row says about a plan. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end > 0 ? trimmed.slice(0, end + 1) : trimmed;
}

/**
 * Whether a plan is in English in a Telugu app -- its title has no Telugu in it.
 * A plan follows the app language (design decision Q6 a): one the church has not
 * yet written in the member's language is still shown, in the language it has,
 * and the screen says which ("· English") instead of letting it pass for Telugu.
 */
export function planIsEnglishInTeluguApp(
  title: string,
  appLanguage: 'en' | 'te'
): boolean {
  return appLanguage === 'te' && !['telugu', 'mixed'].includes(scriptOf(title));
}
