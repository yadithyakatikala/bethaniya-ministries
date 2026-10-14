/**
 * Is this plan ready for members?
 *
 * Saving a DRAFT asks very little (a title, a category). PUBLISHING or
 * SCHEDULING asks for everything a member will see: a description, at
 * least one day, and every day with a title and a real passage. This is the
 * checklist, and it is what the Publish dialog lists. Two kinds of finding:
 *
 *   error     blocks publishing. Something a member would see broken or
 *             missing.
 *   warning   worth knowing, never blocking (no cover picture, a day that is
 *             only a passage).
 *
 * firestore.rules independently refuses to make a plan live without a
 * description and a day; the rest is the dashboard's care for the people
 * reading it.
 */
import { checkPassageList } from '../scripture/passages';
import {
  DAY_LIMITS,
  dayHasErrors,
  dayHasReaderText,
  validateDay,
  type DayDraft,
} from './planDays';
import {
  hasDetailErrors,
  validatePlanDetails,
  type PlanDetailsForm,
} from './planDetails';

export interface ReadinessIssue {
  /** Stable, for React keys and tests. */
  id: string;
  severity: 'error' | 'warning';
  message: string;
  /** Where the fix is. */
  tab: 'details' | 'days';
  /** The day to open, for a problem inside one. */
  dayKey?: string;
}

function dayLabel(day: DayDraft, index: number): string {
  const title = day.title.trim();
  return title ? `Day ${index + 1} ("${title}")` : `Day ${index + 1}`;
}

export function planReadiness(
  details: PlanDetailsForm,
  days: readonly DayDraft[]
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const fieldErrors = validatePlanDetails(details);

  if (fieldErrors.title) {
    issues.push({
      id: 'title',
      severity: 'error',
      message: fieldErrors.title,
      tab: 'details',
    });
  }
  if (details.description.trim().length === 0) {
    issues.push({
      id: 'description',
      severity: 'error',
      message: 'Write a short description. It is what members read before they start.',
      tab: 'details',
    });
  } else if (fieldErrors.description) {
    issues.push({
      id: 'description',
      severity: 'error',
      message: fieldErrors.description,
      tab: 'details',
    });
  }
  for (const key of [
    'subtitle',
    'category',
    'author',
    'estimatedMinutes',
    'order',
  ] as const) {
    const message = fieldErrors[key];
    if (message) issues.push({ id: key, severity: 'error', message, tab: 'details' });
  }

  if (days.length === 0) {
    issues.push({
      id: 'no-days',
      severity: 'error',
      message: 'Add at least one day. A plan with no days has nothing to read.',
      tab: 'days',
    });
  } else if (days.length > DAY_LIMITS.maxDays) {
    issues.push({
      id: 'too-many-days',
      severity: 'error',
      message: `A plan can have at most ${DAY_LIMITS.maxDays} days.`,
      tab: 'days',
    });
  }

  days.forEach((day, index) => {
    const errors = validateDay(day);
    const label = dayLabel(day, index);
    if (errors.title) {
      issues.push({
        id: `${day.key}-title`,
        severity: 'error',
        message: `${label}: ${errors.title}`,
        tab: 'days',
        dayKey: day.key,
      });
    }
    if (errors.passages) {
      // Say WHICH passage when the list has several.
      const list = checkPassageList(day.passages);
      const first = list.results.find((result) => !result.ok);
      const detail = first && !first.ok ? ` ${first.message}` : '';
      issues.push({
        id: `${day.key}-passages`,
        severity: 'error',
        message: `${label}: ${errors.passages}${list.problem === 'Fix the passages marked below.' ? detail : ''}`,
        tab: 'days',
        dayKey: day.key,
      });
    }
    for (const key of [
      'devotional',
      'reflectionQuestion',
      'prayerPrompt',
      'application',
      'notes',
    ] as const) {
      const message = errors[key];
      if (message) {
        issues.push({
          id: `${day.key}-${key}`,
          severity: 'error',
          message: `${label}: ${message}`,
          tab: 'days',
          dayKey: day.key,
        });
      }
    }
    if (!errors.title && !errors.passages && !dayHasReaderText(day)) {
      issues.push({
        id: `${day.key}-bare`,
        severity: 'warning',
        message: `${label} is only a passage, with no devotional, question or prayer.`,
        tab: 'days',
        dayKey: day.key,
      });
    }
  });

  if (!details.coverImageUrl) {
    issues.push({
      id: 'cover',
      severity: 'warning',
      message: 'There is no cover image. The app will show a plain placeholder.',
      tab: 'details',
    });
  }

  return issues;
}

export function blockingIssues(issues: readonly ReadinessIssue[]): ReadinessIssue[] {
  return issues.filter((issue) => issue.severity === 'error');
}

export function isReady(details: PlanDetailsForm, days: readonly DayDraft[]): boolean {
  return blockingIssues(planReadiness(details, days)).length === 0;
}

/** Whether the plan can be saved at all (even as a draft). */
export function canSaveDraft(
  details: PlanDetailsForm,
  days: readonly DayDraft[]
): boolean {
  if (hasDetailErrors(validatePlanDetails(details))) return false;
  if (days.length > DAY_LIMITS.maxDays) return false;
  // Every day must be one firestore.rules will accept: a title, a real
  // passage, and each optional text within its limit. The days are written
  // BEFORE the plan, so a day the rules would refuse has to be caught here --
  // found part-way through a save, it would leave the earlier days written
  // and the administrator with a message that says only "try again".
  return days.every((day) => !dayHasErrors(day));
}

/**
 * Why a plan that members can already see (published, or scheduled) cannot be
 * saved as it stands, or null.
 *
 * firestore.rules refuse a live plan that has no description or no day. The
 * editor writes the DAYS first and the plan document last, so a save that
 * removed the last day of a live plan would delete that day and only then be
 * refused, leaving members a live plan with nothing in it. This is the check
 * that stops such a save before anything is written. A draft or an archived
 * plan is not held to it: nobody can see those, and they may be saved
 * half-built.
 *
 * Only the two things the rules insist on are looked at here. Everything
 * else belongs to `canSaveDraft`, which applies to every save.
 */
export function liveSaveProblem(
  details: PlanDetailsForm,
  days: readonly DayDraft[]
): ReadinessIssue | null {
  return (
    planReadiness(details, days).find(
      (issue) =>
        issue.severity === 'error' &&
        (issue.id === 'description' || issue.id === 'no-days')
    ) ?? null
  );
}
