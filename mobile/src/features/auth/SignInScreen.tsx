import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
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
 *
 * Restyled onto the shared Vespers theme -- a branded evergreen monogram,
 * themed provider buttons (the shared AppButton primitive, whose own
 * `disabled` prop already sets accessibilityState.disabled -- see
 * SignInScreen.test.tsx's disabled-state assertion), and a themed error
 * banner. Every provider call, testID, and error-message string is
 * unchanged. Now reads useTheme(), so it needs PreferencesProvider in
 * its render tree -- it already gets one in production (App.tsx renders
 * this inside AuthProvider > PreferencesProvider), and
 * SignInScreen.test.tsx now wraps it the same way.
 */
export function SignInScreen() {
  const { authErrorMessage, reportSignInError, clearAuthError } = useAuth();
  const { colors, radii } = useTheme();
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
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      testID="sign-in-screen"
    >
      <View style={styles.brandBlock}>
        <View
          style={[
            styles.monogram,
            { backgroundColor: colors.primary, borderRadius: radii.card },
          ]}
        >
          <Text style={styles.monogramText}>B</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Sign in to Bethaniya Ministries
        </Text>
      </View>

      {authErrorMessage ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.liveTint, borderRadius: radii.control },
          ]}
        >
          <Text
            style={[styles.error, { color: colors.danger }]}
            testID="auth-error-message"
          >
            {authErrorMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppButton
          title={
            google.configured
              ? 'Continue with Google'
              : 'Continue with Google (not configured)'
          }
          variant="secondary"
          onPress={() => void google.promptAsync()}
          disabled={!google.canPrompt || busy}
          testID="google-sign-in-button"
        />
        {!google.configured ? (
          <Text style={[styles.hint, { color: colors.secondaryText }]}>
            Google sign-in needs a Google Cloud OAuth client id
            (EXPO_PUBLIC_GOOGLE_CLIENT_ID) that hasn’t been configured yet.
          </Text>
        ) : null}
      </View>

      {appleAvailable && Platform.OS === 'ios' ? (
        <View style={styles.section}>
          <AppButton
            title="Continue with Apple"
            variant="secondary"
            onPress={() => void handleApplePress()}
            disabled={busy}
            testID="apple-sign-in-button"
          />
        </View>
      ) : null}

      <View style={[styles.divider, { borderTopColor: colors.border }]} />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>
          Phone number
        </Text>
        {phoneStep === 'enter-phone' ? (
          <>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.control,
                },
              ]}
              placeholder="+15555550123"
              placeholderTextColor={colors.secondaryText}
              autoComplete="tel"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              testID="phone-number-input"
            />
            <AppButton
              title="Send code"
              onPress={() => void handleSendCode()}
              disabled={busy || phoneNumber.trim().length === 0}
              testID="send-code-button"
            />
          </>
        ) : (
          <>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.control,
                },
              ]}
              placeholder="123456"
              placeholderTextColor={colors.secondaryText}
              keyboardType="number-pad"
              value={otpCode}
              onChangeText={setOtpCode}
              testID="otp-code-input"
            />
            <AppButton
              title="Verify code"
              onPress={() => void handleConfirmCode()}
              disabled={busy || otpCode.trim().length === 0}
              testID="verify-code-button"
            />
            <AppButton
              title="Use a different number"
              variant="secondary"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  brandBlock: { alignItems: 'center', gap: 14, marginBottom: 4 },
  monogram: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  monogramText: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  title: { fontSize: 21, fontWeight: '600', textAlign: 'center' },
  errorBanner: { padding: 12 },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  hint: { fontSize: 12 },
  error: {
    textAlign: 'center',
    fontSize: 14,
  },
});
