import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, waitFor, fireEvent, within } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SettingsScreen } from '../SettingsScreen';
import { TRANSLATION_NAMES } from '../../bible/translationCredits';
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

function CreditsStub() {
  return <Text testID="credits-stub">Credits stub</Text>;
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
            <Stack.Screen name="BibleTranslations" component={CreditsStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

/**
 * The language rows are VALUE rows that open a sheet of choices (the approved
 * design); the theme is a three-part pill; the switch is a row of its own.
 * The assertions are about BEHAVIOUR -- what is persisted, what is synced,
 * what each row says it does not change -- and take their wording from the
 * catalogue, so they do not break when a sentence is polished.
 */

/** A pattern for text that merely CONTAINS `text` (a row's content is its title and its subtitle). */
function containing(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/** Opens a sheet by its row and returns the option testIDs it shows. */
async function openSheet(utils: Awaited<ReturnType<typeof renderScreen>>, row: string) {
  await waitFor(() => expect(utils.getByTestId(row)).toBeTruthy());
  await fireEvent.press(utils.getByTestId(row));
}

describe('SettingsScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('defaults to an English interface, a Telugu Bible, System theme, and notifications on', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    // Each row says its current value.
    expect(getByTestId('settings-app-language')).toHaveTextContent(/English/);
    expect(getByTestId('settings-bible-language')).toHaveTextContent(/Telugu/);
    // 'system' until the member chooses otherwise.
    expect(getByTestId('settings-theme-system').props.accessibilityState.selected).toBe(
      true
    );
    expect(getByTestId('settings-notifications-switch').props.value).toBe(true);
  });

  it('has a top bar named Settings whose Back leaves the screen', async () => {
    const { getAllByText, getByRole } = await renderScreen();
    await waitFor(() => expect(getAllByText('Settings').length).toBeGreaterThan(0));
    expect(getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('names the two language settings distinctly, and says what each does not affect', async () => {
    // "Do not label one setting simply 'Language'": the whole reason these are
    // two rows is that a shared label is how someone changes the wrong one.
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    expect(getByText(translate('en', 'settings.appLanguage'))).toBeTruthy();
    expect(getByText(translate('en', 'settings.bibleLanguage'))).toBeTruthy();
    expect(translate('en', 'settings.appLanguage')).not.toBe(
      translate('en', 'settings.bibleLanguage')
    );
    // Each carries its own explanation, in both catalogues, and the row shows
    // all of it -- the sentence is the guarantee, so it is never cut short.
    for (const lang of ['en', 'te'] as const) {
      expect(translate(lang, 'settings.appLanguageHelp')).not.toBe(
        translate(lang, 'settings.bibleLanguageHelp')
      );
    }
    const help = getByText(translate('en', 'settings.bibleLanguageHelp'));
    expect(help.props.numberOfLines).toBeGreaterThanOrEqual(3);
  });

  describe('the choice sheets', () => {
    it('offers all three Bible modes, and only two app languages', async () => {
      const bible = await renderScreen();
      await openSheet(bible, 'settings-bible-language');
      for (const mode of ['te', 'en', 'bilingual']) {
        expect(bible.getByTestId(`settings-bible-language-${mode}`)).toBeTruthy();
      }
      await bible.unmount();

      const app = await renderScreen();
      await openSheet(app, 'settings-app-language');
      expect(app.getByTestId('settings-app-language-en')).toBeTruthy();
      expect(app.getByTestId('settings-app-language-te')).toBeTruthy();
      // There is no bilingual INTERFACE -- the app renders one language.
      expect(app.queryByTestId('settings-app-language-bilingual')).toBeNull();
    });

    it('repeats what the setting does not change, under its title', async () => {
      const utils = await renderScreen();
      await openSheet(utils, 'settings-app-language');
      // The sheet covers the screen, so what is found is the sheet's own sentence.
      expect(
        within(utils.getByTestId('settings-app-language-sheet')).getByText(
          translate('en', 'settings.appLanguageHelp')
        )
      ).toBeTruthy();
    });

    it('ticks the current choice, in words as well as the tick, and marks exactly one checked', async () => {
      const utils = await renderScreen();
      await openSheet(utils, 'settings-bible-language');
      const options = ['te', 'en', 'bilingual'].map((v) =>
        utils.getByTestId(`settings-bible-language-${v}`)
      );
      expect(options.filter((o) => o.props.accessibilityState.checked)).toHaveLength(1);
      expect(options[0].props.accessibilityState.checked).toBe(true);
      // The chosen one is also set bolder.
      const weight = (o: (typeof options)[number], label: string) =>
        (
          StyleSheet.flatten(within(o).getByText(label).props.style) as {
            fontWeight?: string;
          }
        ).fontWeight;
      expect(weight(options[0], translate('en', 'bible.modeTelugu'))).toBe('600');
      expect(weight(options[1], translate('en', 'bible.modeEnglish'))).not.toBe('600');
      // Every option keeps a 44dp target.
      for (const option of options) {
        const flat = StyleSheet.flatten(option.props.style) as { minHeight?: number };
        expect(flat.minHeight).toBeGreaterThanOrEqual(44);
      }
    });

    it('changes the app language, persists it and closes the sheet, without touching the Bible', async () => {
      const utils = await renderScreen();
      await openSheet(utils, 'settings-app-language');

      await fireEvent.press(utils.getByTestId('settings-app-language-te'));

      await waitFor(async () =>
        expect(await AsyncStorage.getItem('app_language_preference')).toBe('te')
      );
      expect(utils.queryByTestId('settings-app-language-te')).toBeNull();
      // The Bible did not move.
      expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('te');
    });

    it('changes the Bible language, persists it and closes the sheet, without touching the interface', async () => {
      const utils = await renderScreen();
      await openSheet(utils, 'settings-bible-language');

      await fireEvent.press(utils.getByTestId('settings-bible-language-bilingual'));

      await waitFor(async () =>
        expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('bilingual')
      );
      expect(utils.queryByTestId('settings-bible-language-bilingual')).toBeNull();
      expect(await AsyncStorage.getItem('app_language_preference')).not.toBe('te');
      // The row now says the new value.
      await waitFor(() =>
        expect(utils.getByTestId('settings-bible-language')).toHaveTextContent(
          /English \+ Telugu/
        )
      );
    });

    it('closes without changing anything when its Close is pressed', async () => {
      const utils = await renderScreen();
      await openSheet(utils, 'settings-app-language');
      await fireEvent.press(utils.getByTestId('settings-app-language-sheet-backdrop'));
      expect(utils.queryByTestId('settings-app-language-en')).toBeNull();
      // Still English: closing is not choosing.
      expect(await AsyncStorage.getItem('app_language_preference')).not.toBe('te');
      expect(utils.getByTestId('settings-app-language')).toHaveTextContent(/English/);
    });

    it('syncs an app-language change to Firestore when signed in', async () => {
      mockSignedIn();
      const utils = await renderScreen();
      await openSheet(utils, 'settings-app-language');
      await fireEvent.press(utils.getByTestId('settings-app-language-te'));
      await waitFor(() =>
        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { appLanguage: 'te' })
      );
    });

    it('syncs a Bible-language change to Firestore, mirroring V1 field', async () => {
      mockSignedIn();
      const utils = await renderScreen();
      await openSheet(utils, 'settings-bible-language');
      await fireEvent.press(utils.getByTestId('settings-bible-language-en'));
      await waitFor(() =>
        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
          bibleMode: 'en',
          languagePreference: 'en',
        })
      );
    });
  });

  it('localizes its own controls when the interface language is Telugu', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-app-language')).toBeTruthy());

    await waitFor(() =>
      expect(getByText(translate('te', 'settings.appLanguage'))).toBeTruthy()
    );
    expect(getByText(translate('te', 'settings.bibleLanguage'))).toBeTruthy();
    expect(getByText(translate('te', 'settings.theme'))).toBeTruthy();
    expect(getByText(translate('te', 'settings.themeSystem'))).toBeTruthy();
  });

  it('offers Light, Dark and System, and persists the choice to AsyncStorage', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('settings-theme')).toBeTruthy());
    for (const option of ['light', 'dark', 'system']) {
      expect(getByTestId(`settings-theme-${option}`)).toBeTruthy();
    }

    await fireEvent.press(getByTestId('settings-theme-dark'));

    await waitFor(() =>
      expect(getByTestId('settings-theme-dark').props.accessibilityState.selected).toBe(
        true
      )
    );
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

  it('says so when a change saved locally but could not reach the account', async () => {
    // M6 BUG 1 + BUG 2. The denial that caused both was invisible: the
    // context swallowed the rejected write and a rollback snapshot moved
    // the control back, so the app looked like it had forgotten the
    // setting. The choice now stands and the failure is stated.
    mockSignedIn();
    (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    const utils = await renderScreen();
    await waitFor(() =>
      expect(utils.getByTestId('settings-bible-language')).toBeTruthy()
    );
    expect(utils.queryByTestId('settings-sync-failed')).toBeNull();

    await openSheet(utils, 'settings-bible-language');
    await fireEvent.press(utils.getByTestId('settings-bible-language-en'));

    await waitFor(() => expect(utils.getByTestId('settings-sync-failed')).toBeTruthy());
    expect(utils.getByTestId('settings-sync-failed').props.accessibilityLiveRegion).toBe(
      'polite'
    );
    expect(utils.getByText(translate('en', 'settings.syncFailed'))).toBeTruthy();
    // The member's choice stands -- it is stored on this device.
    expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('en');
    expect(utils.getByTestId('settings-bible-language')).toHaveTextContent(/English/);
  });

  describe('About', () => {
    it('shows the church’s support address, or says it is not set, never an invented one', async () => {
      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        next({
          exists: () => true,
          data: () => ({ supportEmail: 'office@church.example' }),
        });
        return jest.fn();
      });
      const withAddress = await renderScreen();
      await waitFor(() =>
        expect(withAddress.getByTestId('settings-support-row')).toHaveTextContent(
          /office@church\.example/
        )
      );
      await withAddress.unmount();

      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        next({ exists: () => true, data: () => ({}) });
        return jest.fn();
      });
      const without = await renderScreen();
      await waitFor(() =>
        expect(without.getByTestId('settings-support-row')).toHaveTextContent(
          containing(translate('en', 'settings.notSetYet'))
        )
      );
    });

    it('names the two Bibles on the Bible translations row, and opens their credits', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() =>
        expect(getByTestId('settings-bible-translations-row')).toBeTruthy()
      );
      const row = getByTestId('settings-bible-translations-row');
      expect(row).toHaveTextContent(containing(TRANSLATION_NAMES.en));
      expect(row).toHaveTextContent(containing(TRANSLATION_NAMES.te));

      await fireEvent.press(row);
      await waitFor(() => expect(getByTestId('credits-stub')).toBeTruthy());
    });

    it('navigates to the Privacy Policy screen when "Privacy policy" is pressed', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() =>
        expect(getByTestId('settings-privacy-policy-row')).toBeTruthy()
      );
      await fireEvent.press(getByTestId('settings-privacy-policy-row'));
      await waitFor(() => expect(getByTestId('privacy-policy-stub')).toBeTruthy());
    });

    it('navigates to the Terms screen when "Terms of service" is pressed', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('settings-terms-row')).toBeTruthy());
      await fireEvent.press(getByTestId('settings-terms-row'));
      await waitFor(() => expect(getByTestId('terms-stub')).toBeTruthy());
    });
  });

  describe('Log Out', () => {
    it('asks first, and signs nobody out if the member cancels', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId, getByText, queryByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('settings-logout-button')).toBeTruthy());

      await fireEvent.press(getByTestId('settings-logout-button'));
      expect(getByText(translate('en', 'settings.logOutConfirmTitle'))).toBeTruthy();
      expect(getByText(translate('en', 'settings.logOutConfirmMessage'))).toBeTruthy();
      expect(signOut).not.toHaveBeenCalled();

      await fireEvent.press(getByText(translate('en', 'common.cancel')));
      expect(signOut).not.toHaveBeenCalled();
      expect(queryByText(translate('en', 'settings.logOutConfirmTitle'))).toBeNull();
    });

    it('signs the member out once they confirm', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('settings-logout-button')).toBeTruthy());

      await fireEvent.press(getByTestId('settings-logout-button'));
      await fireEvent.press(getByTestId('settings-logout-dialog-confirm'));

      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});
