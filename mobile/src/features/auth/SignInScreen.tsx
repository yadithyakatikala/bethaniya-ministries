import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { AppButton, NoticeBanner, TextField, useTheme } from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { PRODUCT_NAME } from '../../theme/brand';
import { useKeyboardVisible } from '../../navigation/useKeyboardVisible';
import { BrandPortrait } from '../common/BrandPortrait';
import {
  createAccountWithEmail,
  sendPasswordReset,
  signInWithEmail,
} from '../../services/firebase/authService';
import { fieldAtFault, toFriendlyAuthMessage } from '../../services/firebase/authErrors';
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
 * THE LOOK. A full screen in the order the app has always had: the round
 * portrait over the word MARANATHA, a serif title, then the form -- every
 * field with its label ABOVE it and kept there, the one primary button, two
 * quiet gold text actions (forgot your password / new here), a hairline, and
 * the provider buttons. While the keyboard is up the portrait shrinks to 44,
 * the word goes and the title steps down, so the form is not pushed off a
 * short screen.
 *
 * WHAT IS NOT HERE ON PURPOSE
 *  * Phone OTP. It is not part of V1 -- it was removed from scope during the
 *    V1 production-readiness work, and this screen renders no phone UI at
 *    all. The service-layer phone modules are retained but unreachable; see
 *    ../../services/firebase/authService.ts's header comment.
 *  * A line about agreeing to the Terms and Privacy Policy. Whether the
 *    legal pages should open before an account exists is an open question
 *    for the church's counsel (design question L1), and this app does not
 *    presume the answer. The pages are reachable from Settings.
 *  * The Google and Apple marks. Both companies require their own artwork,
 *    used as their brand guidelines say, on a sign-in button. The buttons are
 *    words until the church has set those providers up and has the assets.
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
 * user-safe message -- see ../../services/firebase/authErrors.ts. The message
 * is shown in a danger notice above the form, and the field the failure is
 * about is outlined too (never colour alone: the sentence says it, the outline
 * shows where). A wrong email or password outlines the PASSWORD box either way,
 * so the outline never gives away whether an address is registered.
 */
export function SignInScreen() {
  const { authErrorMessage, reportSignInError, clearAuthError } = useAuth();
  const { colors, layout, type } = useTheme();
  const { t, appLanguage } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardVisible();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [mode, setMode] = useState<EmailMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The field the last email-form failure was about, with the sentence it was
   * reported as, so the outline belongs to THAT sentence: if something else
   * (a cancelled Google sign-in) replaces the notice, the outline goes with it.
   */
  const [fault, setFault] = useState<{
    field: 'email' | 'password';
    message: string;
  } | null>(null);

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
    // A new form starts with the password hidden, whatever the last one did.
    setShowPassword(false);
  }

  /** Shared wrapper: every flow below has the same busy/feedback/error
   * handling, and doing it in one place is what keeps a failure from ever
   * leaving the button stuck in its disabled state. */
  async function run(action: () => Promise<void>, { form = false } = {}) {
    resetFeedback();
    setBusy(true);
    try {
      await action();
    } catch (error) {
      reportSignInError(error);
      // Only the email form's own failures are about one of ITS fields; a
      // failed Apple sign-in is not about the password box.
      const field = form ? fieldAtFault(error) : null;
      setFault(field ? { field, message: toFriendlyAuthMessage(error) } : null);
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
      return run(
        async () => {
          await signInWithEmail(trimmedEmail, password);
        },
        { form: true }
      );
    }
    if (mode === 'sign-up') {
      return run(
        async () => {
          await createAccountWithEmail(trimmedEmail, password, displayName);
        },
        { form: true }
      );
    }
    return run(
      async () => {
        await sendPasswordReset(trimmedEmail);
        // Deliberately does NOT confirm whether an account exists for this
        // address -- that would make this an account enumeration oracle.
        setNotice(t('auth.resetSent'));
        setMode('sign-in');
      },
      { form: true }
    );
  }

  const submitTitle =
    mode === 'sign-in'
      ? t('auth.signIn')
      : mode === 'sign-up'
        ? t('auth.createAccount')
        : t('auth.sendResetLink');

  const title =
    mode === 'sign-up'
      ? t('auth.signUpTitle', { app: PRODUCT_NAME })
      : mode === 'reset-password'
        ? t('auth.resetTitle')
        : t('auth.signInTitle', { app: PRODUCT_NAME });

  const showProviders =
    mode === 'sign-in' &&
    (google.configured || (appleAvailable && Platform.OS === 'ios'));
  const hasBanner = Boolean(authErrorMessage) || Boolean(notice);
  // The outline goes with the sentence: when the notice is gone or says
  // something else, so is it.
  const invalidField = fault && fault.message === authErrorMessage ? fault.field : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (keyboardUp ? 2 : 12),
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: layout.screenMargin,
        },
      ]}
      // Without this, the first tap on "Sign in" while the password field
      // still has focus is swallowed by the ScrollView dismissing the
      // keyboard, so the user has to tap twice to submit.
      keyboardShouldPersistTaps="handled"
      // iOS only: scrolls the focused field clear of the keyboard.
      automaticallyAdjustKeyboardInsets
      testID="sign-in-screen"
    >
      <View style={styles.brand}>
        <BrandPortrait size={keyboardUp ? 44 : 72} testID="sign-in-portrait" />
        {keyboardUp ? null : (
          // The name again, as a mark. The title already says it in words, so
          // a screen reader skips this one.
          <Text
            testID="sign-in-wordmark"
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.wordmark, { color: colors.accent }]}
          >
            {PRODUCT_NAME.toUpperCase()}
          </Text>
        )}
      </View>

      <Text
        accessibilityRole="header"
        // Android only: balances the lines of a title that wraps ("Create your /
        // Maranatha account"), as the approved design draws it.
        textBreakStrategy="balanced"
        testID="sign-in-title"
        style={[
          type.headline,
          styles.title,
          { color: colors.ink },
          keyboardUp && {
            marginTop: 10,
            fontSize: 22,
            lineHeight: appLanguage === 'te' ? 34 : 28,
          },
        ]}
      >
        {title}
      </Text>

      {hasBanner ? (
        <View style={styles.banners}>
          {authErrorMessage ? (
            <NoticeBanner
              tone="danger"
              message={authErrorMessage}
              testID="auth-error-banner"
              messageTestID="auth-error-message"
            />
          ) : null}
          {notice ? (
            <NoticeBanner
              message={notice}
              testID="auth-notice-banner"
              messageTestID="auth-notice-message"
            />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.form, { marginTop: hasBanner ? 16 : keyboardUp ? 14 : 20 }]}>
        {mode === 'sign-up' ? (
          <TextField
            label={t('auth.namePlaceholder')}
            placeholder={t('auth.namePlaceholder')}
            autoComplete="name"
            value={displayName}
            onChangeText={setDisplayName}
            editable={!busy}
            testID="display-name-input"
          />
        ) : null}

        <TextField
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          autoComplete="email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          invalid={invalidField === 'email'}
          testID="email-input"
        />

        {mode !== 'reset-password' ? (
          <TextField
            label={t('auth.password')}
            placeholder={t('auth.password')}
            helpText={
              mode === 'sign-up'
                ? t('auth.passwordHint', { min: MIN_PASSWORD_LENGTH })
                : undefined
            }
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            secureTextEntry={!showPassword}
            toggle={{
              shown: showPassword,
              onToggle: () => setShowPassword((shown) => !shown),
              showLabel: t('auth.show'),
              hideLabel: t('auth.hide'),
            }}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            invalid={invalidField === 'password'}
            testID="password-input"
          />
        ) : null}

        <AppButton
          title={submitTitle}
          fullWidth
          loading={busy}
          disabled={!canSubmitEmailForm}
          onPress={() => void handleEmailSubmit()}
          testID="email-submit-button"
        />
      </View>

      <View style={styles.links}>
        {mode === 'sign-in' ? (
          <>
            <AppButton
              title={t('auth.forgotPassword')}
              variant="text"
              onPress={() => switchMode('reset-password')}
              disabled={busy}
              testID="forgot-password-link"
            />
            <AppButton
              title={t('auth.newHere')}
              variant="text"
              onPress={() => switchMode('sign-up')}
              disabled={busy}
              testID="go-to-sign-up-link"
            />
          </>
        ) : (
          <AppButton
            title={t('auth.backToSignIn')}
            variant="text"
            onPress={() => switchMode('sign-in')}
            disabled={busy}
            testID="back-to-sign-in-link"
          />
        )}
      </View>

      {/* Provider options are only offered on the sign-in step -- they make
          no sense mid-signup or mid-reset. */}
      {showProviders ? (
        <>
          <View
            testID="sign-in-divider"
            style={[styles.divider, { backgroundColor: colors.border }]}
          />
          <View style={styles.providers} testID="sign-in-providers">
            {google.configured ? (
              <AppButton
                title={t('auth.continueWithGoogle')}
                variant="secondary"
                fullWidth
                onPress={() => void google.promptAsync()}
                disabled={!google.canPrompt || busy}
                testID="google-sign-in-button"
              />
            ) : null}

            {appleAvailable && Platform.OS === 'ios' ? (
              <AppButton
                title={t('auth.continueWithApple')}
                variant="secondary"
                fullWidth
                onPress={() =>
                  void run(async () => {
                    await signInWithApple();
                  })
                }
                disabled={busy}
                testID="apple-sign-in-button"
              />
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  brand: { alignItems: 'center', gap: 12 },
  // 13/16 tracked wide, in the English serif whatever the app's language --
  // the name is Latin and is never translated. RN adds the tracking after
  // the last letter too, so a matching left pad keeps the word centred.
  wordmark: {
    fontFamily: fontFamilies.serifEnSemiBold,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 4.2,
    paddingLeft: 4.2,
  },
  title: { textAlign: 'center', marginTop: 18 },
  banners: { marginTop: 16, gap: 8 },
  form: { gap: 16 },
  links: { alignItems: 'center', marginTop: 6 },
  divider: { height: 1, marginTop: 14, marginBottom: 18 },
  providers: { gap: 12 },
});
