import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
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
import { usePreferences } from '../../context/PreferencesContext';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  subscribeToOwnProfile,
  updateOwnProfile,
  type UserProfile,
} from '../../services/firebase/userProfile';

/**
 * Profile screen -- Day 9 requirement (decision 7: "display name, email,
 * phone number, profile photo, edit display name, change profile photo,
 * save, loading state, error state, success/save behavior").
 *
 * Field editability exactly matches decision 2 / firestore.rules'
 * isValidUserProfileSelfUpdate(): displayName and photoURL are editable;
 * email and phoneNumber are shown read-only (there is no UI control for
 * them at all, not just a disabled one -- Firebase Auth, not this
 * screen, is the source of truth for those, and changing them is out of
 * Day 9 scope); role/createdAt are never displayed here, since decision
 * 7's requirement list doesn't call for them and they're server-
 * controlled, not user-facing profile fields.
 *
 * A max-5MB image-size check and an image/* type check both happen
 * client-side before upload, purely for a fast/clear error message --
 * the actual enforcement is storage.rules' existing
 * users/{userId}/profile/{fileName} rule (5MB cap, image/* content type,
 * owner-only write), which this screen reuses unchanged (Day 9 decision
 * 5: "Reuse existing Storage path/rules").
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
  const { isDark } = usePreferences();
  const colors = isDark ? darkColors : lightColors;

  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const seededNameRef = useRef(false);

  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

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
    } catch {
      setPhotoError('Could not upload your photo. Please try again.');
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
            style={[styles.photoPlaceholder, { borderColor: colors.border }]}
            testID="profile-photo-placeholder"
          >
            <Text style={{ color: colors.secondaryText }}>No photo</Text>
          </View>
        )}
        {isUploadingPhoto ? (
          <ActivityIndicator testID="profile-photo-uploading" />
        ) : (
          <Button
            title="Change Photo"
            onPress={() => void handleChangePhoto()}
            testID="change-photo-button"
          />
        )}
        {photoError ? (
          <Text style={styles.errorText} testID="profile-photo-error">
            {photoError}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.secondaryText }]}>Display Name</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={displayNameInput}
          onChangeText={(text) => {
            setDisplayNameInput(text);
            setNameSaved(false);
          }}
          testID="display-name-input"
          placeholder="Your name"
          placeholderTextColor={colors.secondaryText}
        />
        {isSavingName ? (
          <ActivityIndicator testID="profile-name-saving" />
        ) : (
          <Button
            title="Save"
            onPress={() => void handleSaveDisplayName()}
            testID="save-display-name-button"
          />
        )}
        {nameError ? (
          <Text style={styles.errorText} testID="profile-name-error">
            {nameError}
          </Text>
        ) : null}
        {nameSaved ? (
          <Text style={styles.successText} testID="profile-name-saved">
            Saved.
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.secondaryText }]}>Email</Text>
        <Text
          style={[styles.readOnlyValue, { color: colors.text }]}
          testID="profile-email"
        >
          {displayProfile?.email ?? 'Not set'}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.secondaryText }]}>Phone Number</Text>
        <Text
          style={[styles.readOnlyValue, { color: colors.text }]}
          testID="profile-phone"
        >
          {displayProfile?.phoneNumber ?? 'Not set'}
        </Text>
      </View>

      <Button
        title="Settings"
        onPress={() => navigation.navigate('Settings')}
        testID="profile-settings-nav-button"
      />
    </ScrollView>
  );
}

const lightColors = {
  background: '#F9FAFB',
  text: '#111827',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
};

const darkColors = {
  background: '#1F2937',
  text: '#F9FAFB',
  secondaryText: '#9CA3AF',
  border: '#374151',
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 20 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  message: { textAlign: 'center' },
  photoSection: { alignItems: 'center', gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  readOnlyValue: { fontSize: 16 },
  errorText: { color: '#DC2626', fontSize: 13 },
  successText: { color: '#16A34A', fontSize: 13 },
});
