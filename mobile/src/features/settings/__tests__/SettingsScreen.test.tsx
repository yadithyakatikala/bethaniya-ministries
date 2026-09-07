import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SettingsScreen } from '../SettingsScreen';

jest.mock('../../../services/firebase/app');

function mockSignedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'user-1', displayName: null, email: null, phoneNumber: null });
    return jest.fn();
  });
  (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
    next({ exists: () => false });
    return jest.fn();
  });
}

async function renderScreen() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <SettingsScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('SettingsScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('defaults to English, Light theme, and notifications on', async () => {
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Language: English')).toBeTruthy());
    expect(getByText('Theme: Light')).toBeTruthy();
    expect(getByTestId('settings-theme-switch').props.value).toBe(false);
    expect(getByTestId('settings-notifications-switch').props.value).toBe(true);
  });

  it('toggles the language and persists it to AsyncStorage', async () => {
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Language: English')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-language-toggle'));

    await waitFor(() => expect(getByText('Language: Telugu')).toBeTruthy());
    expect(await AsyncStorage.getItem('bible_language_preference')).toBe('te');
  });

  it('toggles the theme and persists it to AsyncStorage', async () => {
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Theme: Light')).toBeTruthy());

    await fireEvent(getByTestId('settings-theme-switch'), 'valueChange', true);

    await waitFor(() => expect(getByText('Theme: Dark')).toBeTruthy());
    expect(await AsyncStorage.getItem('theme_preference')).toBe('dark');
  });

  it('toggles notifications and persists it to AsyncStorage', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() =>
      expect(getByTestId('settings-notifications-switch').props.value).toBe(true)
    );

    await fireEvent(getByTestId('settings-notifications-switch'), 'valueChange', false);

    await waitFor(() =>
      expect(getByTestId('settings-notifications-switch').props.value).toBe(false)
    );
    expect(await AsyncStorage.getItem('notifications_enabled_preference')).toBe('false');
  });

  it('syncs a preference change to Firestore when signed in', async () => {
    mockSignedIn();
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Language: English')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-language-toggle'));

    await waitFor(() => expect(getByText('Language: Telugu')).toBeTruthy());
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      languagePreference: 'te',
    });
  });

  it('signs the user out when Log Out is pressed', async () => {
    (signOut as jest.Mock).mockResolvedValue(undefined);
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-logout-button')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-logout-button'));

    expect(signOut).toHaveBeenCalled();
  });
});
