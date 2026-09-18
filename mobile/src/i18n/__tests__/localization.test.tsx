import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import { CATALOGUES, translate, useTranslation, type StringKey } from '..';
import { BIBLE_BOOKS, getBookById, getBookName } from '../../features/bible/books';
import { getChapter } from '../../features/bible/dataSource';
import { searchBible } from '../../features/bible/search';
import { SettingsScreen } from '../../features/settings/SettingsScreen';

jest.mock('../../services/firebase/app');

/**
 * Telugu localization, end to end.
 *
 * THE TESTER'S REPORT. "Switching the app language to Telugu does not
 * change the UI" and "the Telugu Bible does not become the default".
 * Both were real, with two different causes:
 *
 *   1. There was NO localization layer. `languagePreference` ('en'|'te')
 *      only ever chose which Bible verse dataset to read; every screen's
 *      own text was a hardcoded English literal. See ../strings.ts.
 *
 *   2. The Telugu VERSE TEXT was correct all along, but the Bible tab's
 *      landing screen read `book.name` (English) directly, so the Bible
 *      looked English. See ../../features/bible/books.ts's getBookName().
 *
 * WHAT CHANGED IN V2. Those fixes both hung off ONE preference, which is
 * how the interface language and the Bible translation ended up welded
 * together -- and the congregation's actual requirement is an English
 * interface over a Telugu Bible. There are now two preferences (see
 * ../../context/languagePreferences.ts), so these tests assert the
 * opposite of what they used to on exactly one point: the UI language
 * follows `appLanguage` and is NOT moved by the Bible's setting.
 *
 * The rest of the contract is unchanged: the catalogues agree on their
 * keys, switching the preference re-renders WITHOUT a reload, the choice
 * persists, and every Bible surface follows the Bible's own preference.
 */
const APP_LANGUAGE_KEY = 'app_language_preference';
const BIBLE_MODE_KEY = 'bible_mode_preference';

function mockSignedOut() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(null);
    return jest.fn();
  });
}

describe('the catalogues', () => {
  it('define exactly the same keys in English and Telugu', () => {
    const en = Object.keys(CATALOGUES.en).sort();
    const te = Object.keys(CATALOGUES.te).sort();
    expect(te).toEqual(en);
  });

  it('has a non-empty, trimmed string for every key in both languages', () => {
    for (const [language, catalogue] of Object.entries(CATALOGUES)) {
      for (const [key, value] of Object.entries(catalogue)) {
        expect(`${language}.${key}: ${value}`).toBe(
          `${language}.${key}: ${value.trim()}`
        );
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('actually differs between the two languages', () => {
    // A catalogue that merely copied English would satisfy the key check
    // above while leaving the tester's bug in place. Most Telugu strings
    // must genuinely differ; the few that legitimately match are proper
    // nouns and addresses (e.g. 'you@example.com').
    const keys = Object.keys(CATALOGUES.en) as StringKey[];
    const identical = keys.filter((key) => CATALOGUES.en[key] === CATALOGUES.te[key]);
    expect(identical.length).toBeLessThan(keys.length * 0.1);
  });

  it('keeps placeholder names identical across languages', () => {
    // A Telugu string that renamed {current} would silently render the
    // literal brace text to the user.
    const keys = Object.keys(CATALOGUES.en) as StringKey[];
    for (const key of keys) {
      const names = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort().join(',');
      expect(`${key}: ${names(CATALOGUES.te[key])}`).toBe(
        `${key}: ${names(CATALOGUES.en[key])}`
      );
    }
  });

  it('substitutes placeholders, and leaves unknown ones alone', () => {
    expect(translate('en', 'home.dayOf', { current: 3, total: 7 })).toBe('Day 3 of 7');
    expect(translate('en', 'home.dayOf', { current: 3 })).toContain('{total}');
  });
});

/** A probe that renders one key plus the language, so a re-render is visible. */
function Probe({ stringKey }: { stringKey: StringKey }) {
  const { t, appLanguage } = useTranslation();
  return (
    <>
      <Text testID="probe-text">{t(stringKey)}</Text>
      <Text testID="probe-language">{appLanguage}</Text>
    </>
  );
}

function renderProbe(stringKey: StringKey = 'nav.home') {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <Probe stringKey={stringKey} />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('useTranslation', () => {
  beforeEach(() => {
    mockSignedOut();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('renders English by default, since the interface defaults to English', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.en['nav.home']);
  });

  it('renders Telugu when Telugu has been stored', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'te');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('te'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.te['nav.home']);
  });

  it('follows the APP language, not the Bible language', async () => {
    // The architectural point of the milestone, inverted from V1: a member
    // reading the Telugu Bible keeps an English interface unless they ask
    // for a Telugu one. If these two were ever re-welded, this fails.
    await AsyncStorage.setItem(BIBLE_MODE_KEY, 'te');
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.en['nav.home']);
  });

  it('is unaffected by a bilingual Bible setting', async () => {
    await AsyncStorage.setItem(BIBLE_MODE_KEY, 'bilingual');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
  });

  it('renders a Telugu interface over an English Bible -- the other combination', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'te');
    await AsyncStorage.setItem(BIBLE_MODE_KEY, 'en');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('te'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.te['nav.home']);
  });
});

/** Renders a switchable probe so a language change can be driven in-test. */
function SwitchableProbe() {
  const { t, appLanguage } = useTranslation();
  return (
    <>
      <Text testID="probe-text">{t('nav.home')}</Text>
      <Text testID="probe-language">{appLanguage}</Text>
    </>
  );
}

describe('switching the language', () => {
  beforeEach(() => {
    mockSignedOut();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('re-renders immediately, with no reload, and persists the choice', async () => {
    // Driven through the real Settings control rather than a stub, because
    // "the preference changed but the UI did not" is exactly the bug.
    const { getByTestId } = await render(
      <AuthProvider>
        <PreferencesProvider>
          <NavigationContainer>
            <SwitchableProbe />
            <SettingsScreen />
          </NavigationContainer>
        </PreferencesProvider>
      </AuthProvider>
    );

    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.en['nav.home']);

    await fireEvent.press(getByTestId('settings-app-language-te'));

    // The sibling component re-rendered in Telugu without remounting.
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('te'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.te['nav.home']);

    // ...and the choice survives a restart.
    expect(await AsyncStorage.getItem(APP_LANGUAGE_KEY)).toBe('te');
  });

  it('does not change the interface when only the Bible language is switched', async () => {
    // The user-facing half of the independence requirement, driven through
    // the two real Settings controls that sit next to each other -- which
    // is exactly where a re-coupling would show up.
    const { getByTestId } = await render(
      <AuthProvider>
        <PreferencesProvider>
          <NavigationContainer>
            <SwitchableProbe />
            <SettingsScreen />
          </NavigationContainer>
        </PreferencesProvider>
      </AuthProvider>
    );

    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));

    await fireEvent.press(getByTestId('settings-bible-language-en'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(BIBLE_MODE_KEY)).toBe('en')
    );
    expect(getByTestId('probe-language').props.children).toBe('en');

    await fireEvent.press(getByTestId('settings-bible-language-bilingual'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(BIBLE_MODE_KEY)).toBe('bilingual')
    );
    expect(getByTestId('probe-language').props.children).toBe('en');
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.en['nav.home']);
  });
});

describe('the Bible follows its own preference', () => {
  it('gives every book a Telugu name', () => {
    for (const book of BIBLE_BOOKS) {
      expect(getBookName(book, 'te')).toBe(book.nameTe);
      expect(getBookName(book, 'en')).toBe(book.name);
    }
  });

  it('returns Telugu verse text for Telugu and English for English', () => {
    const teluguChapter = getChapter('genesis', 1, 'te');
    const englishChapter = getChapter('genesis', 1, 'en');

    expect(teluguChapter?.verses[0].text).not.toBe(englishChapter?.verses[0].text);
    // Telugu script occupies U+0C00-U+0C7F.
    expect(teluguChapter?.verses[0].text).toMatch(/[ఀ-౿]/);
    expect(englishChapter?.verses[0].text).not.toMatch(/[ఀ-౿]/);
  });

  it('searches the Telugu dataset when Telugu is selected', () => {
    // 'దేవుడు' (God) appears throughout the Telugu text and nowhere in the
    // English text, so a hit proves which dataset was searched.
    const teluguHits = searchBible('దేవుడు', 'te');
    expect(teluguHits.length).toBeGreaterThan(0);
    expect(teluguHits[0].text).toMatch(/[ఀ-౿]/);

    expect(searchBible('దేవుడు', 'en')).toHaveLength(0);
  });

  it('keeps book IDS in English -- they are internal keys, not display text', () => {
    // Localizing these would break route params and the verse-data lookup.
    expect(getBookById('genesis')?.id).toBe('genesis');
    for (const book of BIBLE_BOOKS) {
      expect(book.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
