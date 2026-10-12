import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { BibleTranslationsScreen } from '../BibleTranslationsScreen';
import {
  CC_BY_SA_URL,
  TRANSLATION_ATTRIBUTION,
  TRANSLATION_NAMES,
} from '../../bible/translationCredits';

jest.mock('../../../services/firebase/app');

const containing = (text: string) =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

async function renderScreen() {
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <BibleTranslationsScreen
          navigation={{ goBack } as never}
          route={{ key: 'BibleTranslations', name: 'BibleTranslations' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, goBack };
}

describe('BibleTranslationsScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('has a top bar named for it whose Back leaves the screen', async () => {
    const { getByText, getByRole, goBack } = await renderScreen();
    expect(getByText('Bible translations')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('says the Bibles are stored on the phone', async () => {
    const { getByText } = await renderScreen();
    expect(getByText(/stored on your phone/)).toBeTruthy();
  });

  it('shows the required CC BY-SA 4.0 Telugu Bible attribution', async () => {
    // The Telugu text is licensed CC BY-SA 4.0, which conditions redistribution
    // on attribution to the copyright holder. This screen is the app's only
    // place for it (the share payload no longer carries it), so it must say it.
    const { getByTestId } = await renderScreen();
    expect(getByTestId('credits-te')).toHaveTextContent(/Bridge Connectivity Solutions/);
    expect(getByTestId('credits-te')).toHaveTextContent(/CC BY-SA 4\.0/);
  });

  it('reads the names, the holder and the licence address from the constants the app uses elsewhere', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('credits-en')).toHaveTextContent(containing(TRANSLATION_NAMES.en));
    expect(getByTestId('credits-te')).toHaveTextContent(containing(TRANSLATION_NAMES.te));
    expect(getByTestId('credits-te-url')).toHaveTextContent(containing(CC_BY_SA_URL));
    const holder = (TRANSLATION_ATTRIBUTION.te as string).replace(
      /,\s*CC BY-SA 4\.0\s*$/,
      ''
    );
    expect(getByTestId('credits-te-holder')).toHaveTextContent(containing(holder));
    expect(holder).toMatch(/^©/);
  });

  it('says the English Bible is in the public domain', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('credits-en')).toHaveTextContent(/Public domain/);
  });

  it('opens the licence when Read the licence is pressed', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByTestId } = await renderScreen();
    await fireEvent.press(getByTestId('credits-read-licence'));
    expect(open).toHaveBeenCalledWith(CC_BY_SA_URL);
  });
});
