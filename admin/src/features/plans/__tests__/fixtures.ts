import type { Plan, PlanDay } from '../../../types';

/** A plan as read from Firestore, with every field set. Override what a test cares about. */
export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'seven-days-in-the-psalms',
    title: 'Seven Days in the Psalms',
    subtitle: 'Rest for the weary',
    description: 'A week of psalms.',
    category: 'Devotional',
    coverImageUrl: 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg',
    language: 'en',
    estimatedMinutes: 10,
    author: 'Pastor Samuel',
    dayCount: 2,
    order: 1,
    published: false,
    status: 'draft',
    publishAt: null,
    publishedAt: null,
    createdBy: 'admin-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

export function makeDay(overrides: Partial<PlanDay> = {}): PlanDay {
  return {
    id: 'day-1',
    dayNumber: 1,
    title: 'The Lord is my shepherd',
    scriptureReference: 'Psalm 23',
    devotional: 'Rest.',
    reflectionQuestion: 'Where has he led you?',
    prayerPrompt: 'Thank him.',
    application: 'Call a friend.',
    notes: 'A psalm of David.',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
