/**
 * The five questions as a state machine.
 *
 *   1  What should we call you?          a name
 *   2  How old are you?                  a number of years
 *   3  What's your phone number?         a country and a number (optional)
 *   4  How do you identify?              Male | Female, nothing preselected
 *   5  Which language would you prefer?  English | Telugu
 *
 * One question per screen, in that order. Everything the member types is
 * held HERE, in memory, and nowhere else: moving back and forward keeps
 * every answer, nothing is written to device storage, and nothing is sent
 * anywhere until the last Continue -- see ./OnboardingScreen.tsx, which is
 * the only place the answers leave.
 *
 * Pure -- no React, no Firestore -- so the rules are tested as rules.
 */
import type { Gender, LanguagePreference } from '../../services/firebase/userProfile';
import { DEFAULT_COUNTRY_ISO, countryByIso } from './countries';
import { isValidAge, isValidFullName } from './profileCompleteness';
import { readPhone, type PhoneProblem } from './phone';

export const STEP_COUNT = 5;
export type StepNumber = 1 | 2 | 3 | 4 | 5;
export type StepName = 'name' | 'age' | 'phone' | 'gender' | 'language';
export const STEP_NAMES: readonly StepName[] = [
  'name',
  'age',
  'phone',
  'gender',
  'language',
];

export function stepName(step: StepNumber): StepName {
  return STEP_NAMES[step - 1];
}

export interface OnboardingForm {
  name: string;
  /** As typed. Parsed by parseAge() when the form is read. */
  age: string;
  countryIso: string;
  /** The number as typed, without the country code (unless it starts with "+"). */
  phone: string;
  /** null until chosen: a default would record an answer nobody gave. */
  gender: Gender | null;
  /** The language the questions are shown in AND the one saved at the end. */
  language: LanguagePreference;
}

export function emptyForm(language: LanguagePreference): OnboardingForm {
  return {
    name: '',
    age: '',
    countryIso: DEFAULT_COUNTRY_ISO,
    phone: '',
    gender: null,
    language,
  };
}

/** Why a step cannot be left yet. Each maps to one sentence per language. */
export type StepProblem =
  | 'nameEmpty'
  | 'nameTooLong'
  | 'ageInvalid'
  | 'phoneEmpty'
  | 'phoneTooShort'
  | 'phoneTooLong'
  | 'phoneInvalid'
  | 'genderMissing';

const PHONE_PROBLEMS: Record<PhoneProblem, StepProblem> = {
  empty: 'phoneEmpty',
  tooShort: 'phoneTooShort',
  tooLong: 'phoneTooLong',
  invalid: 'phoneInvalid',
};

/**
 * What stops `step` from being left, or null if it can be.
 *
 * The phone question is the one the member may decline, so an EMPTY
 * number is a problem for Continue (there is nothing to continue with)
 * but never for the flow: "Skip for now" is its own action.
 */
export function validateStep(step: StepNumber, form: OnboardingForm): StepProblem | null {
  switch (stepName(step)) {
    case 'name': {
      const trimmed = form.name.trim();
      if (trimmed.length === 0) return 'nameEmpty';
      return isValidFullName(form.name) ? null : 'nameTooLong';
    }
    case 'age':
      return isValidAge(form.age) ? null : 'ageInvalid';
    case 'phone': {
      const result = readPhone(form.phone, countryByIso(form.countryIso));
      return result.problem ? PHONE_PROBLEMS[result.problem] : null;
    }
    case 'gender':
      return form.gender === null ? 'genderMissing' : null;
    case 'language':
      return null;
  }
}

export interface FlowState {
  step: StepNumber;
  form: OnboardingForm;
  /**
   * True once the member has pressed Continue on this step and been told
   * what is wrong. Not before: a field should not scold somebody who has
   * not finished typing. Cleared by the next edit.
   */
  showProblem: boolean;
}

export type FlowAction =
  | { type: 'edit'; patch: Partial<OnboardingForm> }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'skipPhone' }
  /** Jump to a question -- used when the last Continue finds one unanswered. */
  | { type: 'goto'; step: StepNumber; showProblem?: boolean };

export function initialFlow(form: OnboardingForm): FlowState {
  return { step: 1, form, showProblem: false };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'edit':
      return { ...state, form: { ...state.form, ...action.patch }, showProblem: false };
    case 'next': {
      if (state.step === STEP_COUNT) return state; // the last Continue is a save, not a step
      if (validateStep(state.step, state.form) !== null) {
        return { ...state, showProblem: true };
      }
      return { ...state, step: (state.step + 1) as StepNumber, showProblem: false };
    }
    case 'back':
      return state.step === 1
        ? state
        : { ...state, step: (state.step - 1) as StepNumber, showProblem: false };
    case 'goto':
      return { ...state, step: action.step, showProblem: action.showProblem ?? false };
    case 'skipPhone':
      // Only the phone question can be skipped. Anything half typed is
      // dropped rather than kept, so a bad number is not saved by accident.
      if (stepName(state.step) !== 'phone') return state;
      return {
        step: (state.step + 1) as StepNumber,
        form: { ...state.form, phone: '' },
        showProblem: false,
      };
  }
}

/**
 * Can this question be answered with nothing? Only the phone one. The
 * screen shows "Skip for now" for it and "Not now" (leave onboarding)
 * for the rest.
 */
export function isSkippable(step: StepNumber): boolean {
  return stepName(step) === 'phone';
}
