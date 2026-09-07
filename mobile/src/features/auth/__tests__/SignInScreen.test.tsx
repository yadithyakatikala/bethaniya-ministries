import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { signInWithPhoneNumber } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { SignInScreen } from '../SignInScreen';

jest.mock('../../../services/firebase/app');
jest.mock('../useGoogleSignIn');

function renderSignInScreen() {
  return render(
    <AuthProvider>
      <SignInScreen />
    </AuthProvider>
  );
}

describe('SignInScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders the Google and phone sign-in controls', async () => {
    const { getByTestId } = await renderSignInScreen();
    expect(getByTestId('google-sign-in-button')).toBeTruthy();
    expect(getByTestId('phone-number-input')).toBeTruthy();
    expect(getByTestId('send-code-button')).toBeTruthy();
  });

  it('disables the Google button when Google sign-in is not configured', async () => {
    const { getByTestId } = await renderSignInScreen();
    expect(getByTestId('google-sign-in-button').props.accessibilityState.disabled).toBe(
      true
    );
  });

  it('shows a friendly error and does not crash when phone sign-in fails', async () => {
    (signInWithPhoneNumber as jest.Mock).mockRejectedValue({
      code: 'auth/invalid-phone-number',
    });
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.changeText(getByTestId('phone-number-input'), 'not-a-number');
    await fireEvent.press(getByTestId('send-code-button'));

    await waitFor(() =>
      expect(getByTestId('auth-error-message').props.children).toBe(
        'That doesn’t look like a valid phone number. Please check it and try again.'
      )
    );
  });

  it('advances to the code-entry step once a code is sent', async () => {
    (signInWithPhoneNumber as jest.Mock).mockResolvedValue({ confirm: jest.fn() });
    const { getByTestId } = await renderSignInScreen();

    await fireEvent.changeText(getByTestId('phone-number-input'), '+15555550123');
    await fireEvent.press(getByTestId('send-code-button'));

    await waitFor(() => expect(getByTestId('otp-code-input')).toBeTruthy());
    expect(getByTestId('verify-code-button')).toBeTruthy();
  });
});
