import React from 'react';
import { Share, StyleSheet, useWindowDimensions } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import {
  darkTokens,
  fontFamilies,
  lightTokens,
  readingScale,
} from '../../../../theme/tokens';
import { AuthProvider } from '../../../../context/AuthContext';
import { PreferencesProvider } from '../../../../context/PreferencesContext';
import { ReadingPreferencesProvider } from '../../../../context/ReadingPreferencesContext';
import { ReaderScreen } from '../ReaderScreen';
import { setLanguagePreference } from '../../languagePreference';
import { translate } from '../../../../i18n/strings';
import type { BibleMode } from '../../types';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

/**
 * A PHONE by default. jest-expo's own default is tablet-sized, which
 * would have quietly tested the reader at a width real members do not
 * have -- and the bilingual side-by-side layout is offered only above
 * 600dp, so the default would have hidden exactly the case that matters.
 */
const screen = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// The reader reads the BIBLE preference (usePreferences().bibleMode),
// which since M2 is a separate value from the interface language -- so the
// real provider stack is needed, and the reader is seeded through the
// Bible's own key rather than the app language's. seedBibleMode() writes
// the V2 key directly; the migration path from V1's single key has its own
// test at the bottom of this file.
jest.mock('../../../../services/firebase/app');

const BIBLE_MODE_KEY = 'bible_mode_preference';
const APP_LANGUAGE_KEY = 'app_language_preference';

async function seedBibleMode(mode: BibleMode) {
  await AsyncStorage.setItem(BIBLE_MODE_KEY, mode);
}

function setScreenWidth(width: number) {
  (useWindowDimensions as unknown as jest.Mock).mockReturnValue({ ...screen, width });
}

/**
 * Signs a member in and decides what their annotation collections
 * contain.
 *
 * Every subscription in the reader goes through onSnapshot, so the mock
 * dispatches on the reference PATH -- the profile document, the reading
 * preferences document and the three annotation collections all arrive
 * here, and handing the wrong shape to one of them is the quickest way
 * to a test that passes for the wrong reason.
 */
function mockSignedIn(
  uid: string,
  annotations: {
    highlights?: { id: string; data: Record<string, unknown> }[];
    bookmarks?: { id: string; data: Record<string, unknown> }[];
    notes?: { id: string; data: Record<string, unknown> }[];
  } = {}
) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid, displayName: null, email: null, phoneNumber: null });
    return jest.fn();
  });
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));

  const asDocs = (rows: { id: string; data: Record<string, unknown> }[] = []) => ({
    docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
  });

  (onSnapshot as jest.Mock).mockImplementation((ref, next) => {
    const path: string = ref?.path ?? '';
    if (path.endsWith('/highlights')) next(asDocs(annotations.highlights));
    else if (path.endsWith('/bookmarks')) next(asDocs(annotations.bookmarks));
    else if (path.endsWith('/verseNotes')) next(asDocs(annotations.notes));
    else next({ exists: () => false });
    return jest.fn();
  });
}

/**
 * The reference appears TWICE on purpose -- in the top bar and on the
 * bottom bar's chapter selector -- so a text query for it is ambiguous.
 * These read the top bar's node, which is the heading.
 */
function referenceOf(getByTestId: (id: string) => { props: Record<string, unknown> }) {
  return getByTestId('reader-reference').props.children;
}

async function renderScreen(
  bookId: string,
  chapterNumber: number,
  params: { verse?: number } = {}
) {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <ReadingPreferencesProvider>
          <ReaderScreen
            navigation={{ navigate, goBack } as never}
            route={
              {
                key: 'BibleChapter',
                name: 'BibleChapter',
                params: { bookId, chapterNumber, ...params },
              } as never
            }
          />
        </ReadingPreferencesProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

beforeEach(() => {
  setScreenWidth(390);
});

describe('the reader renders a chapter', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    (collection as jest.Mock).mockImplementation(() => undefined);
  });

  it('displays the book name, chapter number, and verse content once loaded', async () => {
    await seedBibleMode('en');
    const { getByTestId, getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(referenceOf(getByTestId)).toBe('Genesis 1'));
    expect(
      getByText('In the beginning God created the heavens and the earth.')
    ).toBeTruthy();
  });

  it('says plainly that Malachi 4 is not in the Telugu translation', async () => {
    // V1 rendered generated placeholder verses here. Nothing is generated
    // now, so the reader reports the absence instead.
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('malachi', 4);
    await waitFor(() => expect(getByTestId('chapter-unavailable')).toBeTruthy());
  });

  it('does not print the same absence sentence twice', async () => {
    // Caught in M2 visual QA: the header badge and the body message both
    // read "This chapter is not in this translation.", one directly under
    // the other, which reads as a rendering bug. The empty state's title
    // states the fact and its message says what to do about it.
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('malachi', 4);
    await waitFor(() => expect(getByTestId('chapter-unavailable')).toBeTruthy());

    const state = getByTestId('chapter-unavailable');
    const texts = JSON.stringify(state).match(/"children":"[^"]+"/g) ?? [];
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('shows no unavailable state for a chapter the translation does have', async () => {
    await seedBibleMode('en');
    const { getByTestId, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(referenceOf(getByTestId)).toBe('Genesis 1'));
    expect(queryByTestId('chapter-unavailable')).toBeNull();
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

  it("prints ordinary quotation marks, not the import's escape characters", async () => {
    // M4 visual QA found 7,213 stray backslashes in the English corpus --
    // `God said, \\"Let there be light,\\"` on 4,503 verses. See
    // ../../__tests__/webBible.test.ts for the corpus-level guard.
    await seedBibleMode('en');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(
        getByText('God said, "Let there be light," and there was light.')
      ).toBeTruthy()
    );
  });

  it('says a verse the WEB itself omits is not in this translation', async () => {
    // Acts 8:37 is one of seven verses whose only content in the source is
    // a note that the manuscripts do not contain it. The NUMBER still
    // prints -- hiding it would make the chapter look as though a verse
    // had gone missing.
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('acts', 8);
    await waitFor(() => expect(getByTestId('verse-37')).toBeTruthy());
    expect(getByTestId('verse-37-absent')).toBeTruthy();
    expect(getByTestId('verse-37').props.accessibilityLabel).toContain(
      translate('en', 'bible.notInTranslation')
    );
    // The verses around it are ordinary scripture.
    expect(getByTestId('verse-36')).toBeTruthy();
    expect(getByTestId('verse-38')).toBeTruthy();
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
    await waitFor(() => expect(getByTestId('reader-screen')).toBeTruthy());
    const style = StyleSheet.flatten(getByTestId('reader-screen').props.style) as {
      backgroundColor?: string;
    };
    expect(style.backgroundColor).toBe(lightTokens.paper);
  });

  it('renders with dark-mode colors when the device is in dark mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-screen')).toBeTruthy());
    const style = StyleSheet.flatten(getByTestId('reader-screen').props.style) as {
      backgroundColor?: string;
    };
    expect(style.backgroundColor).toBe(darkTokens.paper);
  });

  it('goes back when the back control is pressed', async () => {
    const { getByTestId, goBack } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-back-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-back-button'));
    expect(goBack).toHaveBeenCalled();
  });
});

/**
 * The chrome, which is the difference between a reader and a screen with
 * verses on it.
 */
describe('reader chrome', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('starts visible, so a reader arriving has the controls', async () => {
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-top-bar')).toBeTruthy());
    expect(getByTestId('reader-bottom-bar')).toBeTruthy();
  });

  it('hides both bars when the page is tapped, and brings them back', async () => {
    const { getByTestId, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-top-bar')).toBeTruthy());

    fireEvent.press(getByTestId('reader-scripture-surface'));
    await waitFor(() => expect(queryByTestId('reader-top-bar')).toBeNull());
    expect(queryByTestId('reader-bottom-bar')).toBeNull();

    fireEvent.press(getByTestId('reader-scripture-surface'));
    await waitFor(() => expect(getByTestId('reader-top-bar')).toBeTruthy());
  });

  it('does not navigate when the page is tapped', async () => {
    // The tap toggles chrome and nothing else: a reading surface that
    // could navigate by accident is unusable.
    const { getByTestId, navigate } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-scripture-surface')).toBeTruthy());
    fireEvent.press(getByTestId('reader-scripture-surface'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the chapter selector to a NUMBER, so a long book name cannot push Next off the bar', async () => {
    // Visual QA: with "దినవృత్తాంతములు మొదటి గ్రంథము" in the selector the
    // bottom bar grew past the screen and clipped "Next". The book is
    // named in the top bar directly above.
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    await seedBibleMode('te');
    const { getByTestId, queryAllByText } = await renderScreen('1-chronicles', 5);
    await waitFor(() => expect(getByTestId('chapter-selector-button')).toBeTruthy());

    // What the control PRINTS -- deliberately not its accessibilityLabel,
    // which should still carry the full reference.
    const selector = within(getByTestId('chapter-selector-button'));
    expect(selector.getByText('5')).toBeTruthy();
    expect(selector.queryByText(/దినవృత్తాంతములు/)).toBeNull();
    // The reference is still what a screen reader hears.
    expect(getByTestId('chapter-selector-button').props.accessibilityLabel).toContain(
      'దినవృత్తాంతములు'
    );
    // And the book name is on screen exactly once -- in the top bar.
    expect(queryAllByText(/దినవృత్తాంతములు/)).toHaveLength(1);
  });

  it('marks Previous as disabled on the first chapter of a book', async () => {
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());
    expect(getByTestId('previous-chapter-button').props.accessibilityState.disabled).toBe(
      true
    );
  });

  it('navigates to the previous chapter when not on the first chapter', async () => {
    const { getByTestId, navigate } = await renderScreen('genesis', 5);
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());
    expect(
      getByTestId('previous-chapter-button').props.accessibilityState.disabled
    ).toBeFalsy();

    fireEvent.press(getByTestId('previous-chapter-button'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 4,
    });
  });

  it('navigates to the next chapter when not on the last chapter', async () => {
    const { getByTestId, navigate } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());
    fireEvent.press(getByTestId('next-chapter-button'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 2,
    });
  });

  it('marks Next as disabled on the last chapter of a book (Jude, 1 chapter)', async () => {
    const { getByTestId } = await renderScreen('jude', 1);
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());
    expect(getByTestId('next-chapter-button').props.accessibilityState.disabled).toBe(
      true
    );
  });
});

describe('the chapter picker', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('opens on the book being read, so the next chapter is one tap', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-selector-button')).toBeTruthy());

    fireEvent.press(getByTestId('chapter-selector-button'));
    await waitFor(() => expect(getByTestId('chapter-picker-chapters')).toBeTruthy());
    // Genesis has 50 chapters and the grid offers every one of them.
    expect(getByTestId('chapter-picker-chapter-50')).toBeTruthy();
  });

  it('navigates to the chapter that was picked', async () => {
    await seedBibleMode('en');
    const { getByTestId, navigate } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-selector-button')).toBeTruthy());

    fireEvent.press(getByTestId('chapter-selector-button'));
    await waitFor(() => expect(getByTestId('chapter-picker-chapter-12')).toBeTruthy());
    fireEvent.press(getByTestId('chapter-picker-chapter-12'));

    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 12,
    });
  });

  it('lets a reader back out to the book list and jump to another book', async () => {
    await seedBibleMode('en');
    const { getByTestId, navigate } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-selector-button')).toBeTruthy());

    fireEvent.press(getByTestId('chapter-selector-button'));
    await waitFor(() => expect(getByTestId('chapter-picker-back-to-books')).toBeTruthy());
    fireEvent.press(getByTestId('chapter-picker-back-to-books'));

    await waitFor(() => expect(getByTestId('chapter-picker-book-john')).toBeTruthy());
    fireEvent.press(getByTestId('chapter-picker-book-john'));
    await waitFor(() => expect(getByTestId('chapter-picker-chapter-3')).toBeTruthy());
    fireEvent.press(getByTestId('chapter-picker-chapter-3'));

    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'john',
      chapterNumber: 3,
    });
  });
});

describe('verse actions', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    (collection as jest.Mock).mockImplementation(() => undefined);
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
  });

  it('opens the action sheet for the verse that was tapped', async () => {
    await seedBibleMode('en');
    const { getByTestId, getByText } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());

    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('verse-action-sheet')).toBeTruthy());
    // The sheet is titled with the reference, so there is no doubt which
    // verse is about to be acted on.
    expect(getByText('John 3:16')).toBeTruthy();
  });

  it('offers only Share and Copy while signed out, and says why', async () => {
    await seedBibleMode('en');
    const { getByTestId, queryByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));

    await waitFor(() => expect(getByTestId('verse-actions-sign-in')).toBeTruthy());
    expect(queryByTestId('highlight-yellow')).toBeNull();
    expect(queryByTestId('bookmark-button')).toBeNull();
    expect(getByTestId('share-verse-button')).toBeTruthy();
    expect(getByTestId('copy-verse-button')).toBeTruthy();
  });

  it('copies the reference and the verse text to the clipboard', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('copy-verse-button')).toBeTruthy());

    fireEvent.press(getByTestId('copy-verse-button'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());

    const copied = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0] as string;
    expect(copied.startsWith('John 3:16\n')).toBe(true);
    expect(copied).toContain('For God so loved the world');
  });

  it('confirms the copy, so the tap is not silent', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('copy-verse-button')).toBeTruthy());
    fireEvent.press(getByTestId('copy-verse-button'));
    await waitFor(() => expect(getByTestId('reader-notice')).toBeTruthy());
  });

  it('shares the verse and its reference, and nothing else', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('share-verse-button')).toBeTruthy());

    fireEvent.press(getByTestId('share-verse-button'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('John 3:16');
    expect(message).toContain('For God so loved the world');
    // The translation's name is not part of a shared verse -- see
    // ../../translationCredits.ts.
    expect(message).not.toContain('World English Bible');
    share.mockRestore();
  });

  it('shares Telugu scripture with NO licence block, the same as English', async () => {
    // M6 regression, and the same rule the VOTD share follows (see
    // ../../../daily-verses/__tests__/DailyVerseCard.test.tsx). Quoting a
    // verse into a chat is quoting, not publishing a derivative work; the
    // CC BY-SA attribution the bundled IRV requires is met by the
    // Settings credits card, which is now the app's only licence notice.
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('share-verse-button')).toBeTruthy());

    fireEvent.press(getByTestId('share-verse-button'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('3:16');
    expect(message).not.toContain('Indian Revised Version');
    expect(message).not.toContain('CC BY-SA');
    expect(message).not.toContain('©');
    share.mockRestore();
  });

  it('writes a highlight against the verse and translation being read', async () => {
    mockSignedIn('member-1');
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('highlight-green')).toBeTruthy());

    fireEvent.press(getByTestId('highlight-green'));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref, data] = (setDoc as jest.Mock).mock.calls[0] as [
      { path: string },
      Record<string, unknown>,
    ];
    expect(ref.path).toBe('users/member-1/highlights/en_john_3_16');
    expect(data).toMatchObject({
      translationId: 'en',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      colour: 'green',
    });
  });

  it('removes a highlight rather than adding a second one when it is re-tapped', async () => {
    mockSignedIn('member-1', {
      highlights: [
        {
          id: 'en_john_3_16',
          data: {
            translationId: 'en',
            bookId: 'john',
            chapter: 3,
            verse: 16,
            colour: 'green',
          },
        },
      ],
    });
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('highlight-green')).toBeTruthy());

    fireEvent.press(getByTestId('highlight-green'));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalled());
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('bookmarks a verse at a deterministic id, so a second tap cannot duplicate it', async () => {
    mockSignedIn('member-1');
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('bookmark-button')).toBeTruthy());

    fireEvent.press(getByTestId('bookmark-button'));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref] = (setDoc as jest.Mock).mock.calls[0] as [{ path: string }];
    expect(ref.path).toBe('users/member-1/bookmarks/te_john_3_16');
  });

  it('names an already-bookmarked verse Remove bookmark, and deletes it', async () => {
    mockSignedIn('member-1', {
      bookmarks: [
        {
          id: 'en_john_3_16',
          data: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 },
        },
      ],
    });
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('bookmark-button')).toBeTruthy());

    fireEvent.press(getByTestId('bookmark-button'));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalled());
  });

  it('saves a private note on the verse', async () => {
    mockSignedIn('member-1');
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('note-button')).toBeTruthy());

    fireEvent.press(getByTestId('note-button'));
    await waitFor(() => expect(getByTestId('note-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('note-input'), 'The whole gospel in one verse.');
    await waitFor(() =>
      expect(getByTestId('save-note-button').props.accessibilityState.disabled).toBe(
        false
      )
    );
    fireEvent.press(getByTestId('save-note-button'));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref, data] = (setDoc as jest.Mock).mock.calls[0] as [
      { path: string },
      Record<string, unknown>,
    ];
    expect(ref.path).toBe('users/member-1/verseNotes/en_john_3_16');
    expect(data.text).toBe('The whole gospel in one verse.');
  });

  it('refuses to save an empty note', async () => {
    mockSignedIn('member-1');
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('note-button')).toBeTruthy());
    fireEvent.press(getByTestId('note-button'));

    await waitFor(() => expect(getByTestId('save-note-button')).toBeTruthy());
    expect(getByTestId('save-note-button').props.accessibilityState.disabled).toBe(true);
  });

  it('opens an existing note for editing rather than starting blank', async () => {
    mockSignedIn('member-1', {
      notes: [
        {
          id: 'en_john_3_16',
          data: {
            translationId: 'en',
            bookId: 'john',
            chapter: 3,
            verse: 16,
            text: 'Written earlier.',
          },
        },
      ],
    });
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('note-button')).toBeTruthy());
    fireEvent.press(getByTestId('note-button'));

    await waitFor(() => expect(getByTestId('note-input')).toBeTruthy());
    expect(getByTestId('note-input').props.value).toBe('Written earlier.');
    // And an existing note can be deleted, which a blank one cannot.
    expect(getByTestId('delete-note-button')).toBeTruthy();
  });
});

/**
 * Nothing about a verse's state may be carried by colour alone -- the
 * four highlight tints sit at the same lightness by design.
 */
describe('verse state is not colour-only', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    (collection as jest.Mock).mockImplementation(() => undefined);
  });

  it('speaks the verse number, the text and every state of the row', async () => {
    mockSignedIn('member-1', {
      highlights: [
        {
          id: 'en_john_3_16',
          data: {
            translationId: 'en',
            bookId: 'john',
            chapter: 3,
            verse: 16,
            colour: 'blue',
          },
        },
      ],
      bookmarks: [
        {
          id: 'en_john_3_16',
          data: { translationId: 'en', bookId: 'john', chapter: 3, verse: 16 },
        },
      ],
      notes: [
        {
          id: 'en_john_3_16',
          data: {
            translationId: 'en',
            bookId: 'john',
            chapter: 3,
            verse: 16,
            text: 'A note.',
          },
        },
      ],
    });
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());

    const label: string = getByTestId('verse-16').props.accessibilityLabel;
    expect(label.startsWith('16.')).toBe(true);
    expect(label).toContain('For God so loved the world');
    expect(label).toContain('Highlighted');
    expect(label).toContain('Bookmarked');
    expect(label).toContain('Has a note');
  });

  it('names each highlight colour instead of showing four bare swatches', async () => {
    mockSignedIn('member-1');
    await seedBibleMode('en');
    const { getByTestId, getByText } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    fireEvent.press(getByTestId('verse-16'));

    await waitFor(() => expect(getByTestId('highlight-yellow')).toBeTruthy());
    for (const name of ['Yellow', 'Green', 'Blue', 'Pink']) {
      expect(getByText(name)).toBeTruthy();
    }
    expect(getByTestId('highlight-blue').props.accessibilityLabel).toBe('Blue');
  });

  it('marks the selected verse with accessibilityState, not just a tint', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());
    expect(getByTestId('verse-16').props.accessibilityState.selected).toBe(false);

    fireEvent.press(getByTestId('verse-16'));
    // includeHiddenElements because the open action sheet is a modal, so
    // the page behind it is correctly hidden from the accessibility tree
    // -- which is itself the right behaviour and not what this asserts.
    await waitFor(() =>
      expect(
        getByTestId('verse-16', { includeHiddenElements: true }).props.accessibilityState
          .selected
      ).toBe(true)
    );
  });
});

describe('reading settings', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('applies and persists a larger text size', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());

    // The largest size in the row is the SCRIPTURE; the smaller one is
    // the 13pt verse number, which the reading settings do not scale.
    const fontSizeOf = () => {
      const sizes = [
        ...JSON.stringify(
          getByTestId('verse-1', { includeHiddenElements: true })
        ).matchAll(/"fontSize":([0-9.]+)/g),
      ].map((match) => Number(match[1]));
      return Math.max(...sizes);
    };
    const before = fontSizeOf();
    expect(before).toBe(readingScale.size.md);

    fireEvent.press(getByTestId('reader-settings-button'));
    await waitFor(() => expect(getByTestId('reader-size-increase')).toBeTruthy());
    fireEvent.press(getByTestId('reader-size-increase'));

    await waitFor(async () =>
      expect(await AsyncStorage.getItem('reading_prefs')).toContain('"size":"lg"')
    );
    // And the page itself, not only the stored value, changed.
    expect(fontSizeOf()).toBe(readingScale.size.lg);
  });

  it('offers Light, Dark and System, and drives the app theme', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));

    await waitFor(() => expect(getByTestId('reader-theme-system')).toBeTruthy());
    expect(getByTestId('reader-theme-light')).toBeTruthy();
    expect(getByTestId('reader-theme-dark')).toBeTruthy();
    // 'system' is the default, so nothing has been chosen yet.
    expect(getByTestId('reader-theme-system').props.accessibilityState.selected).toBe(
      true
    );

    fireEvent.press(getByTestId('reader-theme-dark'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('theme_preference')).toBe('dark')
    );
    const style = StyleSheet.flatten(getByTestId('reader-screen').props.style) as {
      backgroundColor?: string;
    };
    expect(style.backgroundColor).toBe(darkTokens.paper);
  });

  it('changes the reading font and the column width', async () => {
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));

    await waitFor(() => expect(getByTestId('reader-font-sans')).toBeTruthy());
    fireEvent.press(getByTestId('reader-font-sans'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('reading_prefs')).toContain('"font":"sans"')
    );

    fireEvent.press(getByTestId('reader-width-narrow'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('reading_prefs')).toContain('"width":"narrow"')
    );
  });

  it('hides the bilingual layout control outside bilingual mode', async () => {
    await seedBibleMode('en');
    const { getByTestId, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));
    await waitFor(() => expect(getByTestId('reader-font')).toBeTruthy());
    expect(queryByTestId('reader-layout')).toBeNull();
  });

  it('offers the three Bible modes and writes only the Bible key', async () => {
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));

    await waitFor(() => expect(getByTestId('reader-bible-mode-bilingual')).toBeTruthy());
    fireEvent.press(getByTestId('reader-bible-mode-en'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(BIBLE_MODE_KEY)).toBe('en')
    );
    // The interface language was never touched by the Bible control --
    // that separation is the whole point of M2.
    expect(await AsyncStorage.getItem(APP_LANGUAGE_KEY)).toBe('en');
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
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('shows Telugu scripture even when the interface is English', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    await seedBibleMode('te');
    const { getByText, getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy()
    );
    // The book name follows the Bible in a single-language mode: the
    // heading belongs to the scripture underneath it.
    expect(referenceOf(getByTestId)).toBe('ఆదికాండము 1');
  });

  it('shows English scripture even when the interface is Telugu', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'te');
    await seedBibleMode('en');
    const { getByText, getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(
        getByText('In the beginning God created the heavens and the earth.')
      ).toBeTruthy()
    );
    expect(referenceOf(getByTestId)).toBe('Genesis 1');
  });

  it('migrates a V1 install: the stored Bible choice still reaches the reader', async () => {
    // A member upgrading from V1 has only the old key. Their Telugu Bible
    // must still be their Telugu Bible, and the interface must still come
    // up in English -- see ../../../context/languagePreferences.ts.
    await setLanguagePreference('te');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy()
    );
  });
});

/**
 * Bilingual mode, end to end through the M1 alignment policy.
 *
 * Each of the three presentations the policy can return has a real
 * chapter behind it here, rather than a fixture: the policy's own unit
 * tests (../../__tests__/alignment.test.ts) prove the rules, and these
 * prove the reader renders each outcome instead of silently showing one
 * language.
 */
describe('bilingual mode', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    (collection as jest.Mock).mockImplementation(() => undefined);
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

  it('keeps the two sides of a divergent chapter separately addressable', async () => {
    // Each side carries its OWN verse numbering, so the two lists must not
    // collide -- an annotation on English 36 is not an annotation on
    // Telugu 36 in a chapter the traditions divide differently.
    await seedBibleMode('bilingual');
    const { getByTestId } = await renderScreen('genesis', 31);
    await waitFor(() => expect(getByTestId('bilingual-chapter-level')).toBeTruthy());
    expect(getByTestId('verse-en-1')).toBeTruthy();
    expect(getByTestId('verse-te-1')).toBeTruthy();
  });

  it('shows English alone, flagged, for the one chapter Telugu lacks', async () => {
    await seedBibleMode('bilingual');
    const { getByTestId, queryByTestId } = await renderScreen('malachi', 4);
    await waitFor(() => expect(getByTestId('bilingual-english-only')).toBeTruthy());
    // Nothing invented, and no duplicate notice elsewhere on the page.
    expect(queryByTestId('bilingual-paired')).toBeNull();
    expect(queryByTestId('chapter-unavailable')).toBeNull();
  });

  it('records a paired verse against the primary Bible language', async () => {
    mockSignedIn('member-1');
    await seedBibleMode('bilingual');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('verse-1')).toBeTruthy());
    fireEvent.press(getByTestId('verse-1'));
    await waitFor(() => expect(getByTestId('highlight-yellow')).toBeTruthy());
    fireEvent.press(getByTestId('highlight-yellow'));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref] = (setDoc as jest.Mock).mock.calls[0] as [{ path: string }];
    // 'te', the primary Bible -- never 'bilingual', which is a display
    // mode and not a translation.
    expect(ref.path).toBe('users/member-1/highlights/te_genesis_1_1');
  });

  it('shares a paired verse as readable text, both languages, no licence block', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    await seedBibleMode('bilingual');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('verse-1')).toBeTruthy());
    fireEvent.press(getByTestId('verse-1'));
    await waitFor(() => expect(getByTestId('share-verse-button')).toBeTruthy());
    fireEvent.press(getByTestId('share-verse-button'));

    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('In the beginning God created the heavens and the earth.');
    expect(message).toContain('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.');
    // Both texts, neither translation named, and no copyright line -- a
    // bilingual share is the same quotation twice, not a licence notice.
    expect(message).not.toContain('World English Bible');
    expect(message).not.toContain('Indian Revised Version');
    expect(message).not.toContain('CC BY-SA');
    // Not a dumped object.
    expect(message).not.toContain('{');
    share.mockRestore();
  });

  it('writes book names in the interface language, since the verses carry both', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'te');
    await seedBibleMode('bilingual');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('bilingual-paired')).toBeTruthy());
    expect(referenceOf(getByTestId)).toBe('ఆదికాండము 1');
  });
});

describe('scripture typography', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
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
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId('reader-reference').props.style) as {
      fontFamily?: string;
    };
    expect(style.fontFamily).toBe(fontFamilies.interfaceSemiBold);
    expect(style.fontFamily).not.toBe(fontFamilies.serifEnSemiBold);
  });

  it('sets an English book name in the English serif', async () => {
    await AsyncStorage.setItem(APP_LANGUAGE_KEY, 'en');
    await seedBibleMode('en');
    const { getByTestId } = await renderScreen('1-chronicles', 1);
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());

    const style = StyleSheet.flatten(getByTestId('reader-reference').props.style) as {
      fontFamily?: string;
    };
    expect(style.fontFamily).toBe(fontFamilies.serifEnSemiBold);
  });

  it('sets Telugu scripture in the Telugu serif, not a Latin-only one', async () => {
    await seedBibleMode('te');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('verse-1')).toBeTruthy());

    const verse = getByTestId('verse-1');
    const body = JSON.stringify(verse);
    expect(body).toContain(fontFamilies.serifTeRegular);
    expect(body).not.toContain(fontFamilies.serifEnRegular);
  });

  it('gives Telugu scripture more leading than English at the same size', async () => {
    // Telugu stacks vowel signs above and below the base consonant, so
    // Latin-tuned leading clips them.
    await seedBibleMode('bilingual');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('bilingual-paired')).toBeTruthy());

    const row = JSON.stringify(getByTestId('verse-1'));
    const lineHeights = [...row.matchAll(/"lineHeight":(\d+)/g)].map((m) => Number(m[1]));
    expect(lineHeights.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...lineHeights)).toBeGreaterThan(Math.min(...lineHeights));
  });
});

describe('side-by-side bilingual needs the room', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    setScreenWidth(390);
  });

  it('does not offer the layout control on a phone', async () => {
    // Two columns on a 390dp screen give each side about eighteen
    // characters a line. The setting is hidden rather than offered and
    // then quietly ignored -- see ../ScriptureBody.tsx.
    setScreenWidth(390);
    await seedBibleMode('bilingual');
    const { getByTestId, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));
    await waitFor(() => expect(getByTestId('reader-font')).toBeTruthy());
    expect(queryByTestId('reader-layout')).toBeNull();
  });

  it('offers it on a tablet, where two columns are readable', async () => {
    setScreenWidth(834);
    await seedBibleMode('bilingual');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));
    await waitFor(() => expect(getByTestId('reader-layout')).toBeTruthy());
    expect(getByTestId('reader-layout-sideBySide')).toBeTruthy();
  });
});
