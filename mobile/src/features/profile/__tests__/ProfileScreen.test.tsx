import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { getDownloadURL, uploadBytes } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('../../../services/firebase/app');

// ProfileScreen calls useNavigation() to reach "Settings" (Day 9), so it
// needs a real Stack.Navigator around it, the same pattern
// HomeScreen.test.tsx uses for its own nav-button tests.
const Stack = createNativeStackNavigator();

function SettingsStub() {
  return <Text testID="settings-stub">Settings stub</Text>;
}

const TEST_USER = {
  uid: 'user-1',
  displayName: 'Jane Doe',
  email: null,
  phoneNumber: null,
};

function mockSignedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(TEST_USER);
    return jest.fn();
  });
}

/** Signs in with extra/overridden User fields -- used by the email
 * verification tests, since TEST_USER deliberately has no email address
 * (which keeps the verification block absent for every other test). */
function mockSignedInAs(overrides: Record<string, unknown>) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ ...TEST_USER, ...overrides });
    return jest.fn();
  });
}

function mockProfileSnapshot(data: Record<string, unknown> | null) {
  (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
    if (data === null) {
      next({ exists: () => false });
    } else {
      next({ exists: () => true, id: 'user-1', data: () => data });
    }
    return jest.fn();
  });
}

async function renderScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    (global as unknown as { fetch?: jest.Mock }).fetch = jest.fn(() =>
      Promise.resolve({ blob: () => Promise.resolve({ size: 1024 }) })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state before the profile subscription resolves', async () => {
    mockSignedIn();
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await renderScreen();
    expect(getByTestId('profile-loading')).toBeTruthy();
  });

  it('shows an error state when the profile subscription fails', async () => {
    mockSignedIn();
    (onSnapshot as jest.Mock).mockImplementation((_ref, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-load-error')).toBeTruthy());
  });

  it('displays display name, email, phone number, and a photo placeholder', async () => {
    mockSignedIn();
    mockProfileSnapshot({
      role: 'member',
      displayName: 'Jane Doe',
      email: 'jane@example.com',
      phoneNumber: '+15551234567',
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-screen')).toBeTruthy());
    expect(getByTestId('display-name-input').props.value).toBe('Jane Doe');
    expect(getByTestId('profile-email').props.children).toBe('jane@example.com');
    expect(getByTestId('profile-phone-input').props.value).toBe('+15551234567');
    expect(getByTestId('profile-photo-placeholder')).toBeTruthy();
  });

  it('displays the profile photo when photoURL is set', async () => {
    mockSignedIn();
    mockProfileSnapshot({
      role: 'member',
      displayName: 'Jane Doe',
      photoURL: 'https://example.com/p.png',
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-photo')).toBeTruthy());
  });

  it('saves an edited display name', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('display-name-input')).toBeTruthy());

    await fireEvent.changeText(getByTestId('display-name-input'), 'Jane Smith');
    await fireEvent.press(getByTestId('save-display-name-button'));

    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      displayName: 'Jane Smith',
    });
    await waitFor(() => expect(getByTestId('profile-name-saved')).toBeTruthy());
  });

  it('rejects saving an empty display name without calling Firestore', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('display-name-input')).toBeTruthy());

    await fireEvent.changeText(getByTestId('display-name-input'), '   ');
    await fireEvent.press(getByTestId('save-display-name-button'));

    expect(getByTestId('profile-name-error')).toBeTruthy();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('shows an error when saving the display name fails', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('display-name-input')).toBeTruthy());

    await fireEvent.changeText(getByTestId('display-name-input'), 'New Name');
    await fireEvent.press(getByTestId('save-display-name-button'));

    await waitFor(() => expect(getByTestId('profile-name-error')).toBeTruthy());
  });

  it('uploads a new photo and saves its download URL', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          type: 'image',
          mimeType: 'image/jpeg',
          fileSize: 1024,
        },
      ],
    });
    (uploadBytes as jest.Mock).mockResolvedValue(undefined);
    (getDownloadURL as jest.Mock).mockResolvedValue('https://example.com/uploaded.jpg');
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('change-photo-button')).toBeTruthy());

    await fireEvent.press(getByTestId('change-photo-button'));

    expect(uploadBytes).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      photoURL: 'https://example.com/uploaded.jpg',
    });
  });

  it('shows an error and does not upload when photo library permission is denied', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      status: 'denied',
      canAskAgain: true,
      expires: 'never',
    });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('change-photo-button')).toBeTruthy());

    await fireEvent.press(getByTestId('change-photo-button'));

    await waitFor(() => expect(getByTestId('profile-photo-error')).toBeTruthy());
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('does nothing when the image picker is canceled', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: null,
    });

    const { getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('change-photo-button')).toBeTruthy());

    await fireEvent.press(getByTestId('change-photo-button'));

    expect(uploadBytes).not.toHaveBeenCalled();
    expect(queryByTestId('profile-photo-error')).toBeNull();
  });

  it('rejects an oversized image before uploading', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///big.jpg',
          type: 'image',
          mimeType: 'image/jpeg',
          fileSize: 10 * 1024 * 1024,
        },
      ],
    });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('change-photo-button')).toBeTruthy());

    await fireEvent.press(getByTestId('change-photo-button'));

    await waitFor(() => expect(getByTestId('profile-photo-error')).toBeTruthy());
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('navigates to Settings when "Settings" is pressed', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-settings-nav-button')).toBeTruthy());
    await fireEvent.press(getByTestId('profile-settings-nav-button'));
    await waitFor(() => expect(getByTestId('settings-stub')).toBeTruthy());
  });

  it('rejects a non-image file before uploading', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///doc.pdf', type: 'video', mimeType: 'application/pdf' }],
    });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('change-photo-button')).toBeTruthy());

    await fireEvent.press(getByTestId('change-photo-button'));

    await waitFor(() => expect(getByTestId('profile-photo-error')).toBeTruthy());
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  // --- Email verification status (V1 email/password sign-in) -----------

  it('reports an unverified email address and offers to resend', async () => {
    mockSignedInAs({ email: 'member@example.com', emailVerified: false });
    mockProfileSnapshot({ role: 'member', email: 'member@example.com' });

    const { getByTestId } = await renderScreen();

    await waitFor(() =>
      expect(getByTestId('profile-email-verified-status').props.children).toBe(
        'Not verified'
      )
    );
    expect(getByTestId('profile-resend-verification-button')).toBeTruthy();
  });

  it('reports a verified email address and offers no resend action', async () => {
    mockSignedInAs({ email: 'member@example.com', emailVerified: true });
    mockProfileSnapshot({ role: 'member', email: 'member@example.com' });

    const { getByTestId, queryByTestId } = await renderScreen();

    await waitFor(() =>
      expect(getByTestId('profile-email-verified-status').props.children).toBe('Verified')
    );
    expect(queryByTestId('profile-resend-verification-button')).toBeNull();
  });

  it('confirms when the verification email is re-sent', async () => {
    mockSignedInAs({ email: 'member@example.com', emailVerified: false });
    mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
    (sendEmailVerification as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('profile-resend-verification-button')).toBeTruthy()
    );

    await fireEvent.press(getByTestId('profile-resend-verification-button'));

    await waitFor(() =>
      expect(getByTestId('profile-verification-notice').props.children).toBe(
        'Verification email sent. Check your inbox.'
      )
    );
    expect(sendEmailVerification).toHaveBeenCalled();
  });

  it('shows a mapped, non-generic error when resending is rate-limited', async () => {
    mockSignedInAs({ email: 'member@example.com', emailVerified: false });
    mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
    (sendEmailVerification as jest.Mock).mockRejectedValue({
      code: 'auth/too-many-requests',
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { getByTestId } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('profile-resend-verification-button')).toBeTruthy()
    );

    await fireEvent.press(getByTestId('profile-resend-verification-button'));

    await waitFor(() =>
      expect(getByTestId('profile-verification-error').props.children).toBe(
        'Too many attempts. Please wait a moment and try again.'
      )
    );
    warn.mockRestore();
  });

  // --- Phone number: optional profile info, never an auth requirement ---

  // M6 CHANGED THESE TWO. The phone row used to be read-only and hidden
  // unless some other system had filled it in, because V1 collected no
  // number and a permanent unactionable "Not set" was worse than nothing.
  // The onboarding questionnaire now asks for one and the field became
  // owner-writable, so the row is an editable field that is always
  // present -- an empty box a member can fill in is the opposite of an
  // unactionable placeholder. Still no phone authentication anywhere.
  it('offers an empty, editable phone field when the profile has no number', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-email')).toBeTruthy());

    expect(getByTestId('profile-phone-input').props.value).toBe('');
    // Not a "Not set" placeholder -- a field.
    expect(getByTestId('save-profile-details-button')).toBeTruthy();
  });

  it('seeds the phone field and gender from the profile', async () => {
    mockSignedIn();
    mockProfileSnapshot({
      role: 'member',
      displayName: 'Jane Doe',
      phoneNumber: '+15555550123',
      gender: 'female',
    });

    const { getByTestId } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('profile-phone-input').props.value).toBe('+15555550123')
    );
    expect(getByTestId('profile-gender-female').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('saves a changed phone number and gender together, normalized', async () => {
    // The "change these later" half of the onboarding brief.
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-phone-input')).toBeTruthy());

    await fireEvent.changeText(getByTestId('profile-phone-input'), '98765 43210');
    await fireEvent.press(getByTestId('profile-gender-male'));
    await fireEvent.press(getByTestId('save-profile-details-button'));

    await waitFor(() =>
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        phoneNumber: '9876543210',
        gender: 'male',
      })
    );
    await waitFor(() => expect(getByTestId('profile-details-saved')).toBeTruthy());
  });

  it('refuses a phone number that is not one, and says so', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-phone-input')).toBeTruthy());

    await fireEvent.changeText(getByTestId('profile-phone-input'), '123');
    await fireEvent.press(getByTestId('save-profile-details-button'));

    await waitFor(() => expect(getByTestId('profile-details-error')).toBeTruthy());
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('lets a member withdraw a number they gave', async () => {
    mockSignedIn();
    mockProfileSnapshot({
      role: 'member',
      displayName: 'Jane Doe',
      phoneNumber: '9876543210',
    });
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('profile-phone-input').props.value).toBe('9876543210')
    );

    await fireEvent.changeText(getByTestId('profile-phone-input'), '');
    await fireEvent.press(getByTestId('save-profile-details-button'));

    await waitFor(() =>
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ phoneNumber: null })
      )
    );
  });

  it('shows a failed save rather than pretending it worked', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });
    (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));

    const { getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-phone-input')).toBeTruthy());

    await fireEvent.changeText(getByTestId('profile-phone-input'), '9876543210');
    await fireEvent.press(getByTestId('save-profile-details-button'));

    await waitFor(() => expect(getByTestId('profile-details-error')).toBeTruthy());
    expect(queryByTestId('profile-details-saved')).toBeNull();
  });

  it('shows no "Not set" placeholder anywhere for a realistic V1 profile', async () => {
    // A V1 member always has an email address (Email/Password is the
    // primary sign-in method, and a Google account carries one too) and
    // normally no phone number. Phone used to be the one field that
    // rendered a permanent, unactionable "Not set" in exactly this case.
    mockSignedInAs({ email: 'member@example.com', emailVerified: true });
    mockProfileSnapshot({
      role: 'member',
      displayName: 'Jane Doe',
      email: 'member@example.com',
    });

    const { getByTestId, queryByText } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('profile-email').props.children).toBe('member@example.com')
    );
    expect(queryByText('Not set')).toBeNull();
  });

  it('shows no verification status at all for an account with no email address', async () => {
    // TEST_USER has email: null. There is no sensible "verified" state to
    // report without an address.
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });

    const { queryByTestId, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-email')).toBeTruthy());
    expect(queryByTestId('profile-email-verified-status')).toBeNull();
  });

  /**
   * A ScrollView/FlatList defaults to keyboardShouldPersistTaps="never":
   * while a TextInput inside it has focus, the FIRST touch anywhere in the
   * scroll view is consumed dismissing the keyboard and never reaches the
   * control under the finger. Editing the display name and tapping
   * Save therefore did nothing the first time.
   *
   * The native scroll view is what implements that, so there is nothing in
   * the JS test environment to simulate; what this pins is that the screen
   * never silently reverts to the broken default.
   */
  it('keeps taps alive so the first tap on Save applies the edit', async () => {
    mockSignedIn();
    mockProfileSnapshot({ role: 'member', displayName: 'Jane Doe' });

    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('profile-screen')).toBeTruthy());
    expect(getByTestId('profile-screen').props.keyboardShouldPersistTaps).toBe('handled');
  });
});
