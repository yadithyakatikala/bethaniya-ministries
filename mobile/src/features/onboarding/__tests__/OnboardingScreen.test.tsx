import { BackHandler, Keyboard } from 'react-native';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { translate } from '../../../i18n/strings';
import { lightTokens } from '../../../theme/tokens';
import {
  installAnimatedDriver,
  type AnimatedDriver,
} from '../../../testing/animatedDriver';
import { installFrameClock, type FrameClock } from '../../../testing/frameClock';
import { RESUME_START } from '../../opening/engine/chapter';
import { FORM_START_SECONDS } from '../components/ChapterLayer';
import {
  GOOD,
  answerAll,
  answers,
  mockSignedIn,
  renderGate,
  skipChapter,
} from '../../../testing/onboardingHarness';

jest.mock('../../../services/firebase/app');

let mockReducedMotion = false;
jest.mock('../../../theme/motion', () => ({
  ...jest.requireActual('../../../theme/motion'),
  useReducedMotion: () => mockReducedMotion,
}));

/**
 * The five questions: what each one asks, what it accepts, what it does
 * with the keyboard, and what it leaves behind. The gate's own behaviour
 * -- who sees it, what is written, what a failed save does -- is in
 * ./OnboardingGate.test.tsx.
 */
let clock: FrameClock;
let driver: AnimatedDriver;

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion = false;
  clock = installFrameClock();
  driver = installAnimatedDriver();
  (updateDoc as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
  clock.restore();
  driver.restore();
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  jest.restoreAllMocks();
});

async function openForm(profile: Record<string, unknown> | null = { role: 'member' }) {
  const server = mockSignedIn('member-1');
  const screen = await renderGate();
  await server.emit(profile);
  await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
  return { screen, server };
}

const en = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>
) => translate('en', key, vars);
const te = (
  key: Parameters<typeof translate>[1],
  vars?: Record<string, string | number>
) => translate('te', key, vars);

/** The school is decorative, so it is hidden from the accessibility tree and has to be asked for. */
const HIDDEN = { includeHiddenElements: true } as const;

/** A heading's hand-set line break is for the eye: the wording is what most tests check. */
const oneLine = (text: string): string => text.replace(/\s*\n\s*/g, ' ');

function title(screen: Awaited<ReturnType<typeof openForm>>['screen']): string {
  const node = screen.getByTestId('onboarding-title');
  return oneLine([node.props.children].flat().join(''));
}

describe('the five questions', () => {
  it("are asked one at a time, in the brief's order, with nothing preselected", async () => {
    const { screen } = await openForm();
    await skipChapter(screen);

    expect(title(screen)).toBe('What should we call you?');
    await answers.name(screen, 'Ruth');
    expect(title(screen)).toBe('How old are you?');
    await answers.age(screen, '34');
    expect(title(screen)).toBe("What's your phone number?");
    await answers.phone(screen, '9876543210');
    expect(title(screen)).toBe('How do you identify?');
    // Neither choice is selected until the member chooses.
    for (const g of ['male', 'female']) {
      expect(
        screen.getByTestId(`onboarding-gender-${g}`).props.accessibilityState.selected
      ).toBe(false);
    }
    await answers.gender(screen, 'male');
    expect(title(screen)).toBe('Which language would you prefer?');
  });

  it('set the English headings in two balanced lines, as the design draws them', async () => {
    // React Native cannot balance a heading's lines, so the break is in the
    // wording: "What should / we call you?", never "What should we call / you?".
    expect(en('onboarding.q1')).toBe('What should\nwe call you?');
    expect(en('onboarding.q3')).toBe("What's your\nphone number?");
    expect(en('onboarding.q5')).toBe('Which language\nwould you prefer?');
    // Telugu is not broken by hand.
    for (const key of ['q1', 'q2', 'q3', 'q4', 'q5'] as const) {
      expect(te(`onboarding.${key}`)).not.toContain('\n');
    }

    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-title').props.children).toBe(
      'What should\nwe call you?'
    );
    // ...but whatever reads the question out reads it as one line.
    expect(screen.getByTestId('onboarding-full-name').props.accessibilityLabel).toBe(
      'What should we call you?'
    );
  });

  it('say what the answer is for, and what it is not', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth');
    await answers.age(screen, '34');
    // The phone question says out loud that no code is coming.
    expect(screen.getByTestId('onboarding-support').props.children).toBe(
      en('onboarding.s3')
    );
    expect(en('onboarding.s3')).toMatch(/not send you a code/i);
    expect(en('onboarding.s3')).toMatch(/not used to sign in/i);
  });

  it('show a progress indicator that says where the member is, in words', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    const progress = () => screen.getByTestId('onboarding-progress').props;

    expect(progress().accessibilityRole).toBe('progressbar');
    expect(progress().accessibilityLabel).toBe('Step 1 of 5');
    expect(progress().accessibilityValue).toEqual({ min: 1, max: 5, now: 1 });
    await answers.name(screen, 'Ruth');
    expect(progress().accessibilityLabel).toBe('Step 2 of 5');
    expect(progress().accessibilityValue.now).toBe(2);
  });

  it('have no Back on the first question and a Back on every other', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
    await answers.name(screen, 'Ruth');
    expect(screen.getByTestId('onboarding-back')).toBeTruthy();
    expect(screen.getByTestId('onboarding-back').props.accessibilityLabel).toBe('Back');
  });

  it('keep every answer when the member goes back and forward', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await answers.name(screen, 'Naomi');
    await answers.age(screen, '52');
    await answers.phone(screen, '98765 43210');
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    await fireEvent.press(screen.getByTestId('onboarding-back'));

    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Naomi');
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(screen.getByTestId('onboarding-age').props.value).toBe('52');
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(screen.getByTestId('onboarding-phone').props.value).toBe('98765 43210');
  });

  it("takes Android's back button as Back, and leaves it alone on the first question", async () => {
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      _event: string,
      handler: () => boolean
    ) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    }) as unknown as typeof BackHandler.addEventListener);

    const { screen } = await openForm();
    await skipChapter(screen);
    const press = async () => {
      let handled = false;
      await act(async () => {
        handled = handlers[handlers.length - 1]();
      });
      return handled;
    };
    expect(await press()).toBe(false); // question 1: not ours -- the system decides
    await answers.name(screen, 'Ruth');
    expect(title(screen)).toBe('How old are you?');
    expect(await press()).toBe(true);
    await waitFor(() => expect(title(screen)).toBe('What should we call you?'));
  });
});

describe('the name', () => {
  it('is required, and the sentence says so', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(screen.getByTestId('onboarding-full-name-error').props.children).toBe(
      en('onboarding.fullNameError')
    );
    // ...and stops when they start typing.
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'R');
    expect(screen.queryByTestId('onboarding-full-name-error')).toBeNull();
  });

  it('accepts a Telugu name, in the face that can draw it', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'రూతు');
    const family = (n: ReturnType<typeof screen.getByTestId>) =>
      JSON.stringify(n.props.style);
    expect(family(screen.getByTestId('onboarding-full-name'))).toContain(
      'NotoSerifTelugu-SemiBold'
    );
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth రూతు');
    expect(family(screen.getByTestId('onboarding-full-name'))).toContain(
      'HindGuntur-SemiBold'
    );
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth');
    expect(family(screen.getByTestId('onboarding-full-name'))).toContain(
      'NotoSerif-SemiBold'
    );
  });
});

describe('the age', () => {
  async function onAge() {
    const opened = await openForm();
    await skipChapter(opened.screen);
    await answers.name(opened.screen, 'Ruth');
    return opened.screen;
  }

  it('is a number on a number pad, up to three digits', async () => {
    const screen = await onAge();
    const input = screen.getByTestId('onboarding-age');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.maxLength).toBe(3);
  });

  it('refuses what is not a whole number of years, and says how to fix it', async () => {
    const screen = await onAge();
    for (const bad of ['', '0', '121', '12.5', 'abc']) {
      await fireEvent.changeText(screen.getByTestId('onboarding-age'), bad);
      await fireEvent.press(screen.getByTestId('onboarding-continue'));
      expect(screen.getByTestId('onboarding-age-error').props.children).toBe(
        en('onboarding.ageError')
      );
      expect(title(screen)).toBe('How old are you?');
    }
  });

  it('accepts the numerals a Telugu keyboard types', async () => {
    const screen = await onAge();
    await answers.age(screen, '౩౪');
    expect(title(screen)).toBe("What's your phone number?");
  });

  it('has no under-18 branch: a child gets the same questions', async () => {
    const screen = await onAge();
    await answers.age(screen, '12');
    expect(title(screen)).toBe("What's your phone number?");
  });
});

describe('the phone number', () => {
  async function onPhone() {
    const opened = await openForm();
    await skipChapter(opened.screen);
    await answers.name(opened.screen, 'Ruth');
    await answers.age(opened.screen, '34');
    return opened;
  }

  it('starts in India, and says so on the country chip', async () => {
    const { screen } = await onPhone();
    const chip = screen.getByTestId('onboarding-country');
    expect(chip.props.accessibilityLabel).toBe(
      en('onboarding.countryLabel', { name: 'India', dial: '91' })
    );
  });

  it('gives an Indian number its own sentence: ten digits', async () => {
    const { screen } = await onPhone();
    await answers.phone(screen, '98765');
    expect(screen.getByTestId('onboarding-phone-error').props.children).toBe(
      en('onboarding.phoneErrorIndia')
    );
  });

  it('is skippable, on this question only -- and Skip leaves the number out', async () => {
    const { screen } = await onPhone();
    expect(screen.getByTestId('onboarding-skip-phone')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '98765'); // half typed
    await fireEvent.press(screen.getByTestId('onboarding-skip-phone'));
    expect(title(screen)).toBe('How do you identify?');
    // Every other question has "Not now" instead.
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-skip-phone')).toBeNull();

    // And the half-typed number was dropped, not kept.
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('onboarding-phone').props.value).toBe('');
  });

  it('can be set to another country, and the number is saved with that country', async () => {
    const { screen } = await onPhone();
    await fireEvent.press(screen.getByTestId('onboarding-country'));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-country-sheet')).toBeTruthy()
    );
    expect(
      screen.getByTestId('onboarding-country-IN').props.accessibilityState.selected
    ).toBe(true);
    await fireEvent.press(screen.getByTestId('onboarding-country-US'));
    expect(screen.getByTestId('onboarding-country').props.accessibilityLabel).toContain(
      'United States'
    );

    await answers.phone(screen, '415 555 0132');
    await answers.gender(screen, 'female');
    await fireEvent.press(screen.getByTestId('onboarding-submit'));
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());

    const written = (updateDoc as jest.Mock).mock.calls.find(
      ([, d]) => 'profileCompletedAt' in d
    )![1];
    expect(written.phoneNumber).toBe('+14155550132');
  });

  it('takes a number typed with its own +, whatever country is selected', async () => {
    const { screen } = await onPhone();
    await answers.phone(screen, '+44 20 7946 0958');
    await answers.gender(screen, 'male');
    await fireEvent.press(screen.getByTestId('onboarding-submit'));
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    const written = (updateDoc as jest.Mock).mock.calls.find(
      ([, d]) => 'profileCompletedAt' in d
    )![1];
    expect(written.phoneNumber).toBe('+442079460958');
  });

  it('shows the country names in the language of the questions', async () => {
    const { screen } = await onPhone();
    await fireEvent.press(screen.getByTestId('onboarding-lang-te'));
    await fireEvent.press(screen.getByTestId('onboarding-country'));
    expect(
      screen.getByTestId('onboarding-country-IN').props.accessibilityLabel
    ).toContain('భారతదేశం');
  });
});

describe('the language switch in the header', () => {
  it('changes the language of the questions at once, and only theirs', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(title(screen)).toBe(oneLine(en('onboarding.q1')));

    await fireEvent.press(screen.getByTestId('onboarding-lang-te'));
    expect(title(screen)).toBe(te('onboarding.q1'));
    expect(screen.getByTestId('onboarding-support').props.children).toBe(
      te('onboarding.s1')
    );
    expect(
      screen.getByTestId('onboarding-lang-te').props.accessibilityState.selected
    ).toBe(true);
    expect(
      screen.getByTestId('onboarding-lang-en').props.accessibilityState.selected
    ).toBe(false);

    // The rest of the app has not moved: nothing is saved until the answer is.
    expect(await AsyncStorage.getItem('app_language_preference')).not.toBe('te');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('is there on the first four questions and gone on the fifth, which IS that question', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-lang')).toBeTruthy();
    await answers.name(screen, 'Ruth');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    await answers.gender(screen, 'female');
    expect(screen.queryByTestId('onboarding-lang')).toBeNull();
  });

  it('is the same choice as the fifth question: switching in the header pre-selects it there', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await fireEvent.press(screen.getByTestId('onboarding-lang-te'));
    await answers.name(screen, 'రూతు');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    await answers.gender(screen, 'female');
    expect(
      screen.getByTestId('onboarding-language-te').props.accessibilityState.selected
    ).toBe(true);
    expect(
      screen.getByTestId('onboarding-language-en').props.accessibilityState.selected
    ).toBe(false);
  });

  it('names each language in its own script, whichever language the questions are in', async () => {
    // "English" in Telugu script, set in the Latin-only serif, would fall to
    // the system face; every language is named as its own readers write it,
    // with the other script's rendering beneath.
    const { screen } = await openForm();
    await skipChapter(screen);
    await fireEvent.press(screen.getByTestId('onboarding-lang-te'));
    await answers.name(screen, 'రూతు');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    await answers.gender(screen, 'female');
    expect(screen.getByTestId('onboarding-language-en').props.accessibilityLabel).toBe(
      'English, ఇంగ్లీష్'
    );
    expect(screen.getByTestId('onboarding-language-te').props.accessibilityLabel).toBe(
      'తెలుగు, Telugu'
    );
  });

  it('offers only the languages the app really has', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    await answers.gender(screen, 'female');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'English, ఇంగ్లీష్',
      'తెలుగు, Telugu',
    ]);
  });

  it('starts at the language the app is already in', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { screen } = await openForm({ role: 'member', appLanguage: 'te' });
    await skipChapter(screen);
    expect(title(screen)).toBe(te('onboarding.q1'));
  });
});

describe('what is kept', () => {
  it('holds every answer in memory only: nothing typed reaches device storage', async () => {
    const { screen } = await openForm();
    await answerAll(screen, { ...GOOD, name: 'Ruth Samuel', language: 'en' });
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());

    const stored = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.multiGet(stored);
    const everything = JSON.stringify(values);
    // The answers went to the profile -- not to the device.
    for (const secret of ['Ruth Samuel', '9876543210', '"34"', 'female']) {
      expect(everything).not.toContain(secret);
    }
    // What the device does hold: the two language preferences and "chapter seen".
    expect([...stored].sort()).toEqual(
      [
        'app_language_preference',
        'bible_mode_preference',
        'onboarding_chapter_seen',
      ].sort()
    );
  });
});

describe('Continue', () => {
  const asleep = { backgroundColor: lightTokens.disabledSurface };
  const awake = { backgroundColor: lightTokens.primary };

  it('looks asleep until the answer is complete, and wakes up when it is', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(asleep);
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'R');
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(awake);
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), '   ');
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(asleep);
  });

  it('still answers a press while asleep, by saying what is missing', async () => {
    // A disabled button cannot explain itself, and to a screen reader it is a
    // dead end. This one is announced as an ordinary button.
    const { screen } = await openForm();
    await skipChapter(screen);
    const button = screen.getByTestId('onboarding-continue');
    expect(button.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(button);
    expect(screen.getByTestId('onboarding-full-name-error')).toBeTruthy();
    expect(title(screen)).toBe('What should we call you?'); // and it has not moved on
  });

  it('sleeps on the age until it is a real age, and on the choice until one is made', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth');
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(asleep);
    await fireEvent.changeText(screen.getByTestId('onboarding-age'), '0');
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(asleep);
    await fireEvent.changeText(screen.getByTestId('onboarding-age'), '34');
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(awake);
    await answers.age(screen, '34');
    // the phone number is optional, so there is a way past it beside Continue
    expect(screen.getByTestId('onboarding-skip-phone')).toBeTruthy();
    await answers.phone(screen, '9876543210');
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(asleep);
    await fireEvent.press(screen.getByTestId('onboarding-gender-male'));
    expect(screen.getByTestId('onboarding-continue')).toHaveStyle(awake);
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    // the language always has an answer, so the last Continue is never asleep
    expect(screen.getByTestId('onboarding-submit')).toHaveStyle(awake);
  });
});

describe('a chosen row', () => {
  it('is marked in ink, with a tick: gold stays thin, never a ground', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    const female = () => screen.getByTestId('onboarding-gender-female');
    expect(female()).toHaveStyle({
      borderColor: lightTokens.border,
      backgroundColor: lightTokens.surface,
    });
    await fireEvent.press(female());
    expect(female()).toHaveStyle({
      borderColor: lightTokens.ink,
      backgroundColor: lightTokens.surfaceRaised,
    });
    expect(female().props.accessibilityState.selected).toBe(true);
    // nothing about it is the accent
    const style = JSON.stringify(female().props.style);
    expect(style).not.toContain(lightTokens.accent);
    expect(style).not.toContain(lightTokens.accentTint);
  });
});

describe('the chapter', () => {
  it('can be skipped with a tap, and the first question is then fully usable', async () => {
    const { screen } = await openForm();
    expect(screen.getByTestId('onboarding-chapter-skip').props.accessibilityLabel).toBe(
      en('onboarding.chapterSkip')
    );
    await fireEvent.press(screen.getByTestId('onboarding-chapter-skip'));

    expect(screen.queryByTestId('onboarding-chapter-skip')).toBeNull();
    expect(screen.queryByTestId('chapter-canvas')).toBeNull();
    // The school is in the layout now, above the question.
    expect(screen.getByTestId('school-band', HIDDEN)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth');
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth');
  });

  it('leaves the form untouchable until it has risen, so a tap anywhere reaches the skip target beneath', async () => {
    // The form fills the screen and sits ABOVE the chapter. A view on top
    // takes the touch whether or not it can use it, so unless the form lets
    // touches fall through, "tap anywhere to skip" never reaches the skip
    // target -- and a tap on a button nobody can see yet would press it.
    const { screen } = await openForm();
    expect(screen.getByTestId('onboarding-form').props.pointerEvents).toBe('none');
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    expect(screen.queryByTestId('onboarding-full-name-error')).toBeNull();
    expect(title(screen)).toBe(oneLine(en('onboarding.q1')));
  });

  it('takes touches again as soon as the question has finished rising, before the chapter is over', async () => {
    const { screen } = await openForm();
    await act(async () => clock.run(Math.ceil(((FORM_START_SECONDS + 0.3) * 1000) / 16)));
    // The rise has begun, and is not finished: still no touches for the form.
    const rise = driver.started.find((a) => a.kind === 'timing' && a.duration === 860);
    expect(rise).toBeDefined();
    expect(screen.getByTestId('onboarding-form').props.pointerEvents).toBe('none');
    await act(async () => driver.completeNext());
    expect(screen.getByTestId('onboarding-form').props.pointerEvents).toBe('auto');
    // ...and the chapter is still behind it, finishing.
    expect(screen.getByTestId('chapter-canvas')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth');
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth');
  });

  it('takes touches the moment the chapter is skipped', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-form').props.pointerEvents).toBe('auto');
  });

  it('plays in full on a device that has not seen it: the question rises at about 3.5 s', async () => {
    const { screen } = await openForm();
    const rises = () => driver.started.filter((a) => a.duration === 860);
    await act(async () => clock.run(Math.ceil(((FORM_START_SECONDS - 0.4) * 1000) / 16)));
    expect(rises()).toHaveLength(0);
    expect(screen.getByTestId('chapter-canvas')).toBeTruthy();
    await act(async () => clock.run(Math.ceil((0.6 * 1000) / 16)));
    expect(rises()).toHaveLength(1);
  });

  it('plays the two-second version on a device that has: the question rises half a second in', async () => {
    await AsyncStorage.setItem('onboarding_chapter_seen', '1');
    const { screen } = await openForm();
    const rises = () => driver.started.filter((a) => a.duration === 860);
    expect(screen.getByTestId('chapter-canvas')).toBeTruthy();
    await act(async () =>
      clock.run(Math.ceil(((FORM_START_SECONDS - RESUME_START - 0.3) * 1000) / 16))
    );
    expect(rises()).toHaveLength(0);
    await act(async () => clock.run(Math.ceil((0.5 * 1000) / 16)));
    expect(rises()).toHaveLength(1);
  });

  it('plays over the first question, and is not replayed as the member moves on', async () => {
    const { screen } = await openForm();
    expect(screen.getByTestId('chapter-canvas')).toBeTruthy();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth');
    await answers.age(screen, '34');
    expect(screen.queryByTestId('chapter-canvas')).toBeNull();
    expect(screen.queryByTestId('onboarding-chapter-skip')).toBeNull();
    expect(screen.getByTestId('school-band', HIDDEN)).toBeTruthy();
  });

  it('remembers on this device that it has been seen', async () => {
    const { screen } = await openForm();
    expect(await AsyncStorage.getItem('onboarding_chapter_seen')).toBeNull();
    await skipChapter(screen);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('onboarding_chapter_seen')).toBe('1')
    );
  });

  it('never covers the school with the question: the band is above it in the layout', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    const band = screen.getByTestId('school-band', HIDDEN);
    expect(band.props.pointerEvents).toBe('none');
    expect(band.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('with the phone set to reduce motion', () => {
  beforeEach(() => {
    mockReducedMotion = true;
  });

  it('there is no chapter: the question is simply there, with the school still', async () => {
    const { screen } = await openForm();
    expect(screen.queryByTestId('chapter-canvas')).toBeNull();
    expect(screen.queryByTestId('onboarding-chapter-skip')).toBeNull();
    expect(screen.getByTestId('school-band', HIDDEN)).toBeTruthy();
    expect(title(screen)).toBe(oneLine(en('onboarding.q1')));
    // Nothing is waiting for a clock: the school does not sway.
    await act(async () => clock.run(30));
    expect(clock.pending()).toBe(0);
  });

  it('the questionnaire works exactly the same', async () => {
    const { screen } = await openForm();
    await answerAll(screen, GOOD);
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
  });
});

describe('with the keyboard up', () => {
  function captureKeyboard() {
    const listeners: Record<string, (event: unknown) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      handler: (e: unknown) => void
    ) => {
      listeners[event] = handler;
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);
    const names = { show: 'keyboardDidShow', willShow: 'keyboardWillShow' };
    return {
      show: (height: number) =>
        act(() => {
          (listeners[names.willShow] ?? listeners[names.show])({
            endCoordinates: { height },
          });
        }),
      hide: () =>
        act(() => {
          (listeners.keyboardWillHide ?? listeners.keyboardDidHide)({});
        }),
    };
  }

  it('the quiet link steps aside, and comes back when the keyboard closes', async () => {
    const keyboard = captureKeyboard();
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();
    await keyboard.show(300);
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    // Continue stays: it is always reachable.
    expect(screen.getByTestId('onboarding-continue')).toBeTruthy();
    await keyboard.hide();
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();
  });

  it('on a very short screen the support sentence steps aside too', async () => {
    const keyboard = captureKeyboard();
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-support')).toBeTruthy();
    // jest's window is 750 x 1334: a 1000-tall keyboard leaves 334 -- under 400.
    await keyboard.show(1000);
    expect(screen.queryByTestId('onboarding-support')).toBeNull();
    expect(screen.getByTestId('onboarding-title')).toBeTruthy(); // the question itself never goes
  });
});

describe('what a screen reader is told', () => {
  it('names every field, marks the question as a header, and announces errors', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    expect(screen.getByTestId('onboarding-title').props.accessibilityRole).toBe('header');
    expect(screen.getByTestId('onboarding-full-name').props.accessibilityLabel).toBe(
      oneLine(en('onboarding.q1'))
    );
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    const error = screen.getByTestId('onboarding-full-name-error');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByTestId('onboarding-full-name').props['aria-invalid']).toBe(true);
  });

  it('gives each choice a radio role with its state, in a named group', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    const male = screen.getByTestId('onboarding-gender-male');
    expect(male.props.accessibilityRole).toBe('radio');
    expect(male.props.accessibilityState).toEqual({ selected: false });
    await fireEvent.press(male);
    expect(screen.getByTestId('onboarding-gender-male').props.accessibilityState).toEqual(
      {
        selected: true,
      }
    );
    const group = screen.getByLabelText(en('onboarding.q4'));
    expect(group.props.accessibilityRole).toBe('radiogroup');
  });

  it('keeps every control at least 44 points', async () => {
    const { screen } = await openForm();
    await skipChapter(screen);
    const flat = (n: { props: { style?: unknown } }) =>
      Object.assign({}, ...[n.props.style].flat(3).filter(Boolean)) as Record<
        string,
        number
      >;
    expect(
      flat(screen.getByTestId('onboarding-continue')).minHeight
    ).toBeGreaterThanOrEqual(44);
    await answers.name(screen, 'Ruth');
    expect(flat(screen.getByTestId('onboarding-back')).height).toBeGreaterThanOrEqual(44);
  });
});
