import {
  STEP_COUNT,
  STEP_NAMES,
  emptyForm,
  flowReducer,
  initialFlow,
  isSkippable,
  stepName,
  validateStep,
  type FlowState,
  type OnboardingForm,
  type StepNumber,
} from '../onboardingFlow';

/**
 * The five questions, as rules: which order, what blocks a step, what
 * survives going back, and what nothing ever does (preselect an answer).
 */
const filled: OnboardingForm = {
  name: 'Ruth',
  age: '34',
  countryIso: 'IN',
  phone: '9876543210',
  gender: 'female',
  language: 'en',
};

function run(
  state: FlowState,
  ...actions: Parameters<typeof flowReducer>[1][]
): FlowState {
  return actions.reduce(flowReducer, state);
}

describe('the questions', () => {
  it("are five, one per screen, in the brief's order", () => {
    expect(STEP_COUNT).toBe(5);
    expect(STEP_NAMES).toEqual(['name', 'age', 'phone', 'gender', 'language']);
    expect(stepName(1)).toBe('name');
    expect(stepName(5)).toBe('language');
  });

  it('starts with nothing answered: no gender, no age, no number', () => {
    const form = emptyForm('en');
    expect(form.gender).toBeNull();
    expect(form.age).toBe('');
    expect(form.phone).toBe('');
    expect(form.name).toBe('');
    expect(form.countryIso).toBe('IN');
  });

  it('starts the language at the one the member is already reading', () => {
    expect(emptyForm('te').language).toBe('te');
    expect(emptyForm('en').language).toBe('en');
  });
});

describe('what blocks a step', () => {
  it('a name must not be blank or longer than the server accepts', () => {
    expect(validateStep(1, { ...filled, name: '' })).toBe('nameEmpty');
    expect(validateStep(1, { ...filled, name: '   ' })).toBe('nameEmpty');
    expect(validateStep(1, { ...filled, name: 'x'.repeat(201) })).toBe('nameTooLong');
    expect(validateStep(1, { ...filled, name: 'x'.repeat(200) })).toBeNull();
    expect(validateStep(1, { ...filled, name: 'రూతు' })).toBeNull();
  });

  it('an age must be a whole number from 1 to 120', () => {
    expect(validateStep(2, { ...filled, age: '' })).toBe('ageInvalid');
    expect(validateStep(2, { ...filled, age: '0' })).toBe('ageInvalid');
    expect(validateStep(2, { ...filled, age: '121' })).toBe('ageInvalid');
    expect(validateStep(2, { ...filled, age: '34.5' })).toBe('ageInvalid');
    expect(validateStep(2, { ...filled, age: 'abc' })).toBe('ageInvalid');
    expect(validateStep(2, { ...filled, age: '34' })).toBeNull();
  });

  it('a phone number must be a valid one for its country; empty cannot be continued with', () => {
    expect(validateStep(3, { ...filled, phone: '' })).toBe('phoneEmpty');
    expect(validateStep(3, { ...filled, phone: '123' })).toBe('phoneTooShort');
    expect(validateStep(3, { ...filled, phone: '98765432101' })).toBe('phoneTooLong');
    expect(validateStep(3, { ...filled, phone: 'abc' })).toBe('phoneInvalid');
    expect(validateStep(3, { ...filled, phone: '98765 43210' })).toBeNull();
    // A country is part of the answer: ten digits is not a UAE number.
    expect(
      validateStep(3, { ...filled, countryIso: 'AE', phone: '501234567' })
    ).toBeNull();
    expect(validateStep(3, { ...filled, countryIso: 'AE', phone: '5012' })).toBe(
      'phoneTooShort'
    );
  });

  it('a gender must be chosen -- never defaulted', () => {
    expect(validateStep(4, { ...filled, gender: null })).toBe('genderMissing');
    expect(validateStep(4, { ...filled, gender: 'male' })).toBeNull();
    expect(validateStep(4, { ...filled, gender: 'female' })).toBeNull();
  });

  it('the language question always has an answer', () => {
    expect(validateStep(5, { ...filled, language: 'te' })).toBeNull();
  });
});

describe('moving through them', () => {
  const start = initialFlow(filled);

  it('Continue advances one question at a time when the answer is good', () => {
    let s = start;
    for (const expected of [2, 3, 4, 5] as StepNumber[]) {
      s = run(s, { type: 'next' });
      expect(s.step).toBe(expected);
      expect(s.showProblem).toBe(false);
    }
  });

  it('the last Continue is a save, not a step: the machine stays on question 5', () => {
    const s = run({ ...start, step: 5 }, { type: 'next' });
    expect(s.step).toBe(5);
  });

  it('does not advance on a bad answer, and says so', () => {
    const s = run(initialFlow({ ...filled, name: '' }), { type: 'next' });
    expect(s.step).toBe(1);
    expect(s.showProblem).toBe(true);
  });

  it('stops scolding as soon as the member edits', () => {
    let s = run(initialFlow({ ...filled, name: '' }), { type: 'next' });
    expect(s.showProblem).toBe(true);
    s = run(s, { type: 'edit', patch: { name: 'R' } });
    expect(s.showProblem).toBe(false);
    expect(s.form.name).toBe('R');
  });

  it('does not tell somebody off before they have tried to continue', () => {
    const s = run(initialFlow({ ...filled, name: '' }), {
      type: 'edit',
      patch: { name: '' },
    });
    expect(s.showProblem).toBe(false);
  });

  it('Back keeps every answer and never goes before the first question', () => {
    let s = run(start, { type: 'next' }, { type: 'next' }); // now on 3
    expect(s.step).toBe(3);
    s = run(s, { type: 'back' });
    expect(s.step).toBe(2);
    expect(s.form).toEqual(filled);
    s = run(s, { type: 'back' }, { type: 'back' }, { type: 'back' });
    expect(s.step).toBe(1);
    expect(s.form).toEqual(filled);
  });

  it('edits survive a round trip forward and back', () => {
    let s = run(start, { type: 'edit', patch: { name: 'Naomi' } }, { type: 'next' });
    s = run(
      s,
      { type: 'edit', patch: { age: '52' } },
      { type: 'next' },
      { type: 'back' },
      { type: 'back' }
    );
    expect(s.step).toBe(1);
    expect(s.form.name).toBe('Naomi');
    expect(s.form.age).toBe('52');
  });

  it('changing the language mid-way changes the form, not the position', () => {
    const s = run({ ...start, step: 3 }, { type: 'edit', patch: { language: 'te' } });
    expect(s.step).toBe(3);
    expect(s.form.language).toBe('te');
  });
});

describe('skipping the phone question', () => {
  it('is the only question that can be skipped', () => {
    expect(([1, 2, 3, 4, 5] as StepNumber[]).filter(isSkippable)).toEqual([3]);
  });

  it('moves on and drops whatever was half typed', () => {
    const s = run(
      { ...initialFlow({ ...filled, phone: '98765' }), step: 3 },
      { type: 'skipPhone' }
    );
    expect(s.step).toBe(4);
    expect(s.form.phone).toBe('');
  });

  it('does nothing on any other question', () => {
    for (const step of [1, 2, 4, 5] as StepNumber[]) {
      const before = { ...initialFlow(filled), step };
      expect(run(before, { type: 'skipPhone' })).toEqual(before);
    }
  });
});
