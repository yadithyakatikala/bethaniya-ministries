import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  Badge,
  ErrorState,
  SegmentedChoice,
  SkeletonRows,
  Tappable,
  TextField,
  Toast,
  useTheme,
  useToast,
} from '../../theme';
import { fontFamilies } from '../../theme/tokens';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToOwnProfile,
  updateOwnProfile,
  type Gender,
  type UserProfile,
} from '../../services/firebase/userProfile';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
  parseAge,
} from '../onboarding/profileCompleteness';
import { resendEmailVerification } from '../../services/firebase/authService';
import { logAuthError, toFriendlyAuthMessage } from '../../services/firebase/authErrors';

type Field = 'name' | 'phone' | 'gender' | 'age';

/**
 * Profile -- the member's own details, as rows: a label, the value, and
 * "Edit" at the right. Editing a row swaps THAT row for its field with Save
 * and Cancel under it (one row at a time; starting another puts the first
 * back as it was); a save closes the field and says "Saved." in a toast.
 *
 * Name, phone number, gender and age are the member's to change. The email
 * is shown, never edited here: Firebase Auth owns it. Beside it, whether it
 * is verified -- in words (a Verified badge, or "Not verified" with a button
 * to send the email again) -- since verification is surfaced rather than
 * enforced (blocking a church member on an unread email buys nothing; the
 * rules already scope every write to its owner).
 *
 * What is editable matches firestore.rules' isValidUserProfileSelfUpdate().
 * Phone is optional and never an authentication requirement (this app has no
 * phone sign-in); an empty field withdraws a number the member gave, and
 * anything else has to look like a phone number by the same rule onboarding
 * uses. Age is a whole number of years, 1 to 120, by the same rule; nothing in
 * the app reads it to make a decision (see onboarding/profileCompleteness.ts).
 *
 * NO PHOTOS (decision H6): the church's plan cannot store a picture, so
 * there is no "Change photo" any more -- the member's picture is their
 * initial, drawn in the header above (../you/YouScreen.tsx).
 *
 * This view sits under the tabs of the You screen, which already shows the
 * name and the email in its header, so it has no title of its own and
 * Settings is the sliders button up there.
 */
export function ProfileScreen() {
  const { user, status } = useAuth();
  // Only ever mounted behind App.tsx's authenticated gate, so uid is normally
  // never null here. The status check matters for this screen's own tests,
  // which mount it directly: on the first render after AuthProvider mounts,
  // status is still 'loading', and treating that tick as "signed out" would
  // flash the empty view before the real loading state.
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;
  const { colors, layout, type } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();

  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const [editing, setEditing] = useState<Field | null>(null);
  const [text, setText] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to subscribe to while auth is still resolving, or once it has
    // resolved with nobody signed in (a case only this screen's own tests reach).
    if (status === 'loading' || !uid) return undefined;
    return subscribeToOwnProfile(
      uid,
      (next) => {
        setProfile(next);
        setLoadError(false);
      },
      () => setLoadError(true)
    );
  }, [uid, status, retryToken]);

  // Derived, not stored: nobody signed in renders the same empty rows a null
  // profile document would, without the effect having to reset anything.
  const shown = status === 'loading' ? undefined : uid ? profile : null;

  function startEdit(field: Field) {
    setError(null);
    setEditing(field);
    if (field === 'name') setText(shown?.displayName ?? '');
    if (field === 'phone') setText(shown?.phoneNumber ?? '');
    if (field === 'age') setText(shown?.age ? String(shown.age) : '');
    if (field === 'gender') setGender(shown?.gender ?? null);
  }

  function cancelEdit() {
    setEditing(null);
    setError(null);
  }

  /**
   * Validates and writes the one field being edited. Each field has its own
   * rule and its own words for what went wrong; a failed write keeps the
   * field open with what was typed, and says so.
   */
  async function save() {
    if (!uid || !editing) return;
    let fields: Parameters<typeof updateOwnProfile>[1];
    let failed = t('profile.saveFailed');

    if (editing === 'name') {
      const name = text.trim();
      if (name.length === 0) return setError(t('profile.nameEmpty'));
      fields = { displayName: name };
      failed = t('profile.nameSaveFailed');
    } else if (editing === 'phone') {
      const phone = text.trim();
      if (phone.length > 0 && !isValidPhoneNumber(phone)) {
        return setError(t('onboarding.phoneError'));
      }
      // An empty field is a legitimate answer: withdrawing a number you gave.
      fields = { phoneNumber: phone.length > 0 ? normalizePhoneNumber(phone) : null };
    } else if (editing === 'age') {
      const age = parseAge(text);
      if (age === null) return setError(t('onboarding.ageError'));
      fields = { age };
    } else {
      if (!gender) return;
      fields = { gender };
    }

    setSaving(true);
    setError(null);
    try {
      await updateOwnProfile(uid, fields);
      setEditing(null);
      toast.show(t('profile.saved'));
    } catch {
      setError(failed);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Re-sends the address-verification email Firebase already sent at
   * sign-up. Free on the Spark plan (Firebase sends it directly; no Cloud
   * Function involved). Rate limiting is Firebase's own -- a rapid second
   * press surfaces as auth/too-many-requests, which toFriendlyAuthMessage()
   * maps to a "please wait a moment" message rather than anything alarming.
   */
  async function handleResendVerification() {
    if (!user) return;
    setVerificationNotice(null);
    setVerificationError(null);
    setResending(true);
    try {
      await resendEmailVerification(user);
      setVerificationNotice(t('profile.verificationSent'));
    } catch (failure) {
      logAuthError('resend-verification', failure);
      setVerificationError(toFriendlyAuthMessage(failure));
    } finally {
      setResending(false);
    }
  }

  const pad = { paddingHorizontal: layout.screenMargin };

  // loadError is checked first: an error and "still loading" (profile still
  // undefined) are otherwise indistinguishable, since the error callback never
  // touches `profile` -- checking loading first would mask a real failure
  // behind the skeleton for good.
  if (loadError) {
    return (
      <View style={[pad, styles.state]}>
        <ErrorState
          testID="profile-load-error"
          message={t('profile.loadError')}
          retryLabel={t('common.tryAgain')}
          onRetry={() => {
            setLoadError(false);
            setProfile(undefined);
            setRetryToken((token) => token + 1);
          }}
        />
      </View>
    );
  }

  if (shown === undefined) {
    return (
      <View style={[pad, styles.state]}>
        <SkeletonRows
          count={4}
          leading="none"
          label={t('common.loading')}
          testID="profile-loading"
        />
      </View>
    );
  }

  const genderLabel = shown?.gender
    ? t(shown.gender === 'male' ? 'onboarding.genderMale' : 'onboarding.genderFemale')
    : null;

  /** The row's value, or a quiet "Not set". */
  const value = (testID: string, text: string | null | undefined) => (
    <Text
      testID={testID}
      style={[
        styles.value,
        text
          ? { color: colors.ink, fontFamily: fontFamilies.interfaceMedium }
          : { color: colors.inkSubtle },
      ]}
    >
      {text || t('profile.notSet')}
    </Text>
  );

  const edit = (field: Field) => (
    <Tappable
      testID={`profile-edit-${field}`}
      accessibilityRole="button"
      accessibilityLabel={`${t('profile.edit')}: ${t(LABELS[field])}`}
      onPress={() => startEdit(field)}
      style={styles.edit}
    >
      <Text style={[styles.editText, { color: colors.accent }]}>{t('profile.edit')}</Text>
    </Tappable>
  );

  /** A row of the profile, or -- while it is being edited -- its field. */
  const row = (field: Field, display: string | null | undefined, input: ReactNode) =>
    editing === field ? (
      <View key={field} style={styles.editor} testID={`profile-editor-${field}`}>
        {input}
        <View style={styles.buttons}>
          <AppButton
            testID="profile-save"
            title={t('common.save')}
            compact
            loading={saving}
            onPress={() => void save()}
          />
          <AppButton
            testID="profile-cancel"
            title={t('common.cancel')}
            variant="text"
            disabled={saving}
            onPress={cancelEdit}
          />
        </View>
      </View>
    ) : (
      <View
        key={field}
        testID={`profile-row-${field}`}
        style={[styles.row, { borderBottomColor: colors.border }]}
      >
        <Text style={[styles.label, { color: colors.inkMuted }]}>{t(LABELS[field])}</Text>
        <View style={styles.valueBox}>{value(`profile-${field}`, display)}</View>
        {edit(field)}
      </View>
    );

  return (
    <View style={styles.screen} testID="profile-screen">
      <ScrollView
        testID="profile-scroll"
        // Otherwise the first tap on Save/Cancel with a field focused only
        // dismisses the keyboard -- see ../auth/SignInScreen.tsx.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[pad, styles.content]}
      >
        <View style={[styles.rule, { borderTopColor: colors.border }]} />

        {row(
          'name',
          shown?.displayName,
          <TextField
            testID="profile-name-input"
            label={t('profile.displayName')}
            value={text}
            onChangeText={setText}
            error={error}
            autoFocus
            placeholder={t('auth.namePlaceholder')}
          />
        )}

        <View
          testID="profile-row-email"
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.label, { color: colors.inkMuted }]}>
            {t('profile.emailLabel')}
          </Text>
          <View style={styles.valueBox}>
            {value('profile-email', shown?.email)}
            {/* Only an account with an address has a verified state to report
                (a phone-only account has none, and says nothing). */}
            {user?.email ? (
              user.emailVerified ? (
                <Badge
                  testID="profile-email-verified-status"
                  variant="success"
                  icon="check"
                  label={t('profile.emailVerified')}
                />
              ) : (
                <>
                  <Badge
                    testID="profile-email-verified-status"
                    variant="warning"
                    label={t('profile.emailUnverified')}
                  />
                  <AppButton
                    testID="profile-resend-verification-button"
                    title={t('profile.resendVerification')}
                    variant="secondary"
                    compact
                    loading={resending}
                    onPress={() => void handleResendVerification()}
                  />
                  {verificationNotice ? (
                    <Text
                      testID="profile-verification-notice"
                      accessibilityLiveRegion="polite"
                      style={[type.help, { color: colors.success }]}
                    >
                      {verificationNotice}
                    </Text>
                  ) : null}
                  {verificationError ? (
                    <Text
                      testID="profile-verification-error"
                      accessibilityLiveRegion="polite"
                      style={[type.help, { color: colors.danger }]}
                    >
                      {verificationError}
                    </Text>
                  ) : null}
                </>
              )
            ) : null}
          </View>
        </View>

        {row(
          'phone',
          shown?.phoneNumber,
          <TextField
            testID="profile-phone-input"
            label={t('profile.phoneNumber')}
            value={text}
            onChangeText={setText}
            error={error}
            autoFocus
            keyboardType="phone-pad"
            placeholder={t('onboarding.phonePlaceholder')}
          />
        )}

        {row(
          'gender',
          genderLabel,
          <View style={styles.choice}>
            <Text style={[type.label, { color: colors.ink }]}>
              {t('onboarding.gender')}
            </Text>
            <SegmentedChoice
              testID="profile-gender-choice"
              accessibilityLabel={t('onboarding.gender')}
              options={[
                { value: 'male' as Gender, label: t('onboarding.genderMale') },
                { value: 'female' as Gender, label: t('onboarding.genderFemale') },
              ]}
              selected={gender}
              onSelect={setGender}
            />
            {error ? (
              <Text
                testID="profile-gender-error"
                style={[type.help, { color: colors.danger }]}
              >
                {error}
              </Text>
            ) : null}
          </View>
        )}

        {row(
          'age',
          shown?.age ? String(shown.age) : null,
          <TextField
            testID="profile-age-input"
            label={t('profile.age')}
            value={text}
            onChangeText={setText}
            error={error}
            autoFocus
            keyboardType="number-pad"
            maxLength={3}
            placeholder={t('onboarding.agePlaceholder')}
          />
        )}
      </ScrollView>

      <Toast message={toast.message} />
    </View>
  );
}

const LABELS = {
  name: 'profile.displayName',
  phone: 'profile.phoneNumber',
  gender: 'onboarding.gender',
  age: 'profile.age',
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { marginTop: 4 },
  content: { paddingBottom: 40 },
  rule: { borderTopWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  label: {
    width: 96,
    fontFamily: fontFamilies.interfaceMedium,
    fontWeight: '500',
    fontSize: 13.5,
    lineHeight: 19,
  },
  valueBox: { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' },
  value: { fontSize: 16, lineHeight: 22, fontFamily: fontFamilies.interfaceRegular },
  edit: { minHeight: 44, justifyContent: 'center' },
  editText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  editor: { gap: 12, paddingTop: 16, paddingBottom: 12 },
  choice: { gap: 8 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
