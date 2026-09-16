import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SettingsScreen } from '../SettingsScreen';
import { translate } from '../../../i18n';

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

// SettingsScreen navigates to "PrivacyPolicy"/"Terms" (see
// ../../legal/LegalScreen.tsx) -- useNavigation() needs a real Navigator in
// the tree, same pattern as ../../auth/__tests__/HomeScreen.test.tsx.
const Stack = createNativeStackNavigator();

function PrivacyPolicyStub() {
  return <Text testID="privacy-policy-stub">Privacy policy stub</Text>;
}

function TermsStub() {
  return <Text testID="terms-stub">Terms stub</Text>;
}

async function renderScreen() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyStub} />
            <Stack.Screen name="Terms" component={TermsStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

/**
 * The Language/Theme rows are themselves localized now, so the expected
 * text depends on the language the app is in. Building it from the
 * catalogue keeps these assertions about BEHAVIOUR ("the row names the
 * current language, written in that language") rather than pinning one
 * language's wording -- which is what made these tests fail when the UI
 * correctly started rendering Telugu.
 */
const languageRow = (lang: 'en' | 'te') =>
  `${translate(lang, 'settings.language')}: ${translate(
    lang,
    lang === 'te' ? 'settings.languageTelugu' : 'settings.languageEnglish'
  )}`;

const themeRow = (lang: 'en' | 'te', theme: 'dark' | 'light') =>
  `${translate(lang, 'settings.theme')}: ${translate(
    lang,
    theme === 'dark' ? 'settings.themeDark' : 'settings.themeLight'
  )}`;

describe('SettingsScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('defaults to Telugu, Light theme, and notifications on', async () => {
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText(languageRow('te'))).toBeTruthy());
    expect(getByText(themeRow('te', 'light'))).toBeTruthy();
    expect(getByTestId('settings-theme-switch').props.value).toBe(false);
    expect(getByTestId('settings-notifications-switch').props.value).toBe(true);
  });

  it('toggles the language and persists it to AsyncStorage', async () => {
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByText(languageRow('te'))).toBeTruthy());

    await fireEvent.press(getByTestId('settings-language-toggle'));

    await waitFor(() => expect(getByText(languageRow('en'))).toBeTruthy());
    expect(await AsyncStorage.getItem('bible_language_preference')).toBe('en');
  });

  it('toggles the theme and persists it to AsyncStorage', async () => {
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByText(themeRow('te', 'light'))).toBeTruthy());

    await fireEvent(getByTestId('settings-theme-switch'), 'valueChange', true);

    await waitFor(() => expect(getByText(themeRow('te', 'dark'))).toBeTruthy());
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
    await waitFor(() => expect(getByText(languageRow('te'))).toBeTruthy());

    await fireEvent.press(getByTestId('settings-language-toggle'));

    await waitFor(() => expect(getByText(languageRow('en'))).toBeTruthy());
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      languagePreference: 'en',
    });
  });

  it('shows the required CC BY-SA 4.0 Telugu Bible attribution', async () => {
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-bible-attribution')).toBeTruthy());
    expect(getByText(/Bridge Connectivity Solutions/)).toBeTruthy();
    expect(getByText(/CC BY-SA 4.0/)).toBeTruthy();
  });

  it('navigates to the Privacy Policy screen when "Privacy policy" is pressed', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-privacy-policy-row')).toBeTruthy());
    await fireEvent.press(getByTestId('settings-privacy-policy-row'));
    await waitFor(() => expect(getByTestId('privacy-policy-stub')).toBeTruthy());
  });

  it('navigates to the Terms screen when "Terms of service" is pressed', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-terms-row')).toBeTruthy());
    await fireEvent.press(getByTestId('settings-terms-row'));
    await waitFor(() => expect(getByTestId('terms-stub')).toBeTruthy());
  });

  it('signs the user out when Log Out is pressed', async () => {
    (signOut as jest.Mock).mockResolvedValue(undefined);
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-logout-button')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-logout-button'));

    expect(signOut).toHaveBeenCalled();
  });
});
