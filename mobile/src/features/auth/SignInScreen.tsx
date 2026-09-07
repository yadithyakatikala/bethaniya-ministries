import { useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { confirmPhoneCode, startPhoneSignIn } from '../../services/firebase/authService';
import {
  isAppleSignInAvailable,
  signInWithApple,
} from '../../services/firebase/appleSignIn';
import { useGoogleSignIn } from './useGoogleSignIn';

type PhoneStep = 'enter-phone' | 'enter-code';

/**
 * Unauthenticated screen: Google, Apple, and Phone OTP sign-in.
 *
 * Per the Day 2 directive, this is intentionally minimal UI -- enough to
 * exercise the real architecture, not a polished design. Real-provider
 * verification status for each option is documented in SECURITY.md; the
 * Apple button hides itself when the platform/device can't support it at
 * all (Android, or iOS without the capability), and the Google button stays
 * present but disabled until real OAuth client ids are configured (see
 * useGoogleSignIn.ts) rather than silently doing nothing when pressed.
 */
export function SignInScreen() {
  const { authErrorMessage, reportSignInError, clearAuthError } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter-phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const google = useGoogleSignIn(reportSignInError);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function handleApplePress() {
    clearAuthError();
    setBusy(true);
    try {
      await signInWithApple();
    } catch (error) {
      reportSignInError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendCode() {
    clearAuthError();
    setBusy(true);
    try {
      const result = await startPhoneSignIn(phoneNumber.trim());
      setConfirmationResult(result);
      setPhoneStep('enter-code');
    } catch (error) {
      reportSignInError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmCode() {
    if (!confirmationResult) return;
    clearAuthError();
    setBusy(true);
    try {
      await confirmPhoneCode(confirmationResult, otpCode.trim());
    } catch (error) {
      reportSignInError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container} testID="sign-in-screen">
      <Text style={styles.title}>Sign in to Bethaniya Ministries</Text>

      {authErrorMessage ? (
        <Text style={styles.error} testID="auth-error-message">
          {authErrorMessage}
        </Text>
      ) : null}

      <View style={styles.section}>
        <Button
          title={
            google.configured
              ? 'Continue with Google'
              : 'Continue with Google (not configured)'
          }
          onPress={() => void google.promptAsync()}
          disabled={!google.canPrompt || busy}
          testID="google-sign-in-button"
        />
        {!google.configured ? (
          <Text style={styles.hint}>
            Google sign-in needs a Google Cloud OAuth client id
            (EXPO_PUBLIC_GOOGLE_CLIENT_ID) that hasn’t been configured yet.
          </Text>
        ) : null}
      </View>

      {appleAvailable && Platform.OS === 'ios' ? (
        <View style={styles.section}>
          <Button
            title="Continue with Apple"
            onPress={() => void handleApplePress()}
            disabled={busy}
            testID="apple-sign-in-button"
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Phone number</Text>
        {phoneStep === 'enter-phone' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="+15555550123"
              autoComplete="tel"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              testID="phone-number-input"
            />
            <Button
              title="Send code"
              onPress={() => void handleSendCode()}
              disabled={busy || phoneNumber.trim().length === 0}
              testID="send-code-button"
            />
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="123456"
              keyboardType="number-pad"
              value={otpCode}
              onChangeText={setOtpCode}
              testID="otp-code-input"
            />
            <Button
              title="Verify code"
              onPress={() => void handleConfirmCode()}
              disabled={busy || otpCode.trim().length === 0}
              testID="verify-code-button"
            />
            <Button
              title="Use a different number"
              onPress={() => {
                clearAuthError();
                setPhoneStep('enter-phone');
                setConfirmationResult(null);
                setOtpCode('');
              }}
              testID="change-phone-number-button"
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hint: { fontSize: 12, color: '#888' },
  error: {
    color: '#B00020',
    textAlign: 'center',
    fontSize: 14,
  },
});
