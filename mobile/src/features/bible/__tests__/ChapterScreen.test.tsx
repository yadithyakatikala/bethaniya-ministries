import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { darkTokens, fontFamilies, lightTokens } from '../../../theme/tokens';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { ChapterScreen } from '../ChapterScreen';
import { setLanguagePreference } from '../languagePreference';
import type { BibleMode } from '../types';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// ChapterScreen reads the BIBLE preference (usePreferences().bibleMode),
// which since M2 is a separate value from the interface language -- so the
// real provider stack is needed, and the reader is seeded through the
// Bible's own key rather than the app language's. seedBibleMode() writes
// the V2 key directly; the migration path from V1's single key has its own
// test at the bottom of this file.
jest.mock('../../../services/firebase/app');

const BIBLE_MODE_KEY = 'bible_mode_preference';
const APP_LANGUAGE_KEY = 'app_language_preference';

async function seedBibleMode(mode: BibleMode) {
  await AsyncStorage.setItem(BIBLE_MODE_KEY, mode);
}

async function renderScreen(bookId: string, chapterNumber: number) {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <ChapterScreen
          navigation={{ navigate, goBack } as never}
          route={
            {
              key: 'BibleChapter',
              name: 'BibleChapter',
              params: { bookId, chapterNumber },
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

describe('ChapterScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('displays the book name, chapter number, and verse content once loaded', async () => {
    await seedBibleMode('en');
    const { getByTestId, getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Genesis 1')).toBeTruthy());
    expect(getByTestId('chapter-reference')).toBeTruthy();
  });

  it('says plainly that Malachi 4 is not in the Telugu translation', async () => {
    // V1 rendered generated placeholder verses here. Nothing is generated
    // now, so the reader reports the absence instead.
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('malachi', 4);
    await waitFor(() => expect(getByTestId('chapter-unavailable-banner')).toBeTruthy());
    expect(getByTestId('chapter-unavailable-message')).toBeTruthy();
  });

  it('does not print the same absence sentence twice', async () => {
    // Caught in visual QA: the header badge and the body message both
    // read "This chapter is not in this translation.", one directly under
    // the other, which reads as a rendering bug. The body now says what
    // the reader can do instead.
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('malachi', 4);
    await waitFor(() => expect(getByTestId('chapter-unavailable-banner')).toBeTruthy());

    const badge = JSON.stringify(getByTestId('chapter-unavailable-banner'));
    const body = getByTestId('chapter-unavailable-message').props.children;
    expect(typeof body).toBe('string');
    expect(badge).not.toContain(body);
  });

  it('shows no unavailable banner for a chapter the translation does have', async () => {
    await seedBibleMode('en');
    const { getByText, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Genesis 1')).toBeTruthy());
    expect(queryByTestId('chapter-unavailable-banner')).toBeNull();
  });

  it('prints a merged Telugu verse range as "39-40" rather than losing a number', async () => {
    await seedBibleMode('te');
    const { getByText } = await renderScreen('luke', 1);
    await waitFor(() => expect(getByText('39-40')).toBeTruthy());
  });

  it('shows real WEB verse text for English', async () => {
    await seedBibleMode('en');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(
        getByText('In the beginning God created the heavens and the earth.')
      ).toBeTruthy()
    );
  });

  it('shows real Telugu IRV 2019 verse text by default (the Bible defaults to Telugu)', async () => {
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy()
    );
  });

  it('restores a previously saved English Bible preference on mount', async () => {
    await seedBibleMode('en');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('English')).toBeTruthy());
    expect(
      getByText('In the beginning God created the heavens and the earth.')
    ).toBeTruthy();
  });

  it('marks Previous as disabled on the first chapter of a book', async () => {
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-reference')).toBeTruthy());
    expect(getByTestId('previous-chapter-button').props.accessibilityState.disabled).toBe(
      true
    );
  });

  it('navigates to the previous chapter when not on the first chapter', async () => {
    const { getByTestId, navigate } = await renderScreen('genesis', 5);
    await waitFor(() => expect(getByTestId('chapter-reference')).toBeTruthy());
    expect(
      getByTestId('previous-chapter-button').props.accessibilityState.disabled
    ).toBeFalsy();

    await fireEvent.press(getByTestId('previous-chapter-button'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 4,
    });
  });

  it('navigates to the next chapter when not on the last chapter', async () => {
    const { getByTestId, navigate } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-reference')).toBeTruthy());
    expect(
      getByTestId('next-chapter-button').props.accessibilityState.disabled
    ).toBeFalsy();

    await fireEvent.press(getByTestId('next-chapter-button'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 2,
    });
  });

  it('marks Next as disabled on the last chapter of a book (Jude, 1 chapter)', async () => {
    const { getByTestId } = await renderScreen('jude', 1);
    await waitFor(() => expect(getByTestId('chapter-reference')).toBeTruthy());
    expect(getByTestId('next-chapter-button').props.accessibilityState.disabled).toBe(
      true
    );
  });

  it('shows a not-found state for an out-of-range chapter', async () => {
    const { getByTestId } = await renderScreen('jude', 5);
    await waitFor(() => expect(getByTestId('chapter-not-found')).toBeTruthy());
  });

  it('shows an invalid-book state for an unknown book id', async () => {
    const { getByTestId } = await renderScreen('not-a-book', 1);
    await waitFor(() => expect(getByTestId('chapter-invalid-book')).toBeTruthy());
  });

  it('renders with light-mode colors by default', async () => {
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-screen')).toBeTruthy());
    const screen = getByTestId('chapter-screen');
    const flatStyle = Object.assign({}, ...[screen.props.contentContainerStyle].flat());
    expect(flatStyle.backgroundColor).toBe(lightTokens.paper);
  });

  it('renders with dark-mode colors when the device is in dark mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-screen')).toBeTruthy());
    const screen = getByTestId('chapter-screen');
    const flatStyle = Object.assign({}, ...[screen.props.contentContainerStyle].flat());
    expect(flatStyle.backgroundColor).toBe(darkTokens.paper);
  });

  it('goes back when the back button is pressed', async () => {
    const { getByTestId, goBack } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-back-button')).toBeTruthy());
    fireEvent.press(getByTestId('chapter-back-button'));
    expect(goBack).toHaveBeenCalled();
  });
});

/**
 * The reader reads the BIBLE preference, and only that.
 *
 * V1 had one value, so "which translation am I reading" and "what language
 * are the buttons in" could not disagree. They can now, and this reader is
 * the screen where getting it wrong would show someone the wrong
 * scripture -- so both directions are pinned here.
 */
describe('which language the reader uses', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('shows Telugu scripture even when the interface is English', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    await seedBibleMode('te');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy()
    );
    // The book name follows the Bible in a single-language mode: the
    // heading belongs to the scripture underneath it.
    expect(getByText('ఆదికాండము 1')).toBeTruthy();
  });

  it('shows English scripture even when the interface is Telugu', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'te');
    await seedBibleMode('en');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(
        getByText('In the beginning God created the heavens and the earth.')
      ).toBeTruthy()
    );
    expect(getByText('Genesis 1')).toBeTruthy();
  });

  it('cycles Telugu -> English -> both, and persists the Bible key only', async () => {
    await seedBibleMode('te');
    const { getByTestId, getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Telugu')).toBeTruthy());

    await fireEvent.press(getByTestId('language-toggle-button'));
    await waitFor(() => expect(getByText('English')).toBeTruthy());
    expect(await AsyncStorage.getItem(BIBLE_MODE_KEY)).toBe('en');

    await fireEvent.press(getByTestId('language-toggle-button'));
    await waitFor(() => expect(getByText('English + Telugu')).toBeTruthy());
    expect(await AsyncStorage.getItem(BIBLE_MODE_KEY)).toBe('bilingual');

    // The interface language was never written by the Bible control.
    expect(await AsyncStorage.getItem(APP_LANGUAGE_KEY)).toBe('en');
  });

  it('migrates a V1 install: the stored Bible choice still reaches the reader', async () => {
    // A member upgrading from V1 has only the old key. Their Telugu Bible
    // must still be their Telugu Bible, and the interface must still come
    // up in English -- see ../../context/languagePreferences.ts.
    await setLanguagePreference('te');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy()
    );
    // 'Telugu' rather than 'తెలుగు': the pill is chrome, so it is written
    // in the interface language, which migration left at English.
    expect(getByText('Telugu')).toBeTruthy();
  });
});

/**
 * Bilingual mode, end to end through the M1 alignment policy.
 *
 * Each of the three presentations the policy can return has a real
 * chapter behind it here, rather than a fixture: the policy's own unit
 * tests (./alignment.test.ts) prove the rules, and these prove the reader
 * renders each outcome instead of silently showing one language.
 */
describe('bilingual mode', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('pairs both translations verse by verse for an aligned chapter', async () => {
    await seedBibleMode('bilingual');
    const { getByTestId, getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('bilingual-paired')).toBeTruthy());

    expect(
      getByText('In the beginning God created the heavens and the earth.')
    ).toBeTruthy();
    expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy();
  });

  it('labels a merged Telugu range with the English verses it covers', async () => {
    // Luke 1:39-40 is one translated unit in the Telugu IRV. Pairing it
    // against English verse 39 alone would attach the wrong text.
    await seedBibleMode('bilingual');
    const { getByTestId, getByText } = await renderScreen('luke', 1);
    await waitFor(() => expect(getByTestId('bilingual-paired')).toBeTruthy());
    expect(getByText('39-40')).toBeTruthy();
  });

  it('refuses to pair a chapter the two traditions divide differently', async () => {
    // Genesis 31 is one of the 41 divergent chapters (Hebrew vs English
    // chapter division). The policy shows the sides separately with a
    // notice rather than putting mismatched verses in one row.
    await seedBibleMode('bilingual');
    const { getByTestId, queryByTestId } = await renderScreen('genesis', 31);
    await waitFor(() => expect(getByTestId('bilingual-chapter-level')).toBeTruthy());
    expect(queryByTestId('bilingual-paired')).toBeNull();
  });

  it('shows English alone, flagged, for the one chapter Telugu lacks', async () => {
    await seedBibleMode('bilingual');
    const { getByTestId, queryByTestId } = await renderScreen('malachi', 4);
    await waitFor(() => expect(getByTestId('bilingual-english-only')).toBeTruthy());
    // Nothing invented, and no duplicate notice in the header.
    expect(queryByTestId('bilingual-paired')).toBeNull();
    expect(queryByTestId('chapter-unavailable-banner')).toBeNull();
  });

  it('sets a Telugu book name in a face that HAS Telugu, whatever the interface is', async () => {
    // Caught in M3 visual QA. The heading is a book name, so it must take
    // its type from the book name's language -- with an English interface
    // over the Telugu Bible, the interface type scale resolves to Noto
    // Serif, which has no Telugu glyphs, and the heading fell to a
    // per-glyph platform fallback and rendered as broken clusters.
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('1-chronicles', 1);
    await waitFor(() => expect(getByTestId('chapter-reference')).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId('chapter-reference').props.style) as {
      fontFamily?: string;
    };
    expect(style.fontFamily).toBe(fontFamilies.interfaceSemiBold);
    expect(style.fontFamily).not.toBe(fontFamilies.serifEnSemiBold);
  });

  it('sets an English book name in the English serif', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('1-chronicles', 1);
    await waitFor(() => expect(getByTestId('chapter-reference')).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId('chapter-reference').props.style) as {
      fontFamily?: string;
    };
    expect(style.fontFamily).toBe(fontFamilies.serifEnSemiBold);
  });

  it('writes book names in the interface language, since the verses carry both', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'te');
    await seedBibleMode('bilingual');
    const { getByText, getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('bilingual-paired')).toBeTruthy());
    expect(getByText('ఆదికాండము 1')).toBeTruthy();
  });
});
