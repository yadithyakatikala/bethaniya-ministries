import {
  completedCount,
  currentDayOf,
  firstSentence,
  groupPlans,
  isPlanCompleted,
  percentComplete,
  planIsEnglishInTeluguApp,
  planOtherLanguage,
  withStartedBundledPlans,
} from '../planGroups';
import type { PlanProgress, PublishedPlan } from '../../../services/firebase/plans';
import { makePlan } from '../../../testing/planFixtures';
import { SEED_PLANS } from '../seedPlans';

jest.mock('../../../services/firebase/app');

const plan = (id: string, dayCount = 7): PublishedPlan =>
  makePlan({ id, title: id, description: '', dayCount });

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

describe('planOtherLanguage', () => {
  it('says nothing when the plan is in the language the member reads the app in', () => {
    expect(planOtherLanguage({ title: 'Psalms', language: 'en' }, 'en')).toBeNull();
    expect(planOtherLanguage({ title: 'కీర్తనలు', language: 'te' }, 'te')).toBeNull();
  });

  it('names the plan’s language when the church said it is the other one', () => {
    expect(planOtherLanguage({ title: 'Psalms', language: 'en' }, 'te')).toBe('en');
    expect(planOtherLanguage({ title: 'కీర్తనలు', language: 'te' }, 'en')).toBe('te');
  });

  it('trusts the language the church named over what the title looks like', () => {
    // An English title on a plan the church says is Telugu (a transliterated name,
    // say) is not "English".
    expect(planOtherLanguage({ title: 'Psalms', language: 'te' }, 'te')).toBeNull();
    expect(planOtherLanguage({ title: 'కీర్తనలు', language: 'en' }, 'en')).toBeNull();
  });

  it('reads a plan with no language the way it always has: English in a Telugu app', () => {
    expect(
      planOtherLanguage({ title: 'Seven Days in the Psalms', language: null }, 'te')
    ).toBe('en');
    expect(
      planOtherLanguage({ title: 'కీర్తనలలో ఏడు రోజులు', language: null }, 'te')
    ).toBeNull();
    expect(
      planOtherLanguage({ title: 'Seven Days in the Psalms', language: null }, 'en')
    ).toBeNull();
  });
});

describe('withStartedBundledPlans', () => {
  const starter = SEED_PLANS[0]!;
  const church = plan('church-plan');

  it('keeps a starter plan the member has begun when the church’s own plans have replaced it', () => {
    const result = withStartedBundledPlans([church], { [starter.id]: progress() });
    expect(result.map((p) => p.id)).toEqual(['church-plan', starter.id]);
    expect(result[1]!.title).toBe(starter.plan.title);
  });

  it('puts it where the member’s progress says: My plans while it is under way, Completed when done', () => {
    const under = groupPlans(
      withStartedBundledPlans([church], {
        [starter.id]: progress({ completedDays: [1] }),
      }),
      { [starter.id]: progress({ completedDays: [1] }) }
    );
    expect(under.my.map((p) => p.id)).toEqual([starter.id]);
    expect(under.find.map((p) => p.id)).toEqual(['church-plan']);

    const all = Array.from({ length: starter.plan.dayCount }, (_, i) => i + 1);
    const done = groupPlans(
      withStartedBundledPlans([church], {
        [starter.id]: progress({ completedDays: all }),
      }),
      { [starter.id]: progress({ completedDays: all }) }
    );
    expect(done.completed.map((p) => p.id)).toEqual([starter.id]);
  });

  it('never offers a starter plan to someone who has not begun it', () => {
    const result = withStartedBundledPlans([church], {});
    expect(result.map((p) => p.id)).toEqual(['church-plan']);
    expect(groupPlans(result, {}).find.map((p) => p.id)).toEqual(['church-plan']);
  });

  it('lists it once when the library already has it', () => {
    const listed = plan(starter.id);
    const result = withStartedBundledPlans([listed], { [starter.id]: progress() });
    expect(result).toEqual([listed]);
  });

  it('has nothing to add for progress on a plan that is not a starter plan', () => {
    // A plan the church has since unpublished: its progress is kept, but it is not
    // brought back from anywhere.
    const result = withStartedBundledPlans([church], { 'unpublished-plan': progress() });
    expect(result.map((p) => p.id)).toEqual(['church-plan']);
  });

  it('does not change the list it was given', () => {
    const library = [church];
    withStartedBundledPlans(library, { [starter.id]: progress() });
    expect(library).toHaveLength(1);
  });
});
