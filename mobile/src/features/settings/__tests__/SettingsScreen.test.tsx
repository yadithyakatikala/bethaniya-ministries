import React from 'react';
import { StyleSheet, Text } from 'react-native';
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
 * The Theme row is itself localized, so the expected text depends on the
 * language the app is in. Building it from the catalogue keeps these
 * assertions about BEHAVIOUR ("the row names the current theme, written
 * in the interface language") rather than pinning one language's wording
 * -- which is what made these tests fail when the UI correctly started
 * rendering Telugu.
 */
const themeRow = (lang: 'en' | 'te', theme: 'dark' | 'light') =>
  `${translate(lang, 'settings.theme')}: ${translate(
    lang,
    theme === 'dark' ? 'settings.themeDark' : 'settings.themeLight'
  )}`;

/** Which option of a segmented choice is currently selected. */
function selectedOption(
  group: { props: { accessibilityState?: { selected?: boolean }; testID?: string } }[]
): string | undefined {
  return group.find((option) => option.props.accessibilityState?.selected)?.props.testID;
}

describe('SettingsScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('defaults to an English interface, a Telugu Bible, Light theme, and notifications on', async () => {
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    expect(
      getByTestId('settings-app-language-en').props.accessibilityState.selected
    ).toBe(true);
    expect(
      getByTestId('settings-bible-language-te').props.accessibilityState.selected
    ).toBe(true);
    expect(getByText(themeRow('en', 'light'))).toBeTruthy();
    expect(getByTestId('settings-theme-switch').props.value).toBe(false);
    expect(getByTestId('settings-notifications-switch').props.value).toBe(true);
  });

  it('names the two language settings distinctly, and says what each does not affect', async () => {
    // "Do not label one setting simply 'Language'": the whole reason this
    // milestone split the row in two is that a shared label is how someone
    // changes the wrong one.
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    expect(getByText(translate('en', 'settings.appLanguage'))).toBeTruthy();
    expect(getByText(translate('en', 'settings.bibleLanguage'))).toBeTruthy();
    expect(translate('en', 'settings.appLanguage')).not.toBe(
      translate('en', 'settings.bibleLanguage')
    );
    // Each carries its own explanation, in both catalogues.
    for (const lang of ['en', 'te'] as const) {
      expect(translate(lang, 'settings.appLanguageHelp')).not.toBe(
        translate(lang, 'settings.bibleLanguageHelp')
      );
    }
    expect(getByText(translate('en', 'settings.appLanguageHelp'))).toBeTruthy();
    expect(getByText(translate('en', 'settings.bibleLanguageHelp'))).toBeTruthy();
  });

  it('offers all three Bible modes, and only two app languages', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-bible-language')).toBeTruthy());

    expect(getByTestId('settings-bible-language-te')).toBeTruthy();
    expect(getByTestId('settings-bible-language-en')).toBeTruthy();
    expect(getByTestId('settings-bible-language-bilingual')).toBeTruthy();
    // There is no bilingual INTERFACE -- the app renders one language.
    expect(queryByTestId('settings-app-language-bilingual')).toBeNull();
  });

  it('changes the app language and persists it, without touching the Bible', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-app-language-te'));

    await waitFor(() =>
      expect(
        getByTestId('settings-app-language-te').props.accessibilityState.selected
      ).toBe(true)
    );
    expect(await AsyncStorage.getItem('app_language_preference')).toBe('te');
    // The Bible selector did not move.
    expect(
      getByTestId('settings-bible-language-te').props.accessibilityState.selected
    ).toBe(true);
    expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('te');
  });

  it('changes the Bible language and persists it, without touching the interface', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-bible-language')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-bible-language-bilingual'));

    await waitFor(() =>
      expect(
        getByTestId('settings-bible-language-bilingual').props.accessibilityState.selected
      ).toBe(true)
    );
    expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('bilingual');
    expect(
      getByTestId('settings-app-language-en').props.accessibilityState.selected
    ).toBe(true);
    expect(await AsyncStorage.getItem('app_language_preference')).toBe('en');
  });

  it('marks exactly one option selected in each group, for TalkBack', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    const appGroup = ['en', 'te'].map((v) => getByTestId(`settings-app-language-${v}`));
    const bibleGroup = ['te', 'en', 'bilingual'].map((v) =>
      getByTestId(`settings-bible-language-${v}`)
    );

    expect(
      appGroup.filter((o) => o.props.accessibilityState.selected)
    ).toHaveLength(1);
    expect(
      bibleGroup.filter((o) => o.props.accessibilityState.selected)
    ).toHaveLength(1);
    expect(selectedOption(appGroup)).toBe('settings-app-language-en');
    expect(selectedOption(bibleGroup)).toBe('settings-bible-language-te');
    // Every option keeps a 44dp target even though there are now five.
    for (const option of [...appGroup, ...bibleGroup]) {
      const flat = StyleSheet.flatten(option.props.style) as { minHeight?: number };
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('localizes its own controls when the interface language is Telugu', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    await waitFor(() =>
      expect(getByText(translate('te', 'settings.appLanguage'))).toBeTruthy()
    );
    expect(getByText(translate('te', 'settings.bibleLanguage'))).toBeTruthy();
    expect(getByText(themeRow('te', 'light'))).toBeTruthy();
  });

  it('toggles the theme and persists it to AsyncStorage', async () => {
    const { getByTestId, getByText } = await renderScreen();
    await waitFor(() => expect(getByText(themeRow('en', 'light'))).toBeTruthy());

    await fireEvent(getByTestId('settings-theme-switch'), 'valueChange', true);

    await waitFor(() => expect(getByText(themeRow('en', 'dark'))).toBeTruthy());
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

  it('syncs an app-language change to Firestore when signed in', async () => {
    mockSignedIn();
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-app-language-te'));

    await waitFor(() =>
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        appLanguage: 'te',
      })
    );
  });

  it('syncs a Bible-language change to Firestore, mirroring V1 field', async () => {
    mockSignedIn();
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-bible-language')).toBeTruthy());

    await fireEvent.press(getByTestId('settings-bible-language-en'));

    await waitFor(() =>
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        bibleMode: 'en',
        languagePreference: 'en',
      })
    );
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
