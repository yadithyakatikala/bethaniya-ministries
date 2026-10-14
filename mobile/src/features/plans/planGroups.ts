import {
  getBundledPlan,
  type PlanLanguage,
  type PlanProgress,
  type PublishedPlan,
} from '../../services/firebase/plans';
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

/**
 * The library, plus any starter plan this member has already begun.
 *
 * The starter plans that ship with the app stand aside the moment the church
 * publishes one of its own (see ../../services/firebase/plans.ts). That is
 * right for someone choosing a plan, and wrong for someone half-way through
 * "Seven Days in the Psalms": their saved place is still there, but the plan
 * would vanish from their list. So a starter plan that is missing from the
 * library and that the member has progress on stays -- under "My plans", or
 * "Completed" -- and is never offered to anyone who has not started it.
 */
export function withStartedBundledPlans(
  plans: readonly PublishedPlan[],
  progress: Readonly<Record<string, PlanProgress>>
): PublishedPlan[] {
  const listed = new Set(plans.map((plan) => plan.id));
  const kept: PublishedPlan[] = [];
  for (const id of Object.keys(progress)) {
    if (listed.has(id)) continue;
    const bundled = getBundledPlan(id);
    if (bundled) kept.push(bundled);
  }
  return kept.length === 0 ? [...plans] : [...plans, ...kept];
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

/**
 * The language to name beside a plan -- "English" in a Telugu app, "Telugu" in an
 * English one -- or null when the plan is in the language the member reads the app
 * in (nothing to say).
 *
 * The church says which language a plan is written in when it creates it. A plan
 * from before that (or one that ships with the app) does not, and for those the old
 * reading stands: an English title in a Telugu app is English.
 */
export function planOtherLanguage(
  plan: Pick<PublishedPlan, 'title' | 'language'>,
  appLanguage: PlanLanguage
): PlanLanguage | null {
  if (plan.language) return plan.language === appLanguage ? null : plan.language;
  return planIsEnglishInTeluguApp(plan.title, appLanguage) ? 'en' : null;
}
