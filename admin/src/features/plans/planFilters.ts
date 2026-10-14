/**
 * Narrowing the plan list: a search box, a status, a language.
 *
 * Pure functions over the plans already loaded -- the list is a handful to
 * a few dozen documents, so there is nothing to ask Firestore for.
 */
import type { Plan, PlanLanguage, PlanStatus } from '../../types';
import { planStatusOf } from './planStatus';

export type StatusFilter = 'all' | PlanStatus;
export type LanguageFilter = 'all' | PlanLanguage;

export interface PlanFilters {
  query: string;
  status: StatusFilter;
  language: LanguageFilter;
}

export const NO_FILTERS: PlanFilters = { query: '', status: 'all', language: 'all' };

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

function matchesQuery(plan: Plan, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return [plan.title, plan.subtitle, plan.id, plan.category, plan.author].some((field) =>
    field.toLowerCase().includes(needle)
  );
}

export function filterPlans(
  plans: readonly Plan[],
  filters: PlanFilters,
  now: Date
): Plan[] {
  return plans.filter((plan) => {
    if (filters.status !== 'all' && planStatusOf(plan, now) !== filters.status)
      return false;
    if (filters.language !== 'all' && (plan.language ?? 'en') !== filters.language) {
      return false;
    }
    return matchesQuery(plan, filters.query);
  });
}

/** How many plans are in each status, for the numbers on the filter chips. */
export function countByStatus(
  plans: readonly Plan[],
  now: Date
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: plans.length,
    draft: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  };
  for (const plan of plans) counts[planStatusOf(plan, now)] += 1;
  return counts;
}

export function hasActiveFilters(filters: PlanFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.status !== 'all' ||
    filters.language !== 'all'
  );
}
