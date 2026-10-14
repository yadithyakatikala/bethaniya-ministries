import { describe, expect, it } from 'vitest';
import {
  DAY_LIMITS,
  blankDay,
  dayForStorage,
  dayFromDocument,
  dayHasErrors,
  dayHasReaderText,
  duplicateDay,
  indexOfKey,
  moveDay,
  moveDayTo,
  removeDay,
  validateDay,
  type DayDraft,
} from '../planDays';
import { makeDay } from './fixtures';

function day(key: string, overrides: Partial<DayDraft> = {}): DayDraft {
  return { ...blankDay(key), title: key, passages: ['Psalm 23'], ...overrides };
}

const keys = (days: readonly DayDraft[]) => days.map((d) => d.key);

describe('a day read from Firestore', () => {
  it('splits its passages and keeps its id', () => {
    const draft = dayFromDocument(
      'saved-day-1',
      makeDay({ scriptureReference: 'Psalm 23; John 3:16' })
    );
    expect(draft.passages).toEqual(['Psalm 23', 'John 3:16']);
    expect(draft.id).toBe('day-1');
    expect(draft.key).toBe('saved-day-1');
  });

  it('gives a day with no passage one empty box to fill', () => {
    expect(dayFromDocument('k', makeDay({ scriptureReference: '' })).passages).toEqual([
      '',
    ]);
  });

  it('carries every text field, and reads missing ones as empty', () => {
    const draft = dayFromDocument('k', makeDay({ devotional: '', notes: '' }));
    expect(draft).toMatchObject({
      reflectionQuestion: 'Where has he led you?',
      prayerPrompt: 'Thank him.',
      application: 'Call a friend.',
      devotional: '',
      notes: '',
    });
  });
});

describe('checking a day', () => {
  it('accepts a title and a real passage -- everything else is optional', () => {
    expect(validateDay(day('d1'))).toEqual({});
    expect(dayHasErrors(day('d1'))).toBe(false);
  });

  it('asks for a title', () => {
    expect(validateDay(day('d1', { title: '  ' })).title).toBe('Give this day a title.');
  });

  it('asks for a passage that exists', () => {
    expect(validateDay(day('d1', { passages: [''] })).passages).toBe(
      'Add at least one passage.'
    );
    expect(validateDay(day('d1', { passages: ['John 3:99'] })).passages).toBe(
      'Fix the passages marked below.'
    );
  });

  it.each([
    ['title', DAY_LIMITS.title, 'The title'],
    ['devotional', DAY_LIMITS.devotional, 'The devotional'],
    ['reflectionQuestion', DAY_LIMITS.reflectionQuestion, 'The reflection question'],
    ['prayerPrompt', DAY_LIMITS.prayerPrompt, 'The prayer'],
    ['application', DAY_LIMITS.application, 'The application'],
    ['notes', DAY_LIMITS.notes, 'The notes'],
  ] as const)('limits the %s to %i characters', (field, max, label) => {
    const over = validateDay(day('d1', { [field]: 'x'.repeat(max + 1) }));
    expect(over[field]).toContain(label);
    expect(over[field]).toContain('characters or fewer');
    expect(validateDay(day('d1', { [field]: 'x'.repeat(max) }))[field]).toBeUndefined();
  });

  it('counts the length after trimming, as it is stored', () => {
    expect(
      validateDay(day('d1', { devotional: `  ${'x'.repeat(DAY_LIMITS.devotional)}  ` }))
        .devotional
    ).toBeUndefined();
  });

  it('knows whether a day offers the reader anything beyond the passage', () => {
    expect(dayHasReaderText(day('d1'))).toBe(false);
    expect(dayHasReaderText(day('d1', { prayerPrompt: 'Pray.' }))).toBe(true);
    expect(dayHasReaderText(day('d1', { notes: '  ' }))).toBe(false);
  });
});

describe('a day as it is stored', () => {
  it('trims every field and writes the passages canonically', () => {
    const stored = dayForStorage(
      day('d1', {
        title: '  Shepherd ',
        passages: ['psalms 23', ' john 10:11 - 18 '],
        devotional: ' d ',
        reflectionQuestion: ' q ',
        prayerPrompt: ' p ',
        application: ' a ',
        notes: ' n ',
      })
    );
    expect(stored).toEqual({
      title: 'Shepherd',
      scriptureReference: 'Psalm 23; John 10:11-18',
      devotional: 'd',
      reflectionQuestion: 'q',
      prayerPrompt: 'p',
      application: 'a',
      notes: 'n',
    });
  });
});

describe('arranging the days', () => {
  const list = () => [day('a'), day('b'), day('c')];

  it('moves a day earlier or later by one place', () => {
    expect(keys(moveDay(list(), 'b', 'up'))).toEqual(['b', 'a', 'c']);
    expect(keys(moveDay(list(), 'b', 'down'))).toEqual(['a', 'c', 'b']);
  });

  it('leaves the list alone at either end, or for an unknown day', () => {
    expect(keys(moveDay(list(), 'a', 'up'))).toEqual(['a', 'b', 'c']);
    expect(keys(moveDay(list(), 'c', 'down'))).toEqual(['a', 'b', 'c']);
    expect(keys(moveDay(list(), 'zzz', 'up'))).toEqual(['a', 'b', 'c']);
  });

  it('does not change the list it was given', () => {
    const original = list();
    moveDay(original, 'b', 'up');
    expect(keys(original)).toEqual(['a', 'b', 'c']);
  });

  it('moves a day to an exact place, clamped to the list', () => {
    expect(keys(moveDayTo(list(), 'a', 2))).toEqual(['b', 'c', 'a']);
    expect(keys(moveDayTo(list(), 'c', 0))).toEqual(['c', 'a', 'b']);
    expect(keys(moveDayTo(list(), 'a', 99))).toEqual(['b', 'c', 'a']);
    expect(keys(moveDayTo(list(), 'c', -4))).toEqual(['c', 'a', 'b']);
    expect(keys(moveDayTo(list(), 'b', 1))).toEqual(['a', 'b', 'c']);
    expect(keys(moveDayTo(list(), 'zzz', 1))).toEqual(['a', 'b', 'c']);
  });

  it('copies a day to just after the original, as an unsaved day', () => {
    const original = [day('a', { id: 'doc-a', title: 'Shepherd' }), day('b')];
    const copied = duplicateDay(original, 'a', 'copy-1');
    expect(keys(copied)).toEqual(['a', 'copy-1', 'b']);
    const copy = copied[1]!;
    expect(copy.id).toBeNull();
    expect(copy.title).toBe('Shepherd (copy)');
    expect(copy.passages).toEqual(['Psalm 23']);
    // The copy owns its own passage list.
    copy.passages.push('John 3:16');
    expect(copied[0]!.passages).toEqual(['Psalm 23']);
  });

  it('does not invent a title for a copy of an untitled day', () => {
    const copied = duplicateDay([day('a', { title: '' })], 'a', 'c');
    expect(copied[1]!.title).toBe('');
  });

  it('copies nothing for an unknown day', () => {
    expect(keys(duplicateDay(list(), 'zzz', 'c'))).toEqual(['a', 'b', 'c']);
  });

  it('removes a day', () => {
    expect(keys(removeDay(list(), 'b'))).toEqual(['a', 'c']);
    expect(keys(removeDay(list(), 'zzz'))).toEqual(['a', 'b', 'c']);
  });

  it('finds a day by key', () => {
    expect(indexOfKey(list(), 'c')).toBe(2);
    expect(indexOfKey(list(), 'zzz')).toBe(-1);
  });
});
