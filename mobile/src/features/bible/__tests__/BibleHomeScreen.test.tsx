import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { subscribeToReadingPosition } from '../../../services/firebase/readingPosition';
import {
  subscribeToAllPlanProgress,
  subscribeToPublishedPlans,
} from '../../../services/firebase/plans';
import { BibleHomeScreen } from '../BibleHomeScreen';
import {
  BIBLE_BOOKS,
  NEW_TESTAMENT_BOOKS,
  OLD_TESTAMENT_BOOKS,
  getBookById,
} from '../books';
import { translate } from '../../../i18n';
import { darkTokens, lightTokens } from '../../../theme/tokens';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/readingPosition');
jest.mock('../../../services/firebase/plans');

/**
 * The Bible tab: Read | Plans under its title, with Search at the right.
 *
 * The books themselves are the same 66 the old landing screen listed, so
 * what these tests protect is the reasoning that screen carried: every book
 * is reachable, headings follow the APP language while book names follow the
 * BIBLE language, and the Telugu Bible lists Telugu names (a tester once
 * reported "the Telugu Bible is not the default" because the landing screen
 * read the English name field). What is new is the testament choice, the
 * language pill and sheet, the entry point to where the member left off, and
 * the Plans view.
 */
async function renderScreen(params?: { tab?: 'read' | 'plans' }) {
  const navigate = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <BibleHomeScreen
          navigation={{ navigate } as never}
          route={{ key: 'BibleBooks', name: 'BibleBooks', params } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate };
}

function signedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: 'Jane', email: null, phoneNumber: null });
    return jest.fn();
  });
}

function savedPosition(bookId: string | null, chapter = 3, verse = 16) {
  (subscribeToReadingPosition as jest.Mock).mockImplementation(
    (_uid, translationId, onNext) => {
      onNext(bookId ? { translationId, bookId, chapter, verse, updatedAt: null } : null);
      return jest.fn();
    }
  );
}

beforeEach(() => {
  (subscribeToReadingPosition as jest.Mock).mockImplementation((_u, _t, onNext) => {
    onNext(null);
    return jest.fn();
  });
  (subscribeToPublishedPlans as jest.Mock).mockImplementation((onNext) => {
    onNext([]);
    return jest.fn();
  });
  (subscribeToAllPlanProgress as jest.Mock).mockImplementation((_uid, onNext) => {
    onNext({});
    return jest.fn();
  });
});

afterEach(async () => {
  await AsyncStorage.clear();
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  jest.clearAllMocks();
});

describe('the Read tab', () => {
  it('is titled Bible, with Read selected and Search at the right', async () => {
    const { getByText, getByRole, navigate } = await renderScreen();
    expect(getByText('Bible')).toBeTruthy();
    expect(getByRole('tab', { name: 'Read', selected: true })).toBeTruthy();
    expect(getByRole('tab', { name: 'Plans', selected: false })).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Search' }));
    expect(navigate).toHaveBeenCalledWith('BibleSearch');
  });

  it('lists the 39 books of the Old Testament first, and the 27 of the New on choosing it, so all 66 are reachable', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();
    for (const book of OLD_TESTAMENT_BOOKS)
      expect(getByTestId(`book-${book.id}`)).toBeTruthy();
    expect(queryByTestId('book-matthew')).toBeNull();

    await fireEvent.press(getByTestId('bible-testament-NT'));
    for (const book of NEW_TESTAMENT_BOOKS)
      expect(getByTestId(`book-${book.id}`)).toBeTruthy();
    expect(queryByTestId('book-genesis')).toBeNull();
    expect(OLD_TESTAMENT_BOOKS.length + NEW_TESTAMENT_BOOKS.length).toBe(66);
  });

  it('marks the chosen testament and announces which', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('bible-testament-OT').props.accessibilityState.selected).toBe(
      true
    );
    await fireEvent.press(getByTestId('bible-testament-NT'));
    expect(getByTestId('bible-testament-NT').props.accessibilityState.selected).toBe(
      true
    );
    expect(getByTestId('bible-testament-OT').props.accessibilityState.selected).toBe(
      false
    );
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
    expect(await findByText(translate('te', 'bible.booksLabel'))).toBeTruthy();
  });

  it('lists Telugu book names when Telugu is selected (the default) and English ones when English is', async () => {
    const telugu = await renderScreen();
    const genesis = getBookById('genesis');
    expect(genesis?.nameTe).not.toBe(genesis?.name);
    expect(JSON.stringify(telugu.getByTestId('book-genesis'))).toContain(genesis?.nameTe);
    expect(JSON.stringify(telugu.getByTestId('book-genesis'))).not.toContain(
      `>${genesis?.name}<`
    );
    await telugu.unmount();

    await AsyncStorage.setItem('bible_mode_preference', 'en');
    const english = await renderScreen();
    await waitFor(() =>
      expect(JSON.stringify(english.getByTestId('book-genesis'))).toContain('Genesis')
    );
  });

  it('every one of the 66 books has a Telugu name distinct from its English one', () => {
    for (const book of BIBLE_BOOKS) {
      expect(book.nameTe.length).toBeGreaterThan(0);
      expect(book.nameTe.trim()).toBe(book.nameTe);
      expect(book.nameTe).not.toBe(book.name);
    }
  });

  it('shows how many chapters each book has, and says so to a screen reader', async () => {
    await AsyncStorage.setItem('bible_mode_preference', 'en');
    const { getByRole } = await renderScreen();
    const psalms = getBookById('psalms');
    await waitFor(() =>
      expect(
        getByRole('button', { name: `Psalms, ${psalms?.chapterCount} chapters` })
      ).toBeTruthy()
    );
  });

  it('navigates to BibleChapters with the tapped book id', async () => {
    const { getByTestId, navigate } = await renderScreen();
    await fireEvent.press(getByTestId('book-genesis'));
    expect(navigate).toHaveBeenCalledWith('BibleChapters', { bookId: 'genesis' });
    await fireEvent.press(getByTestId('bible-testament-NT'));
    await fireEvent.press(getByTestId('book-revelation'));
    expect(navigate).toHaveBeenCalledWith('BibleChapters', { bookId: 'revelation' });
  });

  it('sets the page on the paper, light and dark', async () => {
    const light = await renderScreen();
    expect(
      StyleSheet.flatten(light.getByTestId('bible-home').props.style).backgroundColor
    ).toBe(lightTokens.paper);
    await light.unmount();

    await AsyncStorage.setItem('theme_preference', 'dark');
    const dark = await renderScreen();
    await waitFor(() =>
      expect(
        StyleSheet.flatten(dark.getByTestId('bible-home').props.style).backgroundColor
      ).toBe(darkTokens.paper)
    );
  });

  describe('where the member left off', () => {
    it('offers it first, and opens on the testament it is in, with that book in bold', async () => {
      signedIn();
      savedPosition('john', 3, 16);
      const { getByTestId, queryByTestId, navigate } = await renderScreen();
      await waitFor(() => expect(getByTestId('continue-reading-button')).toBeTruthy());
      // John is in the New Testament: that is the list it opens on.
      await waitFor(() => expect(getByTestId('book-john')).toBeTruthy());
      expect(queryByTestId('book-genesis')).toBeNull();
      const name = within(getByTestId('book-john')).getAllByText(/./)[0];
      expect(StyleSheet.flatten(name.props.style).fontWeight).toBe('700');
      const other = within(getByTestId('book-matthew')).getAllByText(/./)[0];
      expect(StyleSheet.flatten(other.props.style).fontWeight).not.toBe('700');

      await fireEvent.press(getByTestId('continue-reading-button'));
      expect(navigate).toHaveBeenCalledWith('BibleChapter', {
        bookId: 'john',
        chapterNumber: 3,
        verse: 16,
      });
    });

    it('lets the member choose the other testament, and keeps their choice', async () => {
      signedIn();
      savedPosition('john');
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('book-john')).toBeTruthy());
      await fireEvent.press(getByTestId('bible-testament-OT'));
      expect(getByTestId('book-genesis')).toBeTruthy();
      expect(queryByTestId('book-john')).toBeNull();
    });

    it('opens on the Old Testament, with no continue row, when nothing has been read', async () => {
      signedIn();
      savedPosition(null);
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('book-genesis')).toBeTruthy());
      expect(queryByTestId('continue-reading-button')).toBeNull();
      expect(getByTestId('bible-testament-OT').props.accessibilityState.selected).toBe(
        true
      );
    });
  });

  describe('the Bible language', () => {
    it('is a pill that says the current language and opens the sheet of choices', async () => {
      const { getByTestId, getByRole } = await renderScreen();
      expect(getByTestId('bible-language-pill')).toHaveTextContent('Telugu');
      expect(getByRole('button', { name: 'Bible language: Telugu' })).toBeTruthy();

      await fireEvent.press(getByTestId('bible-language-pill'));
      for (const mode of ['te', 'en', 'bilingual']) {
        expect(getByTestId(`bible-language-${mode}`)).toBeTruthy();
      }
      expect(getByTestId('bible-language-te').props.accessibilityState.checked).toBe(
        true
      );
    });

    it('changes the Bible language, persists it, closes the sheet and renames the books', async () => {
      const { getByTestId, queryByTestId } = await renderScreen();
      await fireEvent.press(getByTestId('bible-language-pill'));
      await fireEvent.press(getByTestId('bible-language-en'));

      await waitFor(async () =>
        expect(await AsyncStorage.getItem('bible_mode_preference')).toBe('en')
      );
      expect(queryByTestId('bible-language-en')).toBeNull();
      await waitFor(() =>
        expect(getByTestId('bible-language-pill')).toHaveTextContent('English')
      );
      expect(JSON.stringify(getByTestId('book-genesis'))).toContain('Genesis');
      // The interface did not move.
      expect(await AsyncStorage.getItem('app_language_preference')).not.toBe('te');
    });
  });
});

describe('the Plans tab', () => {
  it('opens on the Plans view when the route asks for it (Home and Saved do)', async () => {
    const { getByTestId, queryByTestId, getByRole } = await renderScreen({
      tab: 'plans',
    });
    expect(getByTestId('plans-view')).toBeTruthy();
    expect(queryByTestId('bible-books-list')).toBeNull();
    expect(getByRole('tab', { name: 'Plans', selected: true })).toBeTruthy();
    // The title and the tabs stay: they are the header of the plans list.
    expect(getByRole('tab', { name: 'Read', selected: false })).toBeTruthy();
  });

  it('switches between Read and Plans with the tabs, and back', async () => {
    const { getByRole, getByTestId, queryByTestId } = await renderScreen();
    await fireEvent.press(getByRole('tab', { name: 'Plans' }));
    expect(getByTestId('plans-view')).toBeTruthy();
    await fireEvent.press(getByRole('tab', { name: 'Read' }));
    expect(getByTestId('bible-books-list')).toBeTruthy();
    expect(queryByTestId('plans-view')).toBeNull();
  });

  it('moves to Plans when the same screen is sent there again', async () => {
    const utils = await renderScreen();
    expect(utils.queryByTestId('plans-view')).toBeNull();
    await utils.rerender(
      <AuthProvider>
        <PreferencesProvider>
          <BibleHomeScreen
            navigation={{ navigate: utils.navigate } as never}
            route={
              { key: 'BibleBooks', name: 'BibleBooks', params: { tab: 'plans' } } as never
            }
          />
        </PreferencesProvider>
      </AuthProvider>
    );
    expect(utils.getByTestId('plans-view')).toBeTruthy();
  });
});
