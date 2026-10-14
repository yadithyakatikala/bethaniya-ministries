import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATEGORY,
  PLAN_LIMITS,
  detailsForStorage,
  detailsFromPlan,
  emptyDetails,
  firstFreeId,
  hasDetailErrors,
  languageLabel,
  slugify,
  validatePlanDetails,
  validatePlanId,
} from '../planDetails';
import { makePlan } from './fixtures';

describe('a new plan starts sensible', () => {
  it('is English, in a default category, and in no hurry', () => {
    expect(emptyDetails()).toMatchObject({
      title: '',
      category: DEFAULT_CATEGORY,
      language: 'en',
      coverImageUrl: null,
      estimatedMinutes: '',
      order: '0',
    });
  });

  it('reads an existing plan into the form', () => {
    const form = detailsFromPlan(makePlan({ estimatedMinutes: 12, order: 3 }));
    expect(form).toMatchObject({
      title: 'Seven Days in the Psalms',
      estimatedMinutes: '12',
      order: '3',
      language: 'en',
    });
  });

  it('reads a plan written before language existed as English', () => {
    expect(detailsFromPlan(makePlan({ language: null })).language).toBe('en');
  });

  it('leaves minutes empty when the plan gives none', () => {
    expect(detailsFromPlan(makePlan({ estimatedMinutes: null })).estimatedMinutes).toBe(
      ''
    );
  });
});

describe('checking the details', () => {
  const valid = () => ({ ...emptyDetails(), title: 'A plan' });

  it('accepts a title and a category and nothing else -- a draft is allowed to be short', () => {
    expect(hasDetailErrors(validatePlanDetails(valid()))).toBe(false);
  });

  it.each([
    ['title', { title: '   ' }, 'Give the plan a title.'],
    ['title', { title: 't'.repeat(201) }, 'Title must be 200 characters or fewer.'],
    [
      'subtitle',
      { subtitle: 's'.repeat(201) },
      'Subtitle must be 200 characters or fewer.',
    ],
    [
      'description',
      { description: 'd'.repeat(2001) },
      'Description must be 2,000 characters or fewer.',
    ],
    ['category', { category: '' }, 'Choose or type a category.'],
    [
      'category',
      { category: 'c'.repeat(101) },
      'Category must be 100 characters or fewer.',
    ],
    ['author', { author: 'a'.repeat(121) }, 'Author must be 120 characters or fewer.'],
    ['estimatedMinutes', { estimatedMinutes: '0' }, undefined],
    ['estimatedMinutes', { estimatedMinutes: '241' }, undefined],
    ['estimatedMinutes', { estimatedMinutes: '7.5' }, undefined],
    ['estimatedMinutes', { estimatedMinutes: 'ten' }, undefined],
    ['order', { order: '' }, 'Use a whole number. Lower numbers appear first.'],
    ['order', { order: '1.5' }, 'Use a whole number. Lower numbers appear first.'],
    ['order', { order: 'first' }, 'Use a whole number. Lower numbers appear first.'],
  ] as const)('refuses a bad %s (%o)', (field, fields, expected) => {
    const errors = validatePlanDetails({ ...valid(), ...fields });
    expect(errors[field]).toBeDefined();
    if (expected) expect(errors[field]).toBe(expected);
  });

  it('accepts the edges of each limit', () => {
    const errors = validatePlanDetails({
      ...valid(),
      title: 't'.repeat(200),
      subtitle: 's'.repeat(200),
      description: 'd'.repeat(2000),
      category: 'c'.repeat(100),
      author: 'a'.repeat(120),
      estimatedMinutes: '240',
      order: '-5',
    });
    expect(hasDetailErrors(errors)).toBe(false);
    expect(
      hasDetailErrors(validatePlanDetails({ ...valid(), estimatedMinutes: '1' }))
    ).toBe(false);
  });

  it('allows minutes to be left empty', () => {
    expect(
      validatePlanDetails({ ...valid(), estimatedMinutes: '  ' }).estimatedMinutes
    ).toBeUndefined();
  });

  it('states the minutes range in the message', () => {
    const { min, max } = PLAN_LIMITS.estimatedMinutes;
    expect(
      validatePlanDetails({ ...valid(), estimatedMinutes: '999' }).estimatedMinutes
    ).toContain(`${min} to ${max}`);
  });
});

describe('details as they are stored', () => {
  it('trims, parses the numbers and keeps the language', () => {
    expect(
      detailsForStorage({
        ...emptyDetails(),
        title: '  A plan  ',
        subtitle: ' sub ',
        description: ' d ',
        category: ' Topical ',
        author: ' Me ',
        language: 'te',
        estimatedMinutes: ' 15 ',
        order: ' 4 ',
        coverImageUrl: 'https://example.org/c.jpg',
      })
    ).toEqual({
      title: 'A plan',
      subtitle: 'sub',
      description: 'd',
      category: 'Topical',
      author: 'Me',
      language: 'te',
      estimatedMinutes: 15,
      order: 4,
      coverImageUrl: 'https://example.org/c.jpg',
    });
  });

  it('stores no minutes as null, not 0', () => {
    expect(detailsForStorage(emptyDetails()).estimatedMinutes).toBeNull();
  });

  it('names languages', () => {
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('te')).toBe('Telugu');
    expect(languageLabel(null)).toBe('');
  });
});

describe('the plan id', () => {
  it.each([
    ['Seven Days in the Psalms', 'seven-days-in-the-psalms'],
    ['  Faith & Works!  ', 'faith-and-works'],
    ['Café Études', 'cafe-etudes'],
    ['30 Days -- of Prayer', '30-days-of-prayer'],
    ['---', ''],
    ['కీర్తనలు', ''],
  ])('makes %j into %j', (title, id) => {
    expect(slugify(title)).toBe(id);
  });

  it('cuts a long title at a word, within the limit', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(PLAN_LIMITS.idLength.max);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug.startsWith('word-word')).toBe(true);
  });

  it('accepts a good id and says why it refuses a bad one', () => {
    expect(validatePlanId('seven-days')).toBeNull();
    expect(validatePlanId('7d-prayer')).toBeNull();
    expect(validatePlanId('')).toContain('Choose an ID');
    expect(validatePlanId('ab')).toContain('at least 3');
    expect(validatePlanId('a'.repeat(65))).toContain('64 characters or fewer');
    expect(validatePlanId('Seven-Days')).toContain('lowercase');
    expect(validatePlanId('seven days')).toContain('lowercase');
    expect(validatePlanId('seven--days')).toContain('single hyphens');
    expect(validatePlanId('-seven')).toContain('single hyphens');
    expect(validatePlanId('seven-')).toContain('single hyphens');
    expect(validatePlanId('new')).toContain('reserved');
  });

  it('finds a free id by numbering', async () => {
    const taken = new Set(['prayer', 'prayer-2']);
    expect(await firstFreeId('prayer', async (id) => taken.has(id))).toBe('prayer-3');
    expect(await firstFreeId('fresh', async (id) => taken.has(id))).toBe('fresh');
    expect(await firstFreeId('', async () => false)).toBe('plan');
  });

  it('keeps a numbered id inside the length limit', async () => {
    const base = 'a'.repeat(64);
    const taken = new Set([base]);
    const id = await firstFreeId(base, async (candidate) => taken.has(candidate));
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.endsWith('-2')).toBe(true);
  });
});
