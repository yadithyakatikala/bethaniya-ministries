/**
 * A reading-plan day while an administrator is editing it, and the
 * operations on a list of them.
 *
 * Days are edited as a LIST, in memory, and written together when the
 * plan is saved. That is what makes reordering safe (the day numbers are
 * worked out once, from the final order) and what lets "Save draft" and
 * "Publish" be one action over a complete plan rather than a trail of
 * single-document edits.
 *
 * `dayNumber` is never typed. It is the day's position in the list, so two
 * days cannot share a number and there cannot be a gap. (The phone finds a
 * day by its number, and a member's progress is a list of the numbers they
 * have completed.)
 */
import type { PlanDay } from '../../types';
import { checkPassageList, splitPassages } from '../scripture/passages';

/** Mirrors firestore.rules' isValidPlanDay(), and the longest plan the editor offers. */
export const DAY_LIMITS = {
  title: 200,
  devotional: 5000,
  reflectionQuestion: 1000,
  prayerPrompt: 1000,
  application: 2000,
  notes: 3000,
  /** A year and a leap day. firestore.rules allows 1000; a plan this long is rare enough to be a mistake past a year. */
  maxDays: 366,
} as const;

export interface DayDraft {
  /** Identifies the day inside the editor; stable across reordering. */
  key: string;
  /** The Firestore document id once saved, else null. */
  id: string | null;
  title: string;
  /** One entry per passage, exactly as typed. */
  passages: string[];
  devotional: string;
  reflectionQuestion: string;
  prayerPrompt: string;
  application: string;
  notes: string;
}

export function blankDay(key: string): DayDraft {
  return {
    key,
    id: null,
    title: '',
    passages: [''],
    devotional: '',
    reflectionQuestion: '',
    prayerPrompt: '',
    application: '',
    notes: '',
  };
}

export function dayFromDocument(key: string, day: PlanDay): DayDraft {
  const passages = splitPassages(day.scriptureReference);
  return {
    key,
    id: day.id,
    title: day.title,
    passages: passages.length > 0 ? passages : [''],
    devotional: day.devotional,
    reflectionQuestion: day.reflectionQuestion,
    prayerPrompt: day.prayerPrompt,
    application: day.application,
    notes: day.notes,
  };
}

export interface DayErrors {
  title?: string;
  passages?: string;
  devotional?: string;
  reflectionQuestion?: string;
  prayerPrompt?: string;
  application?: string;
  notes?: string;
}

function tooLong(label: string, value: string, max: number): string | undefined {
  return value.trim().length > max
    ? `${label} must be ${max.toLocaleString('en')} characters or fewer.`
    : undefined;
}

/** What is wrong with a day, field by field. Empty when it can be saved and published. */
export function validateDay(day: DayDraft): DayErrors {
  const errors: DayErrors = {};

  const title = day.title.trim();
  if (title.length === 0) errors.title = 'Give this day a title.';
  else errors.title = tooLong('The title', title, DAY_LIMITS.title);

  errors.passages = checkPassageList(day.passages).problem ?? undefined;
  errors.devotional = tooLong('The devotional', day.devotional, DAY_LIMITS.devotional);
  errors.reflectionQuestion = tooLong(
    'The reflection question',
    day.reflectionQuestion,
    DAY_LIMITS.reflectionQuestion
  );
  errors.prayerPrompt = tooLong('The prayer', day.prayerPrompt, DAY_LIMITS.prayerPrompt);
  errors.application = tooLong(
    'The application',
    day.application,
    DAY_LIMITS.application
  );
  errors.notes = tooLong('The notes', day.notes, DAY_LIMITS.notes);

  // Drop the keys that are fine, so `Object.keys(errors).length` means "has a problem".
  for (const key of Object.keys(errors) as (keyof DayErrors)[]) {
    if (errors[key] === undefined) delete errors[key];
  }
  return errors;
}

export function dayHasErrors(day: DayDraft): boolean {
  return Object.keys(validateDay(day)).length > 0;
}

/** Whether the day has anything for the reader beyond the passage itself. */
export function dayHasReaderText(day: DayDraft): boolean {
  return [
    day.devotional,
    day.reflectionQuestion,
    day.prayerPrompt,
    day.application,
    day.notes,
  ].some((text) => text.trim().length > 0);
}

/** The day as it is stored, with the passages checked and written canonically. */
export function dayForStorage(day: DayDraft): {
  title: string;
  scriptureReference: string;
  devotional: string;
  reflectionQuestion: string;
  prayerPrompt: string;
  application: string;
  notes: string;
} {
  return {
    title: day.title.trim(),
    scriptureReference: checkPassageList(day.passages).stored,
    devotional: day.devotional.trim(),
    reflectionQuestion: day.reflectionQuestion.trim(),
    prayerPrompt: day.prayerPrompt.trim(),
    application: day.application.trim(),
    notes: day.notes.trim(),
  };
}

// ---- Operations on the list -----------------------------------------

export function indexOfKey(days: readonly DayDraft[], key: string): number {
  return days.findIndex((day) => day.key === key);
}

/** Moves one day a place earlier or later; at either end it does nothing. */
export function moveDay(
  days: readonly DayDraft[],
  key: string,
  direction: 'up' | 'down'
): DayDraft[] {
  const from = indexOfKey(days, key);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= days.length) return [...days];
  const next = [...days];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

/** Moves a day to an exact place (zero-based), for "move to day N". */
export function moveDayTo(
  days: readonly DayDraft[],
  key: string,
  targetIndex: number
): DayDraft[] {
  const from = indexOfKey(days, key);
  if (from < 0) return [...days];
  const to = Math.max(0, Math.min(days.length - 1, targetIndex));
  if (to === from) return [...days];
  const next = [...days];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

/** A copy of a day, placed straight after the original, with no saved id. */
export function duplicateDay(
  days: readonly DayDraft[],
  key: string,
  newKey: string
): DayDraft[] {
  const from = indexOfKey(days, key);
  const original = days[from];
  if (!original) return [...days];
  const copy: DayDraft = {
    ...original,
    key: newKey,
    id: null,
    passages: [...original.passages],
    title: original.title.trim() ? `${original.title.trim()} (copy)` : '',
  };
  const next = [...days];
  next.splice(from + 1, 0, copy);
  return next;
}

export function removeDay(days: readonly DayDraft[], key: string): DayDraft[] {
  return days.filter((day) => day.key !== key);
}
