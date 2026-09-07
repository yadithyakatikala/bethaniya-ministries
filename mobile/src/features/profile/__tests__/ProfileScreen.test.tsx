import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
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
    expect(getByTestId('profile-phone').props.children).toBe('+15551234567');
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
});
