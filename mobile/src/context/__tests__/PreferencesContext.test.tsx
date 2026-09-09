import React from 'react';
import { Button, Text, View } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { AuthProvider } from '../AuthContext';
import { PreferencesProvider, usePreferences } from '../PreferencesContext';

jest.mock('../../services/firebase/app');
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

function Probe() {
  const prefs = usePreferences();
  return (
    <View>
      <Text testID="language">{prefs.languagePreference}</Text>
      <Text testID="theme">{prefs.themePreference}</Text>
      <Text testID="isDark">{String(prefs.isDark)}</Text>
      <Text testID="notifications">{String(prefs.notificationsEnabled)}</Text>
      <Text testID="isLoaded">{String(prefs.isLoaded)}</Text>
      <Button
        title="set-te"
        testID="set-language-te"
        onPress={() => void prefs.setLanguagePreference('te')}
      />
      <Button
        title="set-dark"
        testID="set-theme-dark"
        onPress={() => void prefs.setThemePreference('dark')}
      />
      <Button
        title="toggle-notifications"
        testID="disable-notifications"
        onPress={() => void prefs.setNotificationsEnabled(false)}
      />
    </View>
  );
}

async function renderProbe() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('PreferencesContext', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('defaults to Telugu, the system color scheme, and notifications on when signed out with nothing stored', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    expect(getByTestId('language').props.children).toBe('te');
    expect(getByTestId('theme').props.children).toBe('light');
    expect(getByTestId('notifications').props.children).toBe('true');
  });

  it('falls back to the system dark color scheme when no theme is stored', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderProbe();
    expect(getByTestId('isDark').props.children).toBe('true');
  });

  it('loads a previously stored local preference before any sign-in', async () => {
    await AsyncStorage.setItem('bible_language_preference', 'te');
    await AsyncStorage.setItem('theme_preference', 'dark');
    await AsyncStorage.setItem('notifications_enabled_preference', 'false');

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('language').props.children).toBe('te'));
    expect(getByTestId('theme').props.children).toBe('dark');
    expect(getByTestId('notifications').props.children).toBe('false');
  });

  it('persists a preference change to AsyncStorage and does not call Firestore while signed out', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await act(async () => {
      await fireEvent.press(getByTestId('set-theme-dark'));
    });

    await waitFor(() => expect(getByTestId('theme').props.children).toBe('dark'));
    expect(await AsyncStorage.getItem('theme_preference')).toBe('dark');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('syncs a preference change to Firestore when signed in', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-1', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => false });
      return jest.fn();
    });

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await act(async () => {
      await fireEvent.press(getByTestId('set-language-te'));
    });

    await waitFor(() => expect(getByTestId('language').props.children).toBe('te'));
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      languagePreference: 'te',
    });
  });

  it('adopts a Firestore-synced preference once a snapshot arrives while signed in', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-2', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        exists: () => true,
        id: 'user-2',
        data: () => ({
          role: 'member',
          themePreference: 'dark',
          languagePreference: 'te',
          notificationsEnabled: false,
        }),
      });
      return jest.fn();
    });

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('theme').props.children).toBe('dark'));
    expect(getByTestId('language').props.children).toBe('te');
    expect(getByTestId('notifications').props.children).toBe('false');
  });

  it('disabling notifications persists locally and syncs when signed in', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext({ uid: 'user-3', displayName: null, email: null, phoneNumber: null });
      return jest.fn();
    });
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => false });
      return jest.fn();
    });

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    await act(async () => {
      await fireEvent.press(getByTestId('disable-notifications'));
    });

    await waitFor(() =>
      expect(getByTestId('notifications').props.children).toBe('false')
    );
    expect(await AsyncStorage.getItem('notifications_enabled_preference')).toBe('false');
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      notificationsEnabled: false,
    });
  });
});
