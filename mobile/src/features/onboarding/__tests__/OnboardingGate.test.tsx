import React from 'react';
import { Text } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { OnboardingGate } from '../OnboardingGate';

jest.mock('../../../services/firebase/app');

/**
 * The questionnaire, end to end: who is shown it, who is not, what a
 * submission writes, and what happens when that write fails.
 *
 * The gate is mounted over a stand-in for the app, because what matters
 * is WHICH of the two renders -- the real navigator would drag twenty
 * screens and their Firebase mocks in without testing anything more.
 */
function TheApp() {
  return <Text testID="the-app">the app</Text>;
}

/** Signs a member in and hands back a way to deliver profile snapshots,
 *  so a test can control exactly what the gate sees and when. */
function mockSignedIn(
  uid: string,
  authUser: { displayName?: string | null; phoneNumber?: string | null } = {}
) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({
      uid,
      displayName: authUser.displayName ?? null,
      email: 'member@example.com',
      phoneNumber: authUser.phoneNumber ?? null,
    });
    return jest.fn();
  });

  const listeners: ((snapshot: unknown) => void)[] = [];
  const errorHandlers: ((error: unknown) => void)[] = [];
  (onSnapshot as jest.Mock).mockImplementation((_ref, next, onError) => {
    listeners.push(next);
    if (onError) errorHandlers.push(onError);
    return jest.fn();
  });

  return {
    /** The profile document as the server holds it. */
    emit: async (data: Record<string, unknown> | null) => {
      await act(async () => {
        listeners.forEach((next) =>
          next(
            data === null
              ? { exists: () => false }
              : { exists: () => true, id: uid, data: () => data }
          )
        );
      });
    },
    fail: async (error: unknown) => {
      await act(async () => {
        errorHandlers.forEach((onError) => onError(error));
      });
    },
  };
}

async function renderGate() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <OnboardingGate>
          <TheApp />
        </OnboardingGate>
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (updateDoc as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  jest.restoreAllMocks();
});

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
    // the form, prefilled with what is already known.
    const server = mockSignedIn('half-done');
    const screen = await renderGate();
    await server.emit({
      role: 'member',
      displayName: 'Ruth Samuel',
      phoneNumber: '9876543210',
    });

    await waitFor(() => expect(screen.getByTestId('onboarding-screen')).toBeTruthy());
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');
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

    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth Samuel');
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '98765 43210');
    await fireEvent.press(screen.getByTestId('onboarding-gender-female'));
    await fireEvent.press(screen.getByTestId('onboarding-language-te'));
    await fireEvent.press(screen.getByTestId('onboarding-submit'));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const [, written] = (updateDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(written.displayName).toBe('Ruth Samuel');
    // Stored normalized, not as typed.
    expect(written.phoneNumber).toBe('9876543210');
    expect(written.gender).toBe('female');
    expect(written.appLanguage).toBe('te');
    expect(written.profileCompletedAt).toBeDefined();

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
  });

  it('saves English when English is chosen', async () => {
    const { screen } = await showForm();
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'John');
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('onboarding-gender-male'));
    await fireEvent.press(screen.getByTestId('onboarding-language-en'));
    await fireEvent.press(screen.getByTestId('onboarding-submit'));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const [, written] = (updateDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(written.gender).toBe('male');
    expect(written.appLanguage).toBe('en');
  });

  it('initializes the APP language from the answer, and touches nothing else', async () => {
    // M2's whole point: app language, Bible language and theme are three
    // independent preferences. Answering "Telugu" here says which
    // language the MENUS are in.
    const { screen } = await showForm();
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth');
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('onboarding-gender-female'));
    await fireEvent.press(screen.getByTestId('onboarding-language-te'));
    await fireEvent.press(screen.getByTestId('onboarding-submit'));

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

  it('will not submit an incomplete form, and says which field is missing', async () => {
    const { screen } = await showForm();

    await fireEvent.press(screen.getByTestId('onboarding-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('onboarding-gender-error')).toBeTruthy()
    );
    expect(updateDoc).not.toHaveBeenCalled();
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('rejects a phone number that is not one, without losing the name', async () => {
    const { screen } = await showForm();
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth Samuel');
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '123');
    await fireEvent.press(screen.getByTestId('onboarding-gender-female'));
    await fireEvent.press(screen.getByTestId('onboarding-submit'));

    await waitFor(() => expect(updateDoc).not.toHaveBeenCalled());
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');
  });

  it('shows a failed save, keeps every answer, and does NOT let the member through', async () => {
    // The M6 BUG 1 lesson, applied here from the start: a write that did
    // not happen must never be reported as one that did.
    (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const { screen } = await showForm();

    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth Samuel');
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('onboarding-gender-female'));
    await fireEvent.press(screen.getByTestId('onboarding-submit'));

    await waitFor(() => expect(screen.getByTestId('onboarding-error')).toBeTruthy());
    expect(screen.queryByTestId('the-app')).toBeNull();
    // Nothing typed was thrown away.
    expect(screen.getByTestId('onboarding-full-name').props.value).toBe('Ruth Samuel');
    expect(screen.getByTestId('onboarding-phone').props.value).toBe('9876543210');
    expect(
      screen.getByTestId('onboarding-gender-female').props.accessibilityState.selected
    ).toBe(true);
  });

  it('does not bounce the member back into the form on the pre-server snapshot', async () => {
    // serverTimestamp() has no value in the local snapshot that fires
    // before the server acknowledges the write, so profileCompletedAt
    // reads null for a tick. Without the gate latching, that tick would
    // put the member straight back on the form they just submitted.
    const { screen, server } = await showForm();
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), 'Ruth Samuel');
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), '9876543210');
    await fireEvent.press(screen.getByTestId('onboarding-gender-female'));
    await fireEvent.press(screen.getByTestId('onboarding-submit'));
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());

    await server.emit({
      role: 'member',
      displayName: 'Ruth Samuel',
      phoneNumber: '9876543210',
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
    await fireEvent.press(screen.getByTestId('onboarding-skip'));

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
