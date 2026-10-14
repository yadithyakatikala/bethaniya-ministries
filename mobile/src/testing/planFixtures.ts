import type { PublishedPlan, PublishedPlanDay } from '../services/firebase/plans';

/**
 * A plan as the app reads it, with every field set. Override what a test
 * cares about.
 *
 * `import type` only: the screen tests replace the plans service wholesale
 * (`jest.mock('.../plans')`), and a fixture must not depend on what they
 * replaced it with.
 */
export function makePlan(overrides: Partial<PublishedPlan> = {}): PublishedPlan {
  return {
    id: 'psalms',
    title: 'Seven Days in the Psalms',
    subtitle: '',
    description: 'A week of psalms.',
    category: 'Devotional',
    coverImageUrl: null,
    dayCount: 7,
    language: null,
    estimatedMinutes: null,
    author: '',
    order: 0,
    ...overrides,
  };
}

/** A day with only the required parts; the optional ones are empty, as when the church left them out. */
export function makeDay(overrides: Partial<PublishedPlanDay> = {}): PublishedPlanDay {
  return {
    id: 'day-1',
    dayNumber: 1,
    title: 'Day one',
    scriptureReference: 'Psalm 1:1-6',
    devotional: '',
    reflectionQuestion: '',
    application: '',
    prayerPrompt: '',
    notes: '',
    ...overrides,
  };
}
