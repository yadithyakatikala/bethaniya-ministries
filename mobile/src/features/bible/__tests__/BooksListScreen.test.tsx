import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { BooksListScreen } from '../BooksListScreen';
import { BIBLE_BOOKS, getBookById } from '../books';
import { translate } from '../../../i18n';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// BooksListScreen now reads its theme from usePreferences() (Day 9 --
// see ../../../context/PreferencesContext.tsx) instead of calling
// useColorScheme() directly, so the real provider stack is needed here.
// PreferencesProvider itself still falls back to the system color scheme
// (the deep useColorScheme() mock above) when signed out / nothing is
// stored, so the light/dark-mode assertions below are unchanged.
jest.mock('../../../services/firebase/app');

async function renderScreen() {
  const navigate = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <BooksListScreen
          navigation={{ navigate } as never}
          route={{ key: 'BibleBooks', name: 'BibleBooks' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate };
}

describe('BooksListScreen', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('renders all 66 books', async () => {
    const { getByTestId } = await renderScreen();
    for (const book of BIBLE_BOOKS) {
      expect(getByTestId(`book-${book.id}`)).toBeTruthy();
    }
  });

  it('separates Old Testament and New Testament into their own sections', async () => {
    const { getByTestId, getByText } = await renderScreen();
    // The testIDs are built from a stable, never-localized section id, so
    // they do NOT change with the language -- that is deliberate.
    expect(getByTestId('bible-section-Old Testament')).toBeTruthy();
    expect(getByTestId('bible-section-New Testament')).toBeTruthy();
    // The visible headings DO change -- with the APP language, since a
    // section heading is chrome rather than scripture. Asserted through
    // the catalogue rather than a literal, so the test states "the user
    // sees the translated heading" instead of pinning one wording.
    expect(getByText(translate('en', 'bible.oldTestament'))).toBeTruthy();
    expect(getByText(translate('en', 'bible.newTestament'))).toBeTruthy();
  });

  it('follows the app language for headings and the Bible language for book names', async () => {
    // The default combination, and the one V1 could not express: English
    // chrome over Telugu scripture. A regression that re-welded the two
    // preferences would make these two assertions disagree.
    const { getByText, getByTestId } = await renderScreen();
    expect(getByText(translate('en', 'bible.oldTestament'))).toBeTruthy();
    expect(JSON.stringify(getByTestId('book-genesis'))).toContain('ఆదికాండము');
  });

  it('writes headings in Telugu when the interface is Telugu', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { findByText } = await renderScreen();
    expect(await findByText(translate('te', 'bible.oldTestament'))).toBeTruthy();
  });

  // --- Telugu book names (V1 tester feedback) --------------------------
  // The tester reported "the Telugu Bible is not the default". The Telugu
  // VERSE TEXT had been correct all along; this screen -- the Bible tab's
  // landing screen -- read `book.name` directly and so listed 66 ENGLISH
  // book names, which is what made the Bible look English. See
  // ../books.ts's getBookName().

  it('lists Telugu book names when Telugu is selected (the default)', async () => {
    const { getByTestId } = await renderScreen();
    const genesis = getBookById('genesis');
    const psalms = getBookById('psalms');
    const revelation = getBookById('revelation');

    // Sanity: these are real Telugu strings from the licensed source, not
    // the English names.
    expect(genesis?.nameTe).toBe('ఆదికాండము');
    expect(genesis?.nameTe).not.toBe(genesis?.name);

    // And they are what the row actually renders.
    for (const book of [genesis, psalms, revelation]) {
      const row = JSON.stringify(getByTestId(`book-${book?.id}`));
      expect(row).toContain(book?.nameTe);
      expect(row).not.toContain(`>${book?.name}<`);
    }
  });

  it('every one of the 66 books has a Telugu name distinct from its English one', () => {
    for (const book of BIBLE_BOOKS) {
      expect(book.nameTe.length).toBeGreaterThan(0);
      expect(book.nameTe.trim()).toBe(book.nameTe);
      expect(book.nameTe).not.toBe(book.name);
    }
  });

  it('navigates to BibleChapters with the tapped book id', async () => {
    const { getByTestId, navigate } = await renderScreen();
    await fireEvent.press(getByTestId('book-genesis'));
    expect(navigate).toHaveBeenCalledWith('BibleChapters', { bookId: 'genesis' });

    await fireEvent.press(getByTestId('book-revelation'));
    expect(navigate).toHaveBeenCalledWith('BibleChapters', { bookId: 'revelation' });
  });

  it('renders with light-mode colors by default', async () => {
    const { getByTestId } = await renderScreen();
    const list = getByTestId('bible-books-list');
    const flatStyle = Object.assign({}, ...[list.props.style].flat());
    expect(flatStyle.backgroundColor).toBe('#FAF7F1');
  });

  it('renders with dark-mode colors when the device is in dark mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderScreen();
    const list = getByTestId('bible-books-list');
    const flatStyle = Object.assign({}, ...[list.props.style].flat());
    expect(flatStyle.backgroundColor).toBe('#141A17');
  });
});
