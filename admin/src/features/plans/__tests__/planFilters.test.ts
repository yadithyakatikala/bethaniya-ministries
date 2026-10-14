import { describe, expect, it } from 'vitest';
import {
  NO_FILTERS,
  countByStatus,
  filterPlans,
  hasActiveFilters,
  type PlanFilters,
} from '../planFilters';
import { makePlan } from './fixtures';

const NOW = new Date('2026-06-15T12:00:00Z');
const LATER = new Date('2026-06-16T12:00:00Z');
const EARLIER = new Date('2026-06-14T12:00:00Z');

const PLANS = [
  makePlan({
    id: 'psalms',
    title: 'Seven Days in the Psalms',
    status: 'published',
    published: true,
    language: 'en',
    category: 'Devotional',
    author: 'Pastor Zebulun',
  }),
  makePlan({
    id: 'romans',
    title: 'Romans Road',
    status: 'draft',
    language: 'en',
    category: 'Book study',
    subtitle: 'The gospel in order',
  }),
  makePlan({
    id: 'telugu-prayer',
    title: 'ప్రార్థన',
    status: 'scheduled',
    publishAt: LATER,
    language: 'te',
    category: 'Prayer',
  }),
  makePlan({
    id: 'lent',
    title: 'Lent',
    status: 'archived',
    language: 'en',
    category: 'Seasonal',
  }),
  makePlan({
    id: 'old',
    title: 'Old plan',
    status: null,
    published: true,
    language: null,
    category: 'Topical',
  }),
  makePlan({
    id: 'due',
    title: 'Went live by itself',
    status: 'scheduled',
    publishAt: EARLIER,
    language: 'en',
  }),
];

const ids = (filters: Partial<PlanFilters>) =>
  filterPlans(PLANS, { ...NO_FILTERS, ...filters }, NOW).map((plan) => plan.id);

describe('filtering the plan list', () => {
  it('shows everything when nothing is chosen', () => {
    expect(ids({})).toHaveLength(PLANS.length);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it.each([
    ['draft', ['romans']],
    ['scheduled', ['telugu-prayer']],
    ['published', ['psalms', 'old', 'due']],
    ['archived', ['lent']],
  ] as const)('shows only %s plans', (status, expected) => {
    expect(ids({ status })).toEqual(expected);
  });

  it('counts a scheduled plan whose time has come as published, as members see it', () => {
    expect(ids({ status: 'published' })).toContain('due');
    expect(ids({ status: 'scheduled' })).not.toContain('due');
  });

  it('counts an old plan with no status by its published flag', () => {
    expect(ids({ status: 'published' })).toContain('old');
  });

  it('filters by language, reading an old plan with none as English', () => {
    expect(ids({ language: 'te' })).toEqual(['telugu-prayer']);
    expect(ids({ language: 'en' })).toEqual(['psalms', 'romans', 'lent', 'old', 'due']);
  });

  it.each([
    ['psalms', ['psalms']],
    ['PSALMS', ['psalms']],
    ['  road ', ['romans']],
    ['gospel in order', ['romans']],
    ['zebulun', ['psalms']],
    ['seasonal', ['lent']],
    ['telugu-prayer', ['telugu-prayer']],
    ['ప్రార్థన', ['telugu-prayer']],
    ['nothing matches this', []],
  ])('searches title, subtitle, id, category and author: %j', (query, expected) => {
    expect(ids({ query })).toEqual(expected);
  });

  it('combines the filters', () => {
    expect(ids({ status: 'published', query: 'psalms' })).toEqual(['psalms']);
    expect(ids({ status: 'draft', language: 'te' })).toEqual([]);
    expect(hasActiveFilters({ ...NO_FILTERS, query: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, status: 'draft' })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, language: 'te' })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, query: '   ' })).toBe(false);
  });

  it('counts plans in each status', () => {
    expect(countByStatus(PLANS, NOW)).toEqual({
      all: 6,
      draft: 1,
      scheduled: 1,
      published: 3,
      archived: 1,
    });
  });
});
