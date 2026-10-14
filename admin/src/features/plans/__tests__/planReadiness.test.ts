import { describe, expect, it } from 'vitest';
import { blankDay, type DayDraft } from '../planDays';
import { emptyDetails, type PlanDetailsForm } from '../planDetails';
import { blockingIssues, canSaveDraft, isReady, planReadiness } from '../planReadiness';

function details(overrides: Partial<PlanDetailsForm> = {}): PlanDetailsForm {
  return {
    ...emptyDetails(),
    title: 'Seven Days',
    description: 'A week.',
    coverImageUrl: 'https://example.org/c.jpg',
    ...overrides,
  };
}

function day(key: string, overrides: Partial<DayDraft> = {}): DayDraft {
  return {
    ...blankDay(key),
    title: `Day ${key}`,
    passages: ['Psalm 23'],
    devotional: 'Rest.',
    ...overrides,
  };
}

const ids = (issues: ReturnType<typeof planReadiness>) => issues.map((issue) => issue.id);

describe('a plan that is ready', () => {
  it('has no issues at all', () => {
    expect(planReadiness(details(), [day('1'), day('2')])).toEqual([]);
    expect(isReady(details(), [day('1')])).toBe(true);
  });
});

describe('what stops a plan being published', () => {
  it('needs a title', () => {
    const issues = planReadiness(details({ title: ' ' }), [day('1')]);
    expect(blockingIssues(issues).map((issue) => issue.id)).toContain('title');
    expect(issues.find((i) => i.id === 'title')).toMatchObject({ tab: 'details' });
  });

  it('needs a description -- it is what members read before they start', () => {
    const issues = planReadiness(details({ description: '' }), [day('1')]);
    expect(issues.find((i) => i.id === 'description')).toMatchObject({
      severity: 'error',
      tab: 'details',
    });
    expect(isReady(details({ description: '   ' }), [day('1')])).toBe(false);
  });

  it('needs at least one day', () => {
    const issues = planReadiness(details(), []);
    expect(issues.find((i) => i.id === 'no-days')).toMatchObject({
      severity: 'error',
      tab: 'days',
    });
  });

  it('refuses more days than a year', () => {
    const many = Array.from({ length: 367 }, (_, n) => day(String(n)));
    expect(ids(planReadiness(details(), many))).toContain('too-many-days');
    expect(isReady(details(), many.slice(0, 366))).toBe(true);
  });

  it('points at the day with a missing title, naming it', () => {
    const issues = planReadiness(details(), [day('1'), day('2', { title: '' })]);
    const issue = issues.find((i) => i.id === '2-title');
    expect(issue).toMatchObject({ severity: 'error', tab: 'days', dayKey: '2' });
    expect(issue?.message).toBe('Day 2: Give this day a title.');
  });

  it('points at the day whose passage does not exist, and says which passage and why', () => {
    const issues = planReadiness(details(), [
      day('1', { passages: ['Psalm 23', 'John 3:99'] }),
    ]);
    const issue = issues.find((i) => i.id === '1-passages');
    expect(issue).toMatchObject({ severity: 'error', tab: 'days', dayKey: '1' });
    expect(issue?.message).toContain('John 3 has 36 verses.');
  });

  it('points at a day with no passage at all', () => {
    const issues = planReadiness(details(), [day('1', { passages: [''] })]);
    expect(issues.find((i) => i.id === '1-passages')?.message).toBe(
      'Day 1 ("Day 1"): Add at least one passage.'
    );
  });

  it('refuses text that is too long, field by field', () => {
    const issues = planReadiness(details(), [
      day('1', { devotional: 'x'.repeat(5001), notes: 'x'.repeat(3001) }),
    ]);
    expect(ids(issues)).toEqual(expect.arrayContaining(['1-devotional', '1-notes']));
  });

  it('reports every problem at once, not the first', () => {
    const issues = planReadiness(details({ title: '', description: '' }), [
      day('1', { title: '' }),
      day('2', { passages: [''] }),
    ]);
    expect(blockingIssues(issues).length).toBeGreaterThanOrEqual(4);
  });

  it('refuses a plan whose numbers cannot be stored', () => {
    expect(
      ids(planReadiness(details({ estimatedMinutes: '999' }), [day('1')]))
    ).toContain('estimatedMinutes');
    expect(ids(planReadiness(details({ order: 'x' }), [day('1')]))).toContain('order');
  });
});

describe('what is only worth knowing', () => {
  it('warns about a missing cover, without blocking', () => {
    const issues = planReadiness(details({ coverImageUrl: null }), [day('1')]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id: 'cover', severity: 'warning', tab: 'details' });
    expect(isReady(details({ coverImageUrl: null }), [day('1')])).toBe(true);
  });

  it('warns about a day that is only a passage', () => {
    const issues = planReadiness(details(), [day('1', { devotional: '' })]);
    expect(issues).toEqual([
      expect.objectContaining({ id: '1-bare', severity: 'warning', dayKey: '1' }),
    ]);
    expect(isReady(details(), [day('1', { devotional: '' })])).toBe(true);
  });

  it('does not call a day bare when it has a reflection question, prayer, application or notes', () => {
    for (const field of [
      'reflectionQuestion',
      'prayerPrompt',
      'application',
      'notes',
    ] as const) {
      expect(
        planReadiness(details(), [day('1', { devotional: '', [field]: 'x' })])
      ).toEqual([]);
    }
  });
});

describe('what stops a draft being saved', () => {
  it('lets a title and a category be enough, with no days', () => {
    expect(canSaveDraft(details({ description: '' }), [])).toBe(true);
  });

  it('refuses a draft with no title, or a bad number', () => {
    expect(canSaveDraft(details({ title: '' }), [])).toBe(false);
    expect(canSaveDraft(details({ order: 'x' }), [])).toBe(false);
    expect(canSaveDraft(details({ category: '' }), [])).toBe(false);
  });

  it('refuses a draft with a day that has no title or no passage -- a day cannot be stored without them', () => {
    expect(canSaveDraft(details(), [day('1', { title: '' })])).toBe(false);
    expect(canSaveDraft(details(), [day('1', { passages: [''] })])).toBe(false);
    expect(canSaveDraft(details(), [day('1', { passages: ['Jn 3:16'] })])).toBe(false);
  });

  it('does not mind a day lacking its optional text', () => {
    expect(canSaveDraft(details(), [day('1', { devotional: '' })])).toBe(true);
  });

  it('refuses more days than the editor allows', () => {
    const many = Array.from({ length: 367 }, (_, n) => day(String(n)));
    expect(canSaveDraft(details(), many)).toBe(false);
  });
});
