/**
 * A reading plan's own fields while it is being edited, and the checks on
 * them.
 *
 * The limits mirror firestore.rules' isValidPlan(); that is the boundary,
 * and this exists so a mistake is caught beside the field rather than as a
 * permission error after Save.
 */
import type { Plan, PlanLanguage } from '../../types';

export const PLAN_LIMITS = {
  title: 200,
  subtitle: 200,
  description: 2000,
  category: 100,
  author: 120,
  estimatedMinutes: { min: 1, max: 240 },
  idLength: { min: 3, max: 64 },
} as const;

export const PLAN_LANGUAGE_OPTIONS: { value: PlanLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'te', label: 'Telugu' },
];

export function languageLabel(language: PlanLanguage | null): string {
  return PLAN_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? '';
}

/** Suggestions only; a plan's category is free text. */
export const PLAN_CATEGORY_SUGGESTIONS = [
  'Devotional',
  'Topical',
  'Seasonal',
  'Book study',
  'Character study',
  'Prayer',
  'Family',
  'New believers',
];

export const DEFAULT_CATEGORY = 'Devotional';

/** Everything typed on the Details tab, as the form holds it (numbers as text). */
export interface PlanDetailsForm {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  language: PlanLanguage;
  /** Digits, or '' for "not given". */
  estimatedMinutes: string;
  author: string;
  /** A whole number, as text. */
  order: string;
}

export function emptyDetails(): PlanDetailsForm {
  return {
    title: '',
    subtitle: '',
    description: '',
    category: DEFAULT_CATEGORY,
    coverImageUrl: null,
    language: 'en',
    estimatedMinutes: '',
    author: '',
    order: '0',
  };
}

export function detailsFromPlan(plan: Plan): PlanDetailsForm {
  return {
    title: plan.title,
    subtitle: plan.subtitle,
    description: plan.description,
    category: plan.category,
    coverImageUrl: plan.coverImageUrl,
    // A plan written before the field existed is read as English, the
    // language the app starts in; saving it records that choice, which an
    // administrator can change on the Details tab.
    language: plan.language ?? 'en',
    estimatedMinutes: plan.estimatedMinutes === null ? '' : String(plan.estimatedMinutes),
    author: plan.author,
    order: String(plan.order),
  };
}

export interface PlanDetailsErrors {
  title?: string;
  subtitle?: string;
  description?: string;
  category?: string;
  estimatedMinutes?: string;
  author?: string;
  order?: string;
}

/** The checks a draft must pass to be saved at all. Finishing touches are in planReadiness.ts. */
export function validatePlanDetails(details: PlanDetailsForm): PlanDetailsErrors {
  const errors: PlanDetailsErrors = {};

  const title = details.title.trim();
  if (title.length === 0) errors.title = 'Give the plan a title.';
  else if (title.length > PLAN_LIMITS.title) {
    errors.title = `Title must be ${PLAN_LIMITS.title} characters or fewer.`;
  }

  if (details.subtitle.trim().length > PLAN_LIMITS.subtitle) {
    errors.subtitle = `Subtitle must be ${PLAN_LIMITS.subtitle} characters or fewer.`;
  }
  if (details.description.trim().length > PLAN_LIMITS.description) {
    errors.description = `Description must be ${PLAN_LIMITS.description.toLocaleString('en')} characters or fewer.`;
  }

  const category = details.category.trim();
  if (category.length === 0) errors.category = 'Choose or type a category.';
  else if (category.length > PLAN_LIMITS.category) {
    errors.category = `Category must be ${PLAN_LIMITS.category} characters or fewer.`;
  }

  if (details.author.trim().length > PLAN_LIMITS.author) {
    errors.author = `Author must be ${PLAN_LIMITS.author} characters or fewer.`;
  }

  const minutes = details.estimatedMinutes.trim();
  if (minutes.length > 0) {
    const value = Number(minutes);
    const { min, max } = PLAN_LIMITS.estimatedMinutes;
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.estimatedMinutes = `Use a whole number of minutes from ${min} to ${max}, or leave it empty.`;
    }
  }

  const order = details.order.trim();
  if (order.length === 0 || !Number.isSafeInteger(Number(order))) {
    errors.order = 'Use a whole number. Lower numbers appear first.';
  }

  return errors;
}

export function hasDetailErrors(errors: PlanDetailsErrors): boolean {
  return Object.values(errors).some((value) => value !== undefined);
}

/** The details as they are written to Firestore, trimmed and with the numbers parsed. */
export interface PlanDetailsValues {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  language: PlanLanguage;
  estimatedMinutes: number | null;
  author: string;
  order: number;
}

export function detailsForStorage(details: PlanDetailsForm): PlanDetailsValues {
  const minutes = details.estimatedMinutes.trim();
  return {
    title: details.title.trim(),
    subtitle: details.subtitle.trim(),
    description: details.description.trim(),
    category: details.category.trim(),
    coverImageUrl: details.coverImageUrl,
    language: details.language,
    estimatedMinutes: minutes.length > 0 ? Number(minutes) : null,
    author: details.author.trim(),
    order: Number(details.order.trim()),
  };
}

// ---- The plan's unique id -------------------------------------------

/** Ids that would collide with a route or read as a command. */
const RESERVED_IDS = new Set(['new', 'edit', 'days', 'preview']);

/**
 * "Seven Days in the Psalms" -> "seven-days-in-the-psalms". Letters and
 * digits only, hyphens between words. Returns '' when nothing usable is left
 * (a title written entirely in another script), and the administrator is
 * asked to type an id.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= PLAN_LIMITS.idLength.max) return slug;
  // Cut at a word boundary where there is one.
  const cut = slug.slice(0, PLAN_LIMITS.idLength.max);
  const lastHyphen = cut.lastIndexOf('-');
  return (
    lastHyphen >= PLAN_LIMITS.idLength.min ? cut.slice(0, lastHyphen) : cut
  ).replace(/-+$/, '');
}

export const PLAN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Why this cannot be a plan id, or null. */
export function validatePlanId(id: string): string | null {
  const { min, max } = PLAN_LIMITS.idLength;
  if (id.length === 0) {
    return 'Choose an ID for this plan, using letters, numbers and hyphens.';
  }
  if (id.length < min) return `The ID must be at least ${min} characters.`;
  if (id.length > max) return `The ID must be ${max} characters or fewer.`;
  if (!PLAN_ID_PATTERN.test(id)) {
    return 'The ID can use only lowercase letters, numbers and single hyphens between them.';
  }
  if (RESERVED_IDS.has(id)) return `"${id}" is reserved. Choose another ID.`;
  return null;
}

/** Finds a free id by adding -2, -3 ... to a base. `taken` says whether an id is in use. */
export async function firstFreeId(
  base: string,
  taken: (id: string) => Promise<boolean>
): Promise<string> {
  const root = base.length > 0 ? base : 'plan';
  const { max } = PLAN_LIMITS.idLength;
  for (let attempt = 1; attempt < 100; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const candidate = `${root.slice(0, max - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${root.slice(0, max - 9)}-${Date.now().toString(36).slice(-6)}`;
}
