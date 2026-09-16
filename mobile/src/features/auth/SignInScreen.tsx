import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
import {
  createAccountWithEmail,
  sendPasswordReset,
  signInWithEmail,
} from '../../services/firebase/authService';
import {
  isAppleSignInAvailable,
  signInWithApple,
} from '../../services/firebase/appleSignIn';
import { useGoogleSignIn } from './useGoogleSignIn';

/**
 * Which of the three email flows the form is currently showing. Sign-in and
 * sign-up share the same screen because they share most of the same fields;
 * password reset is a distinct, narrower step.
 */
type EmailMode = 'sign-in' | 'sign-up' | 'reset-password';

/** Firebase's own minimum. Checked client-side purely so the user finds out
 * before a round-trip; Firebase enforces it regardless. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Unauthenticated screen. V1 sign-in methods: Email/Password (primary,
 * including self-service account creation and password reset) and Google.
 *
 * PHONE OTP IS NOT PART OF V1 -- it was removed from scope during the V1
 * production-readiness work, and this screen renders no phone UI at all.
 * The service-layer phone modules are retained but unreachable; see
 * ../../services/firebase/authService.ts's header comment.
 *
 * Both third-party provider buttons hide themselves when they cannot
 * actually work: Apple when the platform/device can't support it (Android,
 * or iOS without the capability), and Google when no OAuth client id exists
 * for the running platform (see useGoogleSignIn.ts, which logs a loud
 * release-build error in that case). Google's button used to render as
 * "Continue with Google (not configured)", permanently disabled -- a dead
 * affordance that has no place in a shipped build.
 *
 * Every failure routes through reportSignInError(), which both logs the real
 * error code (visible in `adb logcat` for release builds) and maps it to a
 * user-safe message -- see ../../services/firebase/authErrors.ts.
 */
export function SignInScreen() {
  const { authErrorMessage, reportSignInError, clearAuthError } = useAuth();
  const { colors, radii } = useTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [mode, setMode] = useState<EmailMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = useGoogleSignIn(reportSignInError);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  /** Clears both the error banner and any success notice. Called whenever
   * the user starts a new attempt or switches mode, so stale feedback never
   * sits above a fresh form. */
  function resetFeedback() {
    clearAuthError();
    setNotice(null);
  }

  function switchMode(next: EmailMode) {
    resetFeedback();
    setMode(next);
    setPassword('');
  }

  /** Shared wrapper: every flow below has the same busy/feedback/error
   * handling, and doing it in one place is what keeps a failure from ever
   * leaving the button stuck in its disabled state. */
  async function run(action: () => Promise<void>) {
    resetFeedback();
    setBusy(true);
    try {
      await action();
    } catch (error) {
      reportSignInError(error);
    } finally {
      setBusy(false);
    }
  }

  const trimmedEmail = email.trim();
  const emailLooksPresent = trimmedEmail.length > 0;
  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  // Sign-in only needs *something* in both fields -- Firebase is the
  // authority on whether they're correct. Sign-up additionally enforces the
  // minimum length locally so the user isn't told off after a round-trip.
  const canSubmitEmailForm =
    mode === 'reset-password'
      ? emailLooksPresent
      : mode === 'sign-in'
        ? emailLooksPresent && password.length > 0
        : emailLooksPresent && passwordLongEnough;

  function handleEmailSubmit() {
    if (mode === 'sign-in') {
      return run(async () => {
        await signInWithEmail(trimmedEmail, password);
      });
    }
    if (mode === 'sign-up') {
      return run(async () => {
        await createAccountWithEmail(trimmedEmail, password, displayName);
      });
    }
    return run(async () => {
      await sendPasswordReset(trimmedEmail);
      // Deliberately does NOT confirm whether an account exists for this
      // address -- that would make this an account enumeration oracle.
      setNotice(
        'If an account exists for that email, a password reset link is on its way.'
      );
      setMode('sign-in');
    });
  }

  const submitTitle =
    mode === 'sign-in'
      ? 'Sign in'
      : mode === 'sign-up'
        ? 'Create account'
        : 'Send reset link';

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      // Without this, the first tap on "Sign in" while the password field
      // still has focus is swallowed by the ScrollView dismissing the
      // keyboard, so the user has to tap twice to submit.
      keyboardShouldPersistTaps="handled"
      testID="sign-in-screen"
    >
      <View style={styles.brandBlock}>
        <View
          style={[
            styles.monogram,
            { backgroundColor: colors.primary, borderRadius: radii.card },
          ]}
        >
          <Text style={[styles.monogramText, { color: colors.onPrimary }]}>B</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'sign-up'
            ? 'Create your Bethaniya Ministries account'
            : 'Sign in to Bethaniya Ministries'}
        </Text>
      </View>

      {authErrorMessage ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.liveTint, borderRadius: radii.control },
          ]}
        >
          <Text
            style={[styles.bannerText, { color: colors.danger }]}
            testID="auth-error-message"
          >
            {authErrorMessage}
          </Text>
        </View>
      ) : null}

      {notice ? (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.surface, borderRadius: radii.control },
          ]}
        >
          <Text
            style={[styles.bannerText, { color: colors.text }]}
            testID="auth-notice-message"
          >
            {notice}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>
          {mode === 'reset-password' ? 'Reset your password' : 'Email'}
        </Text>

        {mode === 'sign-up' ? (
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
            placeholder="Your name"
            placeholderTextColor={colors.secondaryText}
            autoComplete="name"
            value={displayName}
            onChangeText={setDisplayName}
            testID="display-name-input"
          />
        ) : null}

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
          placeholder="you@example.com"
          placeholderTextColor={colors.secondaryText}
          autoComplete="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="email-input"
        />

        {mode !== 'reset-password' ? (
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
            placeholder={
              mode === 'sign-up'
                ? `Password (${MIN_PASSWORD_LENGTH}+ characters)`
                : 'Password'
            }
            placeholderTextColor={colors.secondaryText}
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="password-input"
          />
        ) : null}

        <AppButton
          title={submitTitle}
          onPress={() => void handleEmailSubmit()}
          disabled={busy || !canSubmitEmailForm}
          testID="email-submit-button"
        />

        {mode === 'sign-in' ? (
          <>
            <AppButton
              title="Forgot your password?"
              variant="secondary"
              onPress={() => switchMode('reset-password')}
              disabled={busy}
              testID="forgot-password-link"
            />
            <AppButton
              title="New here? Create an account"
              variant="secondary"
              onPress={() => switchMode('sign-up')}
              disabled={busy}
              testID="go-to-sign-up-link"
            />
          </>
        ) : (
          <AppButton
            title="Back to sign in"
            variant="secondary"
            onPress={() => switchMode('sign-in')}
            disabled={busy}
            testID="back-to-sign-in-link"
          />
        )}
      </View>

      {/* Provider options are only offered on the sign-in step -- they make
          no sense mid-signup or mid-reset. */}
      {mode === 'sign-in' && (google.configured || (appleAvailable && Platform.OS === 'ios')) ? (
        <>
          <View style={[styles.divider, { borderTopColor: colors.border }]} />

          {google.configured ? (
            <View style={styles.section}>
              <AppButton
                title="Continue with Google"
                variant="secondary"
                onPress={() => void google.promptAsync()}
                disabled={!google.canPrompt || busy}
                testID="google-sign-in-button"
              />
            </View>
          ) : null}

          {appleAvailable && Platform.OS === 'ios' ? (
            <View style={styles.section}>
              <AppButton
                title="Continue with Apple"
                variant="secondary"
                onPress={() =>
                  void run(async () => {
                    await signInWithApple();
                  })
                }
                disabled={busy}
                testID="apple-sign-in-button"
              />
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  brandBlock: { alignItems: 'center', gap: 14, marginBottom: 4 },
  monogram: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontSize: 24, fontWeight: '600' },
  title: { fontSize: 21, fontWeight: '600', textAlign: 'center' },
  banner: { padding: 12 },
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
  bannerText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
