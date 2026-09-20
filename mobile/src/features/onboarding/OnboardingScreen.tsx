import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { PRODUCT_NAME } from '../../theme/brand';
import { AppButton } from '../../theme/ui/AppButton';
import { SegmentedChoice } from '../../theme/ui/SegmentedChoice';
import { TextField } from '../../theme/ui/TextField';
import {
  completeOnboarding,
  type Gender,
  type LanguagePreference,
  type UserProfile,
} from '../../services/firebase/userProfile';
import {
  isValidFullName,
  isValidPhoneNumber,
  normalizePhoneNumber,
  onboardingDefaults,
} from './profileCompleteness';

/**
 * The questionnaire a member answers once, after their first sign-in.
 *
 * =====================================================================
 * WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT
 * =====================================================================
 * It is a PROFILE form. It is not a step in authentication. Signing in
 * is finished by the time this appears, and asking for a phone number
 * here has nothing to do with how anyone signs in -- the app's methods
 * are email/password and Google, there is no OTP anywhere in it, and the
 * phone field says so out loud, because being asked for a number is
 * exactly when people start waiting for a code that is never coming.
 *
 * =====================================================================
 * IT DOES NOT TRAP ANYONE
 * =====================================================================
 * There is a "Not now". A member who does not want to answer gets into
 * the app, and Profile keeps a row that brings them back here. Insisting
 * would mean a congregation member who mistyped something, or simply
 * does not want to say, has an app that shows them nothing at all --
 * which is a worse outcome than an incomplete record.
 *
 * =====================================================================
 * NOTHING IS SAVED PIECEMEAL, AND NOTHING IS LOST
 * =====================================================================
 * One write for all four answers (see
 * ../../services/firebase/userProfile.ts's completeOnboarding), so there
 * is no half-finished profile to reason about. If the write fails the
 * error is shown, the form keeps every character the member typed, and
 * the button becomes pressable again. The one thing this screen will
 * never do is report success it did not get -- see M6 BUG 1, which was
 * precisely a write that failed silently.
 *
 * =====================================================================
 * THE LANGUAGE ANSWER SETS THE APP LANGUAGE. ONLY THAT.
 * =====================================================================
 * It goes through PreferencesContext's setAppLanguage, the same setter
 * Settings uses, so the interface changes and the Bible mode and theme
 * are untouched. M2 split those three apart deliberately and this screen
 * does not put them back together: a member choosing Telugu here has
 * said which language they read menus in, not which Bible they want or
 * whether they like dark mode.
 */
export function OnboardingScreen({
  profile,
  onDone,
  onSkip,
}: {
  /** The member's current profile, for prefilling. `null` when the
   *  document has not been created yet. */
  profile: UserProfile | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const { user } = useAuth();
  const { appLanguage, setAppLanguage } = usePreferences();
  const { colors, radii, spacing, type } = useTheme();
  const { t } = useTranslation();

  const defaults = onboardingDefaults({
    profile,
    authDisplayName: user?.displayName,
    authPhoneNumber: user?.phoneNumber,
    appLanguage,
  });

  const [fullName, setFullName] = useState(defaults.fullName);
  const [phoneNumber, setPhoneNumber] = useState(defaults.phoneNumber);
  const [gender, setGender] = useState<Gender | null>(defaults.gender);
  const [language, setLanguage] = useState<LanguagePreference>(
    defaults.preferredLanguage
  );

  const [saving, setSaving] = useState(false);
  /** Set only after a failed submit, so the form does not scold someone
   *  for fields they have not reached yet. */
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameValid = isValidFullName(fullName);
  const phoneValid = isValidPhoneNumber(phoneNumber);
  const genderValid = gender !== null;

  async function handleSubmit() {
    setShowErrors(true);
    setSaveError(null);
    if (!nameValid || !phoneValid || !genderValid || !user) return;

    setSaving(true);
    try {
      await completeOnboarding(user.uid, {
        fullName: fullName.trim(),
        phoneNumber: normalizePhoneNumber(phoneNumber),
        gender,
        preferredLanguage: language,
      });
      // AFTER the profile write succeeded, not before: this setter also
      // writes to the profile, and running it first would leave the app
      // in a language the member chose on a form that then failed.
      await setAppLanguage(language);
      onDone();
    } catch (error) {
      console.warn('[onboarding] could not save the profile:', error);
      setSaveError(t('onboarding.saveFailed'));
      // Deliberately NOT calling onDone(). Nothing was saved, so
      // pretending otherwise would lose every answer on this screen.
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { padding: spacing.lg, gap: spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="onboarding-screen"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">
            {t('onboarding.title', { app: PRODUCT_NAME })}
          </Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {t('onboarding.subtitle')}
          </Text>
        </View>

        {saveError ? (
          <View
            testID="onboarding-error"
            accessibilityLiveRegion="polite"
            style={[
              styles.notice,
              {
                backgroundColor: colors.surface,
                borderColor: colors.danger,
                borderRadius: radii.card,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[type.body, { color: colors.ink }]}>{saveError}</Text>
          </View>
        ) : null}

        <TextField
          testID="onboarding-full-name"
          label={t('onboarding.fullName')}
          placeholder={t('onboarding.fullNamePlaceholder')}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          required
          error={showErrors && !nameValid ? t('onboarding.fullNameError') : null}
        />

        <TextField
          testID="onboarding-phone"
          label={t('onboarding.phone')}
          placeholder={t('onboarding.phonePlaceholder')}
          helpText={t('onboarding.phoneHelp')}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          required
          error={showErrors && !phoneValid ? t('onboarding.phoneError') : null}
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.label, { color: colors.ink }]}>
            {t('onboarding.gender')}
          </Text>
          <SegmentedChoice
            testID="onboarding-gender"
            accessibilityLabel={t('onboarding.gender')}
            options={[
              { value: 'male' as Gender, label: t('onboarding.genderMale') },
              { value: 'female' as Gender, label: t('onboarding.genderFemale') },
            ]}
            // Nothing is preselected until the member chooses: a default
            // here would silently record an answer they never gave.
            selected={gender ?? ('' as Gender)}
            onSelect={setGender}
          />
          {showErrors && !genderValid ? (
            <Text
              testID="onboarding-gender-error"
              style={[type.bodySmall, { color: colors.danger }]}
            >
              {t('onboarding.genderError')}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.label, { color: colors.ink }]}>
            {t('onboarding.language')}
          </Text>
          <Text style={[type.bodySmall, { color: colors.inkMuted }]}>
            {t('onboarding.languageHelp')}
          </Text>
          <SegmentedChoice
            testID="onboarding-language"
            accessibilityLabel={t('onboarding.language')}
            options={[
              { value: 'en' as LanguagePreference, label: t('settings.languageEnglish') },
              { value: 'te' as LanguagePreference, label: t('settings.languageTelugu') },
            ]}
            selected={language}
            onSelect={setLanguage}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppButton
            testID="onboarding-submit"
            title={t('onboarding.submit')}
            onPress={() => void handleSubmit()}
            loading={saving}
            fullWidth
          />
          <AppButton
            testID="onboarding-skip"
            title={t('onboarding.skip')}
            variant="text"
            onPress={onSkip}
            disabled={saving}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  notice: { borderWidth: 1.5 },
});
