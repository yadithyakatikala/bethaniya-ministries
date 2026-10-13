import {
  completedCount,
  currentDayOf,
  firstSentence,
  groupPlans,
  isPlanCompleted,
  percentComplete,
  planIsEnglishInTeluguApp,
} from '../planGroups';
import type { PlanProgress, PublishedPlan } from '../../../services/firebase/plans';

const plan = (id: string, dayCount = 7): PublishedPlan => ({
  id,
  title: id,
  description: '',
  category: 'Devotional',
  coverImageUrl: null,
  dayCount,
});

const progress = (overrides: Partial<PlanProgress> = {}): PlanProgress => ({
  startedAt: null,
  currentDay: 1,
  completedDays: [],
  lastReadAt: null,
  ...overrides,
});

describe('completedCount', () => {
  it('counts distinct completed days, so a repeated mark is not progress', () => {
    expect(completedCount(progress({ completedDays: [1, 2, 2, 3, 1] }))).toBe(3);
  });
});

describe('isPlanCompleted', () => {
  it('is true only when every day has been completed', () => {
    expect(isPlanCompleted(plan('a', 3), progress({ completedDays: [1, 2, 3] }))).toBe(
      true
    );
    expect(isPlanCompleted(plan('a', 3), progress({ completedDays: [1, 2] }))).toBe(
      false
    );
  });

  it('is not fooled by currentDay running past the end while an earlier day was skipped', () => {
    expect(
      isPlanCompleted(plan('a', 3), progress({ currentDay: 4, completedDays: [1, 3] }))
    ).toBe(false);
  });

  it('is false for a plan not started, and for one with no days at all', () => {
    expect(isPlanCompleted(plan('a', 3), undefined)).toBe(false);
    expect(isPlanCompleted(plan('a', 0), progress())).toBe(false);
  });
});

describe('percentComplete', () => {
  it('is whole percent of days completed', () => {
    expect(percentComplete(plan('a', 7), progress({ completedDays: [1] }))).toBe(14);
    expect(percentComplete(plan('a', 3), progress({ completedDays: [1, 2] }))).toBe(67);
    expect(percentComplete(plan('a', 7), progress({ completedDays: [] }))).toBe(0);
  });

  it('never exceeds 100, never divides by zero, and is 0 before a start', () => {
    expect(percentComplete(plan('a', 2), progress({ completedDays: [1, 2, 3, 4] }))).toBe(
      100
    );
    expect(percentComplete(plan('a', 0), progress({ completedDays: [1] }))).toBe(0);
    expect(percentComplete(plan('a', 7), undefined)).toBe(0);
  });
});

describe('currentDayOf', () => {
  it('is the day the member is on, 1 before a start, never past the last day', () => {
    expect(currentDayOf(plan('a', 7), undefined)).toBe(1);
    expect(currentDayOf(plan('a', 7), progress({ currentDay: 3 }))).toBe(3);
    expect(currentDayOf(plan('a', 7), progress({ currentDay: 8 }))).toBe(7);
    expect(currentDayOf(plan('a', 7), progress({ currentDay: 0 }))).toBe(1);
  });
});

describe('groupPlans', () => {
  it('sorts the library into my, find and completed', () => {
    const plans = [plan('psalms'), plan('luke'), plan('romans', 2), plan('peace')];
    const groups = groupPlans(plans, {
      psalms: progress({ currentDay: 2, completedDays: [1] }),
      romans: progress({ currentDay: 3, completedDays: [1, 2] }),
    });
    expect(groups.my.map((p) => p.id)).toEqual(['psalms']);
    expect(groups.completed.map((p) => p.id)).toEqual(['romans']);
    expect(groups.find.map((p) => p.id)).toEqual(['luke', 'peace']);
  });

  it('keeps the library’s order among plans not started', () => {
    const groups = groupPlans([plan('c'), plan('a'), plan('b')], {});
    expect(groups.find.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('lists the plan read most recently first under My plans', () => {
    const groups = groupPlans([plan('a'), plan('b'), plan('c')], {
      a: progress({ lastReadAt: new Date(2026, 9, 1) }),
      b: progress({ lastReadAt: new Date(2026, 9, 9) }),
      c: progress({ lastReadAt: null }),
    });
    expect(groups.my.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('ignores progress for a plan no longer in the library', () => {
    const groups = groupPlans([plan('a')], { gone: progress({ completedDays: [1] }) });
    expect(groups.my).toEqual([]);
    expect(groups.completed).toEqual([]);
    expect(groups.find.map((p) => p.id)).toEqual(['a']);
  });
});

describe('firstSentence', () => {
  it('is the description up to and including its first full stop', () => {
    expect(firstSentence('A week of psalms. Read one a day.')).toBe('A week of psalms.');
    expect(firstSentence('Does it help? Yes.')).toBe('Does it help?');
  });

  it('is the whole text when there is no full stop, and does not split on a decimal or an abbreviation without a space', () => {
    expect(firstSentence('A plan with no stop')).toBe('A plan with no stop');
    expect(firstSentence('Version 2.5 of the plan. Then more.')).toBe(
      'Version 2.5 of the plan.'
    );
  });

  it('trims, and is empty for nothing', () => {
    expect(firstSentence('  Padded.  Next.')).toBe('Padded.');
    expect(firstSentence('   ')).toBe('');
  });
});

describe('planIsEnglishInTeluguApp', () => {
  it('is true only for a title with no Telugu in it, in a Telugu app', () => {
    expect(planIsEnglishInTeluguApp('Seven Days in the Psalms', 'te')).toBe(true);
    expect(planIsEnglishInTeluguApp('కీర్తనలలో ఏడు రోజులు', 'te')).toBe(false);
  });

  it('counts a title that mixes the two as Telugu, since it has some', () => {
    expect(planIsEnglishInTeluguApp('కీర్తనలు in a week', 'te')).toBe(false);
  });

  it('is never true in an English app, whatever the title', () => {
    expect(planIsEnglishInTeluguApp('Seven Days in the Psalms', 'en')).toBe(false);
    expect(planIsEnglishInTeluguApp('కీర్తనలలో ఏడు రోజులు', 'en')).toBe(false);
  });
});
