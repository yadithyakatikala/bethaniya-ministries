import React from 'react';
import { Text } from 'react-native';
import {
  act,
  fireEvent,
  render,
  waitFor,
  type RenderResult,
} from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../context/AuthContext';
import { PreferencesProvider } from '../context/PreferencesContext';
import { OnboardingGate } from '../features/onboarding/OnboardingGate';

/**
 * Shared scaffolding for the onboarding tests: sign a member in, deliver
 * profile snapshots on demand, mount the gate over a stand-in app, and
 * drive the five questions one at a time.
 *
 * Jest-only: imports firebase mocks and testing-library.
 */
export function TheApp() {
  return <Text testID="the-app">the app</Text>;
}

/** Signs a member in and hands back a way to deliver profile snapshots,
 *  so a test can control exactly what the gate sees and when. */
export function mockSignedIn(
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

export async function renderGate(): Promise<RenderResult> {
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

type Screen = RenderResult;

/** Taps the chapter away, if it is still playing, as a member who wants the first question would. */
export async function skipChapter(screen: Screen) {
  const skip = screen.queryByTestId('onboarding-chapter-skip');
  if (skip) await fireEvent.press(skip);
}

export const answers = {
  async name(screen: Screen, name: string) {
    await fireEvent.changeText(screen.getByTestId('onboarding-full-name'), name);
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
  },
  async age(screen: Screen, age: string) {
    await fireEvent.changeText(screen.getByTestId('onboarding-age'), age);
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
  },
  async phone(screen: Screen, phone: string) {
    await fireEvent.changeText(screen.getByTestId('onboarding-phone'), phone);
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
  },
  async gender(screen: Screen, gender: 'male' | 'female') {
    await fireEvent.press(screen.getByTestId(`onboarding-gender-${gender}`));
    await fireEvent.press(screen.getByTestId('onboarding-continue'));
  },
  async language(screen: Screen, language: 'en' | 'te') {
    await fireEvent.press(screen.getByTestId(`onboarding-language-${language}`));
  },
};

export interface FullAnswers {
  name: string;
  age: string;
  /** null skips the phone question. */
  phone: string | null;
  gender: 'male' | 'female';
  language?: 'en' | 'te';
}

/** Answers questions 1..4 and arrives on the language question. */
export async function answerThroughGender(screen: Screen, a: FullAnswers) {
  await skipChapter(screen);
  await answers.name(screen, a.name);
  await answers.age(screen, a.age);
  if (a.phone === null)
    await fireEvent.press(screen.getByTestId('onboarding-skip-phone'));
  else await answers.phone(screen, a.phone);
  await answers.gender(screen, a.gender);
  await waitFor(() => expect(screen.getByTestId('onboarding-language-en')).toBeTruthy());
}

/** Answers everything and presses the last Continue. */
export async function answerAll(screen: Screen, a: FullAnswers) {
  await answerThroughGender(screen, a);
  if (a.language) await answers.language(screen, a.language);
  await fireEvent.press(screen.getByTestId('onboarding-submit'));
}

export const GOOD: FullAnswers = {
  name: 'Ruth Samuel',
  age: '34',
  phone: '98765 43210',
  gender: 'female',
};
