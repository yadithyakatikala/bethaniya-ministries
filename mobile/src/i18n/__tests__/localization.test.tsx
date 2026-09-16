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
 * These tests cover the contract rather than any one screen's wording:
 * that the catalogues agree on their keys, that switching the preference
 * changes what a component renders WITHOUT a reload, that it persists,
 * and that all four Bible surfaces follow the same single preference.
 */
const LANGUAGE_KEY = 'bible_language_preference';

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
  const { t, language } = useTranslation();
  return (
    <>
      <Text testID="probe-text">{t(stringKey)}</Text>
      <Text testID="probe-language">{language}</Text>
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

  it('renders Telugu by default, since Telugu is the default language', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('te'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.te['nav.home']);
  });

  it('renders English when English has been stored', async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'en');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.en['nav.home']);
  });

  it('reads the same single preference the Bible uses -- not a second state', async () => {
    // This is the architectural point: there is one language value, so the
    // Settings toggle cannot leave the UI and the Bible disagreeing.
    await AsyncStorage.setItem(LANGUAGE_KEY, 'en');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
  });
});

/** Renders a switchable probe so a language change can be driven in-test. */
function SwitchableProbe() {
  const { t, language } = useTranslation();
  return (
    <>
      <Text testID="probe-text">{t('nav.home')}</Text>
      <Text testID="probe-language">{language}</Text>
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

    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('te'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.te['nav.home']);

    await fireEvent.press(getByTestId('settings-language-toggle'));

    // The sibling component re-rendered in English without remounting.
    await waitFor(() => expect(getByTestId('probe-language').props.children).toBe('en'));
    expect(getByTestId('probe-text').props.children).toBe(CATALOGUES.en['nav.home']);

    // ...and the choice survives a restart.
    expect(await AsyncStorage.getItem(LANGUAGE_KEY)).toBe('en');
  });
});

describe('the Telugu Bible follows the same preference', () => {
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
