import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import {
  installAnimatedDriver,
  type AnimatedDriver,
} from '../../../testing/animatedDriver';
import { installFrameClock, type FrameClock } from '../../../testing/frameClock';
import {
  GOOD,
  answerAll,
  answerThroughGender,
  answers,
  mockSignedIn,
  renderGate,
  skipChapter,
} from '../../../testing/onboardingHarness';

jest.mock('../../../services/firebase/app');

/**
 * The questionnaire, end to end: who is shown it, who is not, what a
 * submission writes, and what happens when that write fails.
 *
 * The gate is mounted over a stand-in for the app, because what matters
 * is WHICH of the two renders -- the real navigator would drag twenty
 * screens and their Firebase mocks in without testing anything more.
 *
 * The questionnaire is five screens now, one question each (see
 * ../OnboardingScreen.tsx), so "answering it" is five steps rather than
 * one form. Every behaviour this file has always asserted is still
 * asserted; only the way the test gets there changed. The new behaviour
 * -- the questions, the chapter, the country picker -- is covered in
 * ./OnboardingScreen.test.tsx.
 */
let clock: FrameClock;
let driver: AnimatedDriver;

beforeEach(() => {
  jest.clearAllMocks();
  // The chapter and the school are animations; hold them still so the
  // tests are about the questionnaire, not a clock.
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

/** The one write that finishes onboarding: the one carrying the completion marker. */
function completionWrite(): Record<string, unknown> {
  const call = (updateDoc as jest.Mock).mock.calls.find(
    ([, data]: [unknown, Record<string, unknown>]) => 'profileCompletedAt' in data
  ) as [unknown, Record<string, unknown>] | undefined;
  expect(call).toBeDefined();
  return call![1];
}

describe('who sees the questionnaire', () => {
  it('a brand-new email/password member does', async () => {
    // No display name, no phone: Firebase Auth gives an email/password
    // sign-up neither unless the form collected one.
    const server = mockSignedIn('new-user');
    const screen = await renderGate();
    await server.emit({ role: 'member', displayName: null, phoneNumber: null });

    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('a brand-new Google member does too, with their name already filled in', async () => {
    const server = mockSignedIn('google-user', { displayName: 'Ruth Samuel' });
    const screen = await renderGate();
    await server.emit({ role: 'member', displayName: 'Ruth Samuel', phoneNumber: null });

    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
    // Having a name from Google is not having answered the questionnaire,
    // but it does mean nobody has to retype it.
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');
  });

  it('a member whose account exists but has no profile document yet does', async () => {
    const server = mockSignedIn('brand-new');
    const screen = await renderGate();
    await server.emit(null);

    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
  });

  it('a member who has already answered does NOT, ever again', async () => {
    const server = mockSignedIn('returning');
    const screen = await renderGate();
    await server.emit({
      role: 'member',
      displayName: 'Ruth Samuel',
      phoneNumber: '9876543210',
      gender: 'female',
      appLanguage: 'te',
      profileCompletedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(screen.queryByTestId('onboarding-screen')).toBeNull();
  });

  it('an existing member with a half-filled profile gets the completion flow', async () => {
    // Name and phone from somewhere, no gender, never submitted. They see
    // the questions, prefilled with what is already known.
    const server = mockSignedIn('half-done');
    const screen = await renderGate();
    await server.emit({
      role: 'member',
      displayName: 'Ruth Samuel',
      phoneNumber: '9876543210',
    });

    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');

    // The phone number is on the third question; get there.
    await skipChapter(screen);
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    await answers.age(screen, '40');
    expect(screen.getByTestId('onboarding-phone').props.value).toBe('9876543210');
  });

  it('nobody sees it while the profile is still loading', async () => {
    // THE flash to avoid: showing a returning member a questionnaire for
    // a moment on every cold start because their profile had not arrived.
    mockSignedIn('slow-network');
    const screen = await renderGate();
    expect(screen.queryByTestId('onboarding-screen')).toBeNull();
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('nobody is asked again just because the network was down', async () => {
    // A read failure means "unknown", not "incomplete". Asking a member
    // who already answered to answer again is the worse error.
    const server = mockSignedIn('offline-user');
    const screen = await renderGate();
    await server.fail(new Error('unavailable'));

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(screen.queryByTestId('onboarding-screen')).toBeNull();
  });
});

describe('answering it', () => {
  async function showForm(uid = 'new-user') {
    const server = mockSignedIn(uid);
    const screen = await renderGate();
    await server.emit({ role: 'member', displayName: null, phoneNumber: null });
    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
    return { screen, server };
  }

  it('writes every answer in ONE update, and lets the member through', async () => {
    const { screen } = await showForm();
    await answerAll(screen, { ...GOOD, language: 'te' });

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    const written = completionWrite();
    expect(written.displayName).toBe('Ruth Samuel');
    // Stored as one number with its country, not as typed.
    expect(written.phoneNumber).toBe('+919876543210');
    expect(written.gender).toBe('female');
    expect(written.appLanguage).toBe('te');
    expect(written.profileCompletedAt).toBeDefined();
    // ONE update carries the answers and the marker together -- and nothing
    // else: the age is deliberately written beside it, not inside it.
    expect(Object.keys(written).sort()).toEqual(
      ['appLanguage', 'displayName', 'gender', 'phoneNumber', 'profileCompletedAt'].sort()
    );
  });

  it('writes the age beside the completion, so a rejected age can never stop onboarding', async () => {
    const { screen } = await showForm();
    await answerAll(screen, GOOD);
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());

    const ageWrite = (updateDoc as jest.Mock).mock.calls.find(
      ([, data]: [unknown, Record<string, unknown>]) => 'age' in data
    ) as [unknown, Record<string, unknown>];
    expect(ageWrite[1]).toEqual({ age: 34 });
  });

  it('still finishes when the age write is refused (rules not yet deployed)', async () => {
    // An app released before the age rule is deployed must not strand
    // anyone: the age is best-effort, everything else is not.
    (updateDoc as jest.Mock).mockImplementation(
      async (_ref, data: Record<string, unknown>) => {
        if ('age' in data) throw new Error('permission-denied');
      }
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { screen } = await showForm();
    await answerAll(screen, GOOD);

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(completionWrite().gender).toBe('female');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not save the age'),
      expect.anything()
    );
  });

  it('saves English when English is chosen', async () => {
    const { screen } = await showForm();
    await answerAll(screen, {
      name: 'John',
      age: '51',
      phone: '9876543210',
      gender: 'male',
      language: 'en',
    });

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const written = completionWrite();
    expect(written.gender).toBe('male');
    expect(written.appLanguage).toBe('en');
  });

  it('leaves the phone number OUT of the write when that question was skipped', async () => {
    const { screen } = await showForm();
    await answerAll(screen, { ...GOOD, phone: null });

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    const written = completionWrite();
    expect('phoneNumber' in written).toBe(false);
    expect(written.displayName).toBe('Ruth Samuel');
  });

  it('initializes the APP language from the answer, and touches nothing else', async () => {
    // M2's whole point: app language, Bible language and theme are three
    // independent preferences. Answering "Telugu" here says which
    // language the MENUS are in.
    const { screen } = await showForm();
    await answerAll(screen, { ...GOOD, name: 'Ruth', language: 'te' });

    await waitFor(() =>
      expect(AsyncStorage.getItem('app_language_preference')).resolves.toBe('te')
    );
    // The Bible stays on its own default, and no theme was written.
    expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('te');
    expect(await AsyncStorage.getItem('theme_preference')).toBeNull();

    const languageWrites = (updateDoc as jest.Mock).mock.calls.flatMap(
      ([, data]: [unknown, Record<string, unknown>]) => Object.keys(data)
    );
    expect(languageWrites).not.toContain('bibleMode');
    expect(languageWrites).not.toContain('themePreference');
  });

  it('will not leave a question that is not answered, and says which', async () => {
    const { screen } = await showForm();
    await skipChapter(screen);

    // The name.
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-full-name-error')).toBeTruthy()
    );
    expect(screen.getByTestId('onboarding-full-name')).toBeTruthy(); // still on it

    // Past it, to the gender question, unanswered.
    await answers.name(screen, 'Ruth Samuel');
    await answers.age(screen, '34');
    await answers.phone(screen, '9876543210');
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-gender-error')).toBeTruthy()
    );

    expect(updateDoc).not.toHaveBeenCalled();
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('rejects a phone number that is not one, without losing the name', async () => {
    const { screen } = await showForm();
    await skipChapter(screen);
    await answers.name(screen, 'Ruth Samuel');
    await answers.age(screen, '34');
    await answers.phone(screen, '123');

    await waitFor(() =>
      expect(screen.getByTestId('onboarding-phone-error')).toBeTruthy()
    );
    expect(updateDoc).not.toHaveBeenCalled();

    // The name is still there, three questions back.
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');
  });

  it('shows a failed save, keeps every answer, and does NOT let the member through', async () => {
    // The M6 BUG 1 lesson, applied here from the start: a write that did
    // not happen must never be reported as one that did.
    (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { screen } = await showForm();
    await answerAll(screen, GOOD);

    await waitFor(() => expect(screen.getByTestId('onboarding-error')).toBeTruthy());
    expect(screen.queryByTestId('the-app')).toBeNull();
    expect(warn).toHaveBeenCalled();

    // Nothing typed was thrown away: walk back through the questions.
    expect(screen.getByTestId('onboarding-language-en')).toBeTruthy(); // still on the last
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(
      screen.getByTestId('onboarding-gender-female').props.accessibilityState.selected
    ).toBe(true);
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('onboarding-phone').props.value).toBe('98765 43210');
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('onboarding-age').props.value).toBe('34');
    await fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');
  });

  it('lets the member try again after a failed save', async () => {
    // Refuse the first attempt at the COMPLETION write (the age is written
    // beside it and is not what is being tested here).
    let refused = false;
    (updateDoc as jest.Mock).mockImplementation(
      async (_ref, data: Record<string, unknown>) => {
        if ('profileCompletedAt' in data && !refused) {
          refused = true;
          throw new Error('unavailable');
        }
      }
    );
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { screen } = await showForm();
    await answerAll(screen, GOOD);
    await waitFor(() => expect(screen.getByTestId('onboarding-error')).toBeTruthy());
    expect(screen.queryByTestId('the-app')).toBeNull();

    await fireEvent.press(screen.getByTestId('onboarding-submit'));
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
  });

  it('does not bounce the member back into the form on the pre-server snapshot', async () => {
    // serverTimestamp() has no value in the local snapshot that fires
    // before the server acknowledges the write, so profileCompletedAt
    // reads null for a tick. Without the gate latching, that tick would
    // put the member straight back on the form they just submitted.
    const { screen, server } = await showForm();
    await answerAll(screen, GOOD);
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());

    await server.emit({
      role: 'member',
      displayName: 'Ruth Samuel',
      phoneNumber: '+919876543210',
      gender: 'female',
      profileCompletedAt: null,
    });

    expect(screen.getByTestId('the-app')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-screen')).toBeNull();
  });

  it('lets someone who does not want to answer into the app anyway', async () => {
    // Not a trap. An incomplete record beats a member who cannot use the
    // app at all.
    const { screen } = await showForm();
    await skipChapter(screen);
    await fireEvent.press(screen.getByTestId('onboarding-skip'));

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('lets them leave from the last question too -- keeping a language they chose, and nothing else', async () => {
    const { screen } = await showForm();
    await answerThroughGender(screen, { ...GOOD, phone: null });
    await answers.language(screen, 'te');
    // On the last question, "Not now" is still there.
    await fireEvent.press(screen.getByTestId('onboarding-skip'));

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    // The answers are NOT saved and the member is not marked complete...
    expect(
      (updateDoc as jest.Mock).mock.calls.some(([, data]) => 'profileCompletedAt' in data)
    ).toBe(false);
    // ...but somebody who switched to Telugu is not dropped back into English.
    expect(await AsyncStorage.getItem('app_language_preference')).toBe('te');
    const written = (updateDoc as jest.Mock).mock.calls.flatMap(
      ([, data]: [unknown, Record<string, unknown>]) => Object.keys(data)
    );
    expect(written).toEqual(['appLanguage']);
  });
});
