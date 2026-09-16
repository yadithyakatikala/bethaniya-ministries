import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SignInScreen } from '../SignInScreen';
import { useGoogleSignIn } from '../useGoogleSignIn';

jest.mock('../../../services/firebase/app');
jest.mock('../useGoogleSignIn');

/** Google state is set explicitly per test. `jest.clearAllMocks()` resets
 * recorded calls but NOT a return value installed with mockReturnValue, so
 * a `beforeEach` below re-asserts the unconfigured default rather than
 * letting one test's configured state leak into the next. */
function mockGoogleConfigured(promptAsync = jest.fn()) {
  (useGoogleSignIn as jest.Mock).mockReturnValue({
    configured: true,
    canPrompt: true,
    promptAsync,
  });
  return promptAsync;
}

function mockGoogleUnconfigured() {
  (useGoogleSignIn as jest.Mock).mockReturnValue({
    configured: false,
    canPrompt: false,
    promptAsync: jest.fn(),
  });
}

/** Restores the firebase/auth manual mock's happy-path implementations.
 * `jest.clearAllMocks()` clears recorded calls but NOT an implementation
 * installed by mockRejectedValue/mockResolvedValue, so a test that makes
 * sign-in fail would otherwise keep it failing for every test after it. */
function resetEmailAuthMocks() {
  (signInWithEmailAndPassword as jest.Mock).mockImplementation(async (_auth, email) => ({
    user: { uid: 'email-user', email },
  }));
  (createUserWithEmailAndPassword as jest.Mock).mockImplementation(
    async (_auth, email) => ({
      user: { uid: 'new-email-user', email, emailVerified: false },
    })
  );
  (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
  (sendEmailVerification as jest.Mock).mockResolvedValue(undefined);
  (updateProfile as jest.Mock).mockResolvedValue(undefined);
}

/**
 * Wrapped in PreferencesProvider since SignInScreen now reads useTheme()
 * -- the same nesting App.tsx already uses in production (AuthProvider >
 * PreferencesProvider > ... > SignInScreen).
 */
function renderSignInScreen() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <SignInScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('SignInScreen', () => {
  beforeEach(() => {
    mockGoogleUnconfigured();
    resetEmailAuthMocks();
  });
  afterEach(() => jest.clearAllMocks());

  it('renders the email sign-in controls', async () => {
    const { getByTestId } = await renderSignInScreen();
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByTestId('email-submit-button')).toBeTruthy();
  });

  it('renders an enabled Google button when Google sign-in is configured', async () => {
    mockGoogleConfigured();
    const { getByTestId } = await renderSignInScreen();
    const button = getByTestId('google-sign-in-button');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityState.disabled).toBe(false);
  });

  it('presses through to promptAsync when configured', async () => {
    const promptAsync = mockGoogleConfigured();
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.press(getByTestId('google-sign-in-button'));

    expect(promptAsync).toHaveBeenCalled();
  });

  it('omits the Google button entirely when Google sign-in is not configured', async () => {
    // A shipped build must not present a dead provider button. This used to
    // render "Continue with Google (not configured)", permanently disabled;
    // the affordance is now absent, and useGoogleSignIn logs a loud
    // release-build error instead.
    const { queryByTestId } = await renderSignInScreen();
    expect(queryByTestId('google-sign-in-button')).toBeNull();
  });

  it('never shows a "not configured" label anywhere on the screen', async () => {
    const { queryByText } = await renderSignInScreen();
    expect(queryByText(/not configured/i)).toBeNull();
  });

  // --- Email/Password: the primary V1 sign-in method --------------------

  it('signs in with the entered email and password', async () => {
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.changeText(getByTestId('email-input'), '  member@example.com  ');
    await fireEvent.changeText(getByTestId('password-input'), 'correct-horse');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        // trimmed -- a stray space from autofill must not cause a failure
        'member@example.com',
        'correct-horse'
      )
    );
  });

  it('maps a wrong-credentials failure to a message that does not reveal whether the account exists', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(getByTestId('auth-error-message').props.children).toBe(
        'That email or password isn’t right. Please try again.'
      )
    );
  });

  it('keeps the submit button usable after a failure rather than staying stuck busy', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'wrong');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() => expect(getByTestId('auth-error-message')).toBeTruthy());
    expect(getByTestId('email-submit-button').props.accessibilityState.disabled).toBe(
      false
    );
  });

  it('disables submit until both fields have something in them', async () => {
    const { getByTestId } = await renderSignInScreen();
    expect(getByTestId('email-submit-button').props.accessibilityState.disabled).toBe(
      true
    );

    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    expect(getByTestId('email-submit-button').props.accessibilityState.disabled).toBe(
      true
    );

    await fireEvent.changeText(getByTestId('password-input'), 'x');
    expect(getByTestId('email-submit-button').props.accessibilityState.disabled).toBe(
      false
    );
  });

  // --- Account creation -------------------------------------------------

  it('creates an account, sets the display name, and sends a verification email', async () => {
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    await fireEvent.changeText(getByTestId('display-name-input'), 'Asha K');
    await fireEvent.changeText(getByTestId('email-input'), 'new@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'longenough');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'new@example.com',
        'longenough'
      )
    );
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'new-email-user' }),
      { displayName: 'Asha K' }
    );
    expect(sendEmailVerification).toHaveBeenCalled();
  });

  it('enforces the minimum password length before hitting the network on sign-up', async () => {
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    await fireEvent.changeText(getByTestId('email-input'), 'new@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'short');

    expect(getByTestId('email-submit-button').props.accessibilityState.disabled).toBe(
      true
    );
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('still signs the user up when the optional display name is left blank', async () => {
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.press(getByTestId('go-to-sign-up-link'));
    await fireEvent.changeText(getByTestId('email-input'), 'new@example.com');
    await fireEvent.changeText(getByTestId('password-input'), 'longenough');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() => expect(createUserWithEmailAndPassword).toHaveBeenCalled());
    expect(updateProfile).not.toHaveBeenCalled();
  });

  // --- Password reset ---------------------------------------------------

  it('sends a reset link and reports it without revealing whether the account exists', async () => {
    const { getByTestId, queryByTestId } = await renderSignInScreen();

    await fireEvent.press(getByTestId('forgot-password-link'));
    // The password field is not part of the reset step.
    expect(queryByTestId('password-input')).toBeNull();

    await fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    await fireEvent.press(getByTestId('email-submit-button'));

    await waitFor(() =>
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'member@example.com'
      )
    );
    expect(getByTestId('auth-notice-message').props.children).toBe(
      'If an account exists for that email, a password reset link is on its way.'
    );
  });

  // --- Phone OTP removed from V1 ----------------------------------------

  it('renders no phone sign-in UI at all -- phone OTP is not part of V1', async () => {
    const { queryByTestId } = await renderSignInScreen();
    expect(queryByTestId('phone-number-input')).toBeNull();
    expect(queryByTestId('send-code-button')).toBeNull();
    expect(queryByTestId('otp-code-input')).toBeNull();
    expect(queryByTestId('production-recaptcha-webview')).toBeNull();
  });

  /**
   * A ScrollView/FlatList defaults to keyboardShouldPersistTaps="never":
   * while a TextInput inside it has focus, the FIRST touch anywhere in the
   * scroll view is consumed dismissing the keyboard and never reaches the
   * control under the finger. Typing a password and tapping
   * "Sign in" therefore did nothing at all the first time -- the worst
   * possible first impression of the app.
   *
   * The native scroll view is what implements that, so there is nothing in
   * the JS test environment to simulate; what this pins is that the screen
   * never silently reverts to the broken default.
   */
  it('keeps taps alive so the first tap on Sign in submits the form', async () => {
    const { getByTestId } = await renderSignInScreen();
    expect(getByTestId('sign-in-screen').props.keyboardShouldPersistTaps).toBe('handled');
  });
});
