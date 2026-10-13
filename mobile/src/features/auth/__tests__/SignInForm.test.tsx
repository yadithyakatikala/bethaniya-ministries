import React from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n';
import { darkTokens, lightTokens } from '../../../theme';
import {
  isAppleSignInAvailable,
  signInWithApple,
} from '../../../services/firebase/appleSignIn';
import { SignInScreen } from '../SignInScreen';
import { useGoogleSignIn } from '../useGoogleSignIn';

jest.mock('../../../services/firebase/app');
jest.mock('../useGoogleSignIn');
jest.mock('../../../services/firebase/appleSignIn', () => ({
  isAppleSignInAvailable: jest.fn(),
  signInWithApple: jest.fn(),
}));

/**
 * THE SIGN-IN SCREEN'S LOOK AND ITS FORM -- what the redesign added.
 *
 * The behaviour -- what a press does, what is sent, what is refused -- is
 * pinned in ./SignInScreen.test.tsx and is unchanged. This file is about the
 * parts a member sees and a screen reader hears: the portrait and the name,
 * a label above every field that stays, Show / Hide on the password, the busy
 * state, the notice and the outline when something fails, the portrait that
 * steps aside for the keyboard, and the provider buttons.
 */
function mockGoogle(configured: boolean) {
  (useGoogleSignIn as jest.Mock).mockReturnValue({
    configured,
    canPrompt: configured,
    promptAsync: jest.fn(),
  });
}

function renderScreen() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <SignInScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

/** The portrait and the word are hidden from a screen reader, so a query asks for them by name. */
const DECORATION = { includeHiddenElements: true } as const;

/** Whether anything under this node is a drawn (SVG) mark. */
function hasSvg(node: unknown): boolean {
  const { type, children } = node as { type: unknown; children?: unknown[] };
  if (type === 'RNSVGSvgView') return true;
  return (children ?? []).some((child) => typeof child !== 'string' && hasSvg(child));
}

/** Captures what the screen subscribes to, so a test can raise the keyboard by hand. */
function spyOnKeyboard() {
  const handlers = new Map<string, () => void>();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: () => void
  ) => {
    handlers.set(event, handler);
    return { remove: jest.fn() };
  }) as never);
  const fire = (kind: 'Show' | 'Hide') =>
    act(async () => {
      for (const [event, handler] of handlers) if (event.endsWith(kind)) handler();
    });
  return { show: () => fire('Show'), hide: () => fire('Hide') };
}

const wrongCredentials = Object.assign(new Error('wrong'), {
  code: 'auth/invalid-credential',
});

beforeEach(() => {
  mockGoogle(false);
  (isAppleSignInAvailable as jest.Mock).mockResolvedValue(false);
  (signInWithEmailAndPassword as jest.Mock).mockImplementation(async (_auth, email) => ({
    user: { uid: 'email-user', email },
  }));
  (createUserWithEmailAndPassword as jest.Mock).mockImplementation(
    async (_auth, email) => ({
      user: { uid: 'new-email-user', email, emailVerified: false },
    })
  );
  (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('the brand block and the title', () => {
  it('opens on the portrait, the word MARANATHA, and the title', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('sign-in-portrait', DECORATION)).toBeTruthy();
    expect(getByTestId('sign-in-wordmark', DECORATION).props.children).toBe('MARANATHA');
    expect(getByTestId('sign-in-title').props.children).toBe('Sign in to Maranatha');
  });

  it('makes the title a heading, and keeps the portrait and the word out of a screen reader’s way', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('sign-in-title').props.accessibilityRole).toBe('header');
    // The title already says "Maranatha"; reading the word and a picture of a face first is noise.
    expect(
      getByTestId('sign-in-wordmark', DECORATION).props.accessibilityElementsHidden
    ).toBe(true);
    expect(getByTestId('sign-in-portrait', DECORATION).props.accessible).toBe(false);
  });

  it('sets the word in the English serif, tracked wide, in gold ink -- and the portrait round at 72', async () => {
    const { getByTestId } = await renderScreen();
    const word = flat(getByTestId('sign-in-wordmark', DECORATION));
    expect(word.fontFamily).toBe('NotoSerif-SemiBold');
    expect(word.letterSpacing).toBeGreaterThan(3);
    expect(word.color).toBe(lightTokens.accent);
    const portrait = flat(getByTestId('sign-in-portrait', DECORATION));
    expect(portrait).toMatchObject({ width: 72, height: 72, borderRadius: 36 });
  });

  it('retitles the screen for each of the three steps', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    expect(getByTestId('sign-in-title').props.children).toBe(
      'Create your Maranatha account'
    );
    await fireEvent.press(getByTestId('back-to-sign-in-link'));
    await fireEvent.press(getByTestId('forgot-password-link'));
    expect(getByTestId('sign-in-title').props.children).toBe('Reset your password');
  });

  it('is in Telugu under a Telugu interface, with the name still in Latin', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('sign-in-title').props.children).toBe(
        translate('te', 'auth.signInTitle', { app: 'Maranatha' })
      )
    );
    expect(getByText(translate('te', 'auth.email'))).toBeTruthy();
    expect(getByTestId('sign-in-wordmark', DECORATION).props.children).toBe('MARANATHA');
  });
});

describe('the fields', () => {
  it('puts a label above every field, and keeps it there', async () => {
    const { getByText, getByTestId } = await renderScreen();
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('Password')).toBeTruthy();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    // Typing does not take the label away: it was never the placeholder.
    expect(getByText('Email')).toBeTruthy();
    expect(getByTestId('email-input').props.accessibilityLabel).toBe('Email');
    expect(getByTestId('password-input').props.accessibilityLabel).toBe('Password');
  });

  it('adds the name field and says how long a password must be, when creating an account', async () => {
    const { getByTestId, getByText, queryByText } = await renderScreen();
    expect(queryByText('At least 6 characters')).toBeNull();
    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    expect(getByText('Your name')).toBeTruthy();
    expect(getByTestId('display-name-input')).toBeTruthy();
    expect(getByText('At least 6 characters')).toBeTruthy();
  });

  it('leaves the password out of the reset step altogether', async () => {
    const { getByTestId, queryByText } = await renderScreen();
    await fireEvent.press(getByTestId('forgot-password-link'));
    expect(queryByText('Password')).toBeNull();
    expect(queryByText('At least 6 characters')).toBeNull();
  });

  it('keeps the same email address when the step changes, and clears the password', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'secret1');
    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    expect(getByTestId('email-input').props.value).toBe('member@example.com');
    expect(getByTestId('password-input').props.value).toBe('');
  });
});

describe('Show and Hide on the password', () => {
  it('starts hidden, and Show reveals it as a named action', async () => {
    const { getByTestId, getByText } = await renderScreen();
    expect(getByTestId('password-input').props.secureTextEntry).toBe(true);
    expect(getByText('Show')).toBeTruthy();

    await fireEvent.press(getByTestId('password-input-toggle'));
    expect(getByTestId('password-input').props.secureTextEntry).toBe(false);
    // Named by what it will do next, in words -- never an eye glyph alone.
    expect(getByText('Hide')).toBeTruthy();
    expect(getByTestId('password-input-toggle').props.accessibilityLabel).toBe('Hide');

    await fireEvent.press(getByTestId('password-input-toggle'));
    expect(getByTestId('password-input').props.secureTextEntry).toBe(true);
  });

  it('hides the password again whenever the step changes', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.press(getByTestId('password-input-toggle'));
    expect(getByTestId('password-input').props.secureTextEntry).toBe(false);
    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    expect(getByTestId('password-input').props.secureTextEntry).toBe(true);
  });
});

describe('while a request is out', () => {
  it('dims the fields, shows the button as busy, and puts the other actions down -- then lets go', async () => {
    let finish: () => void = () => undefined;
    (signInWithEmailAndPassword as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ user: { uid: 'u', email: 'member@example.com' } });
        })
    );
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'correct-horse');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(getByTestId('email-submit-button').props.accessibilityState.busy).toBe(true)
    );
    expect(getByTestId('email-input').props.editable).toBe(false);
    expect(getByTestId('password-input').props.editable).toBe(false);
    expect(getByTestId('forgot-password-link').props.accessibilityState.disabled).toBe(
      true
    );
    expect(getByTestId('go-to-sign-up-link').props.accessibilityState.disabled).toBe(
      true
    );

    await act(async () => finish());
    await waitFor(() =>
      expect(getByTestId('email-submit-button').props.accessibilityState.busy).toBe(false)
    );
    expect(getByTestId('email-input').props.editable).toBe(true);
  });
});

describe('when it does not work', () => {
  it('says so in a danger notice above the form, with its mark and its words', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(wrongCredentials);
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() => expect(getByTestId('auth-error-banner')).toBeTruthy());
    expect(flat(getByTestId('auth-error-banner')).backgroundColor).toBe(
      lightTokens.dangerTint
    );
    expect(getByTestId('auth-error-banner').props.accessibilityLiveRegion).toBe('polite');
    expect(getByTestId('auth-error-message').props.children).toBe(
      'That email or password isn’t right. Please try again.'
    );
  });

  it('outlines the PASSWORD for a wrong email or password, never the email -- so it cannot say which was wrong', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(wrongCredentials);
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(getByTestId('password-input').props['aria-invalid']).toBe(true)
    );
    expect(flat(getByTestId('password-input')).borderColor).toBe(lightTokens.danger);
    expect(getByTestId('email-input').props['aria-invalid']).toBe(false);
  });

  it('outlines the EMAIL when the address is already registered', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(
      Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' })
    );
    const { getByTestId } = await renderScreen();
    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    await fireEvent.changeText(getByTestId('email-input'), 'taken@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'longenough');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(getByTestId('email-input').props['aria-invalid']).toBe(true)
    );
    expect(getByTestId('password-input').props['aria-invalid']).toBe(false);
  });

  it('outlines nothing for a failure that is about neither field', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
      Object.assign(new Error('offline'), { code: 'auth/network-request-failed' })
    );
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'whatever');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() => expect(getByTestId('auth-error-banner')).toBeTruthy());
    expect(getByTestId('email-input').props['aria-invalid']).toBe(false);
    expect(getByTestId('password-input').props['aria-invalid']).toBe(false);
  });

  it('drops the outline when something else replaces the notice -- a cancelled Google sign-in is not about the password', async () => {
    mockGoogle(true);
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(wrongCredentials);
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('email-submit-button'));
    await waitFor(() =>
      expect(getByTestId('password-input').props['aria-invalid']).toBe(true)
    );

    // The Google hook reports its own failures through the callback the screen handed it.
    const reportFromGoogle = (useGoogleSignIn as jest.Mock).mock.calls[0][0];
    await act(async () => reportFromGoogle({ code: 'auth/popup-closed-by-user' }));

    expect(getByTestId('auth-error-message').props.children).toBe(
      'Sign-in was cancelled.'
    );
    expect(getByTestId('password-input').props['aria-invalid']).toBe(false);
    expect(getByTestId('email-input').props['aria-invalid']).toBe(false);
  });

  it('clears the notice and the outline together on the next attempt', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(wrongCredentials);
    const { getByTestId, queryByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('email-submit-button'));
    await waitFor(() => expect(getByTestId('auth-error-banner')).toBeTruthy());

    await fireEvent.press(getByTestId('email-submit-button'));
    await waitFor(() => expect(queryByTestId('auth-error-banner')).toBeNull());
    expect(getByTestId('password-input').props['aria-invalid']).toBe(false);
  });

  it('does not outline the password for a failed Apple sign-in: that is not about the password box', async () => {
    const original = Platform.OS;
    try {
      Platform.OS = 'ios';
      (isAppleSignInAvailable as jest.Mock).mockResolvedValue(true);
      (signInWithApple as jest.Mock).mockRejectedValue(wrongCredentials);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('apple-sign-in-button')).toBeTruthy());
      await fireEvent.press(getByTestId('apple-sign-in-button'));

      await waitFor(() => expect(getByTestId('auth-error-banner')).toBeTruthy());
      expect(getByTestId('password-input').props['aria-invalid']).toBe(false);
    } finally {
      Platform.OS = original;
    }
  });

  it('shows the reset confirmation as a quiet notice, in the neutral tint', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.press(getByTestId('forgot-password-link'));
    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() => expect(getByTestId('auth-notice-banner')).toBeTruthy());
    expect(flat(getByTestId('auth-notice-banner')).backgroundColor).toBe(
      lightTokens.surfaceRaised
    );
    // And the screen is the sign-in step again, with the address still in it.
    expect(getByTestId('sign-in-title').props.children).toBe('Sign in to Maranatha');
    expect(getByTestId('email-input').props.value).toBe('member@example.com');
  });
});

describe('with the keyboard up', () => {
  it('shrinks the portrait to 44, drops the word, and steps the title down', async () => {
    const keyboard = spyOnKeyboard();
    const { getByTestId, queryByTestId } = await renderScreen();
    expect(flat(getByTestId('sign-in-portrait', DECORATION)).width).toBe(72);
    const roomy = flat(getByTestId('sign-in-title')).fontSize;

    await keyboard.show();
    expect(flat(getByTestId('sign-in-portrait', DECORATION))).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 22,
    });
    expect(queryByTestId('sign-in-wordmark', DECORATION)).toBeNull();
    expect(flat(getByTestId('sign-in-title')).fontSize).toBe(22);
    expect(Number(roomy)).toBeGreaterThan(22);

    await keyboard.hide();
    expect(flat(getByTestId('sign-in-portrait', DECORATION)).width).toBe(72);
    expect(getByTestId('sign-in-wordmark', DECORATION)).toBeTruthy();
  });

  it('keeps every field and button on the screen, still reachable', async () => {
    const keyboard = spyOnKeyboard();
    const { getByTestId } = await renderScreen();
    await keyboard.show();
    for (const id of ['email-input', 'password-input', 'email-submit-button']) {
      expect(getByTestId(id)).toBeTruthy();
    }
  });

  it('asks iOS to scroll the field it is typing into clear of the keyboard', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('sign-in-screen').props.automaticallyAdjustKeyboardInsets).toBe(
      true
    );
  });
});

describe('the provider buttons', () => {
  it('shows a hairline and the Google button only when Google is set up', async () => {
    const { queryByTestId, rerender } = await renderScreen();
    expect(queryByTestId('sign-in-divider')).toBeNull();
    expect(queryByTestId('sign-in-providers')).toBeNull();

    mockGoogle(true);
    await rerender(
      <AuthProvider>
        <PreferencesProvider>
          <SignInScreen />
        </PreferencesProvider>
      </AuthProvider>
    );
    expect(queryByTestId('sign-in-divider')).toBeTruthy();
    expect(queryByTestId('google-sign-in-button')).toBeTruthy();
  });

  it('leaves the providers out of the create-account and reset steps', async () => {
    mockGoogle(true);
    const { getByTestId, queryByTestId } = await renderScreen();
    expect(queryByTestId('sign-in-providers')).toBeTruthy();
    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    expect(queryByTestId('sign-in-providers')).toBeNull();
    expect(queryByTestId('sign-in-divider')).toBeNull();
  });

  it('sets the providers as plain words: no brand mark is drawn until the church has the real artwork', async () => {
    mockGoogle(true);
    const { getByTestId } = await renderScreen();
    const google = getByTestId('google-sign-in-button');
    expect(google.props.accessibilityRole).toBe('button');
    // Words only: the button holds a label and nothing drawn beside it.
    expect(hasSvg(google)).toBe(false);
  });

  it('draws the screen in the dark palette under a dark theme', async () => {
    await AsyncStorage.setItem('theme_preference', 'dark');
    const { getByTestId } = await renderScreen();
    await waitFor(() =>
      expect(flat(getByTestId('sign-in-wordmark', DECORATION)).color).toBe(
        darkTokens.accent
      )
    );
  });
});
