import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { storage } from '../../services/firebase/app';
import { useTheme } from '../../theme';
import { AppButton } from '../../theme/ui/AppButton';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  subscribeToOwnProfile,
  updateOwnProfile,
  type UserProfile,
} from '../../services/firebase/userProfile';
import { resendEmailVerification } from '../../services/firebase/authService';
import { toFriendlyUploadMessage } from '../../services/firebase/storageErrors';
import { logAuthError, toFriendlyAuthMessage } from '../../services/firebase/authErrors';

/**
 * Profile screen -- Day 9 requirement (decision 7: "display name, email,
 * phone number, profile photo, edit display name, change profile photo,
 * save, loading state, error state, success/save behavior").
 *
 * Field editability exactly matches decision 2 / firestore.rules'
 * isValidUserProfileSelfUpdate(): displayName and photoURL are editable;
 * email is shown read-only (there is no UI control for it at all, not just
 * a disabled one -- Firebase Auth, not this screen, is the source of truth,
 * and changing it is out of scope); role/createdAt are never displayed
 * here, since they're server-controlled rather than user-facing profile
 * fields.
 *
 * Phone number is optional profile information and only rendered when the
 * profile actually has one -- see the field itself for why. Email
 * verification status is shown alongside the address, since Email/Password
 * is V1's primary sign-in method.
 *
 * A max-5MB image-size check and an image/* type check both happen
 * client-side before upload, purely for a fast/clear error message --
 * the actual enforcement is storage.rules' existing
 * users/{userId}/profile/{fileName} rule (5MB cap, image/* content type,
 * owner-only write), which this screen reuses unchanged (Day 9 decision
 * 5: "Reuse existing Storage path/rules").
 *
 * Restyled onto the shared Vespers theme: card-grouped fields, the
 * shared AppButton primitive (its own `loading` state replaces the
 * previous "swap to a differently-tagged ActivityIndicator" pattern --
 * no test asserted that separate testID, only the button's own), and
 * themed error/success colors. Every other testID/behavior is
 * unchanged -- see ProfileScreen.test.tsx.
 */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, status } = useAuth();
  // ProfileScreen only ever mounts behind App.tsx's authenticated gate (see
  // App.tsx's AuthGate -- AppNavigator, and therefore this screen, only
  // renders once status === 'authenticated'), so uid is normally never
  // null here in production. The status check still matters for this
  // screen's own unit tests, which mount it directly: on the very first
  // render after AuthProvider itself mounts, status is still 'loading'
  // (onAuthStateChanged's callback fires from an effect, one tick later)
  // -- treating that transient tick as "signed out" would incorrectly
  // flash the empty-profile view before the real loading state ever
  // shows.
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;
  const { colors, radii, spacing } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const seededNameRef = useRef(false);

  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  /**
   * Re-sends the address-verification email Firebase already sent at
   * sign-up. Free on the Spark plan (Firebase sends it directly; no Cloud
   * Function involved). Rate limiting is Firebase's own -- a rapid second
   * press surfaces as auth/too-many-requests, which
   * toFriendlyAuthMessage() maps to a "please wait a moment" message
   * rather than anything alarming.
   */
  async function handleResendVerification() {
    if (!user) return;
    setVerificationNotice(null);
    setVerificationError(null);
    setResendingVerification(true);
    try {
      await resendEmailVerification(user);
      setVerificationNotice('Verification email sent. Check your inbox.');
    } catch (error) {
      logAuthError('resend-verification', error);
      setVerificationError(toFriendlyAuthMessage(error));
    } finally {
      setResendingVerification(false);
    }
  }

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    // No subscription to set up while auth is still resolving, or once
    // resolved with no signed-in user -- `displayProfile` below derives
    // the right thing to render for both cases directly from
    // `status`/`uid` without this effect needing to reset `profile`
    // itself (there is nothing to unsubscribe from in either case).
    if (status === 'loading' || !uid) return undefined;
    const unsubscribe = subscribeToOwnProfile(
      uid,
      (next) => {
        setProfile(next);
        setLoadError(false);
        // Seed the editable input from the loaded profile exactly once --
        // not on every snapshot -- so a save-triggered re-fetch (or a
        // preference change synced from another device) never overwrites
        // text the user is still mid-edit on.
        if (!seededNameRef.current && next) {
          setDisplayNameInput(next.displayName ?? '');
          seededNameRef.current = true;
        }
      },
      () => setLoadError(true)
    );
    return unsubscribe;
  }, [uid, status]);

  // Derived, not stored: when there's no signed-in uid (status resolved to
  // 'unauthenticated'/'error' -- see the uid comment above for why this is
  // test-only, never a real production render), this screen renders the
  // same "empty" main content a null profile document would produce,
  // without the effect above ever needing to call setProfile(null) itself.
  const displayProfile = status === 'loading' ? undefined : uid ? profile : null;

  async function handleSaveDisplayName() {
    if (!uid) return;
    const trimmed = displayNameInput.trim();
    if (trimmed.length === 0) {
      setNameError('Display name cannot be empty.');
      setNameSaved(false);
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    setNameSaved(false);
    try {
      await updateOwnProfile(uid, { displayName: trimmed });
      setNameSaved(true);
    } catch {
      setNameError('Could not save your name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleChangePhoto() {
    if (!uid) return;
    setPhotoError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo library access is required to change your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    if (asset.type && asset.type !== 'image') {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      setPhotoError('Please choose an image smaller than 5MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      if (blob.size > MAX_PHOTO_BYTES) {
        setPhotoError('Please choose an image smaller than 5MB.');
        return;
      }
      const extension = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
      const storageRef = ref(storage, `users/${uid}/profile/photo.${extension}`);
      await uploadBytes(storageRef, blob, {
        contentType: asset.mimeType || 'image/jpeg',
      });
      const downloadURL = await getDownloadURL(storageRef);
      await updateOwnProfile(uid, { photoURL: downloadURL });
    } catch (error) {
      // Cloud Storage has no bucket at all on the Spark plan, so an upload
      // there fails permanently rather than transiently -- "please try
      // again" would send a member round a loop that can never succeed.
      // See ../../services/firebase/storageErrors.ts.
      setPhotoError(toFriendlyUploadMessage(error));
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  // loadError is checked first: an error and "still loading" (profile
  // still undefined) are otherwise indistinguishable from profile alone,
  // since the onError callback above never touches profile -- checking
  // loading first would permanently mask a real subscription error
  // behind the loading spinner.
  if (loadError) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
        testID="profile-load-error"
      >
        <Text style={[styles.message, { color: colors.text }]}>
          Could not load your profile.
        </Text>
      </View>
    );
  }

  if (displayProfile === undefined) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
        testID="profile-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      // Otherwise the first tap on Save/Cancel with the name field focused
      // only dismisses the keyboard -- see SignInScreen.tsx.
      keyboardShouldPersistTaps="handled"
      testID="profile-screen"
    >
      <View style={styles.photoSection}>
        {displayProfile?.photoURL ? (
          <Image
            source={{ uri: displayProfile.photoURL }}
            style={styles.photo}
            testID="profile-photo"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[
              styles.photoPlaceholder,
              { backgroundColor: colors.primaryTint, borderColor: colors.border },
            ]}
            testID="profile-photo-placeholder"
          >
            <Text style={{ color: colors.primary, fontSize: 26, fontWeight: '600' }}>
              {(displayProfile?.displayName ?? displayProfile?.email ?? '?')
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
        )}
        <AppButton
          title="Change photo"
          variant="secondary"
          loading={isUploadingPhoto}
          onPress={() => void handleChangePhoto()}
          testID="change-photo-button"
        />
        {photoError ? (
          <Text
            style={[styles.errorText, { color: colors.danger }]}
            testID="profile-photo-error"
          >
            {photoError}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.lg,
          },
        ]}
      >
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.secondaryText }]}>
            Display Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                borderRadius: radii.control,
              },
            ]}
            value={displayNameInput}
            onChangeText={(text) => {
              setDisplayNameInput(text);
              setNameSaved(false);
            }}
            testID="display-name-input"
            placeholder="Your name"
            placeholderTextColor={colors.secondaryText}
          />
          <AppButton
            title="Save"
            loading={isSavingName}
            onPress={() => void handleSaveDisplayName()}
            testID="save-display-name-button"
          />
          {nameError ? (
            <Text
              style={[styles.errorText, { color: colors.danger }]}
              testID="profile-name-error"
            >
              {nameError}
            </Text>
          ) : null}
          {nameSaved ? (
            <Text
              style={[styles.successText, { color: colors.success }]}
              testID="profile-name-saved"
            >
              Saved.
            </Text>
          ) : null}
        </View>

        <View style={[styles.field, styles.divider, { borderTopColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.secondaryText }]}>Email</Text>
          <Text
            style={[styles.readOnlyValue, { color: colors.text }]}
            testID="profile-email"
          >
            {displayProfile?.email ?? 'Not set'}
          </Text>
          {/* Email/Password is V1's primary sign-in method, and account
              creation sends a verification email (see
              services/firebase/authService.ts's createAccountWithEmail).
              Verification is surfaced here rather than enforced as a gate on
              signing in -- blocking a church member's access on an unread
              email buys nothing, since Firestore rules already scope every
              write to the owning user. Only shown when there is an email
              address at all (a Google-only account has one; there is no
              sensible "verified" state to report without one). */}
          {user?.email ? (
            <>
              <Text
                style={[
                  styles.verificationStatus,
                  { color: user.emailVerified ? colors.success : colors.secondaryText },
                ]}
                testID="profile-email-verified-status"
              >
                {user.emailVerified ? 'Verified' : 'Not verified'}
              </Text>
              {!user.emailVerified ? (
                <>
                  <AppButton
                    title="Resend verification email"
                    variant="secondary"
                    onPress={() => void handleResendVerification()}
                    loading={resendingVerification}
                    disabled={resendingVerification}
                    testID="profile-resend-verification-button"
                  />
                  {verificationNotice ? (
                    <Text
                      style={[styles.successText, { color: colors.success }]}
                      testID="profile-verification-notice"
                    >
                      {verificationNotice}
                    </Text>
                  ) : null}
                  {verificationError ? (
                    <Text
                      style={[styles.errorText, { color: colors.danger }]}
                      testID="profile-verification-error"
                    >
                      {verificationError}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Phone number is optional profile information, never an
            authentication requirement, and V1 has no flow that collects it
            (sign-up asks for name/email/password only -- phone OTP was
            removed from V1 scope). Rendering the field unconditionally
            therefore showed every member a permanent "Not set" row with no
            way to act on it, so it only appears when a value actually
            exists -- e.g. a profile populated by an admin, or a future
            release that collects it. The field itself stays in the data
            model and in firestore.rules' server-controlled allowlist (it is
            NOT owner-writable; see services/firebase/userProfile.ts). */}
        {displayProfile?.phoneNumber ? (
          <View style={[styles.field, styles.divider, { borderTopColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.secondaryText }]}>
              Phone Number
            </Text>
            <Text
              style={[styles.readOnlyValue, { color: colors.text }]}
              testID="profile-phone"
            >
              {displayProfile.phoneNumber}
            </Text>
          </View>
        ) : null}
      </View>

      <AppButton
        title="Settings"
        variant="secondary"
        onPress={() => navigation.navigate('Settings')}
        testID="profile-settings-nav-button"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 20 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  message: { textAlign: 'center' },
  photoSection: { alignItems: 'center', gap: 10 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 16 },
  field: { gap: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  readOnlyValue: { fontSize: 16 },
  errorText: { fontSize: 13 },
  successText: { fontSize: 13 },
  verificationStatus: { fontSize: 13, fontWeight: '600' },
});
