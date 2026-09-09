import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { ChapterScreen } from '../ChapterScreen';
import { setLanguagePreference } from '../languagePreference';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// ChapterScreen now reads/sets language and theme through usePreferences()
// (Day 9), not languagePreference.ts / useColorScheme() directly, so the
// real provider stack is needed. PreferencesProvider still reads/writes
// languagePreference.ts's own AsyncStorage key under the hood, so
// setLanguagePreference()-seeded state and the AsyncStorage assertions
// below are unchanged.
jest.mock('../../../services/firebase/app');

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
    const { getByTestId, getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Genesis 1')).toBeTruthy());
    expect(getByTestId('chapter-reference')).toBeTruthy();
  });

  it('labels the two documented Telugu source gaps (e.g. Joel 3) with the development-content banner', async () => {
    await setLanguagePreference('te');
    const { getByTestId } = await renderScreen('joel', 3);
    await waitFor(() => expect(getByTestId('chapter-placeholder-banner')).toBeTruthy());
  });

  it('does not show the placeholder banner for English (real WEB text)', async () => {
    await setLanguagePreference('en');
    const { getByText, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Language: English')).toBeTruthy());
    expect(queryByTestId('chapter-placeholder-banner')).toBeNull();
  });

  it('does not show the placeholder banner for Telugu outside the two documented gap chapters', async () => {
    await setLanguagePreference('te');
    const { getByText, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Language: Telugu')).toBeTruthy());
    expect(queryByTestId('chapter-placeholder-banner')).toBeNull();
  });

  it('shows real WEB verse text for English', async () => {
    await setLanguagePreference('en');
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(
        getByText('In the beginning God created the heavens and the earth.')
      ).toBeTruthy()
    );
  });

  it('shows real Telugu IRV 2019 verse text by default (Telugu is the default language)', async () => {
    const { getByText } = await renderScreen('genesis', 1);
    await waitFor(() =>
      expect(getByText('ఆరంభంలో దేవుడు ఆకాశాలనూ భూమినీ సృష్టించాడు.')).toBeTruthy()
    );
  });

  it('restores a previously saved English preference on mount', async () => {
    await setLanguagePreference('en');
    const { getByText, queryByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Language: English')).toBeTruthy());
    expect(queryByTestId('chapter-placeholder-banner')).toBeNull();
  });

  it('toggles the language and persists the new preference to AsyncStorage', async () => {
    await setLanguagePreference('en');
    const { getByTestId, getByText } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByText('Language: English')).toBeTruthy());

    await fireEvent.press(getByTestId('language-toggle-button'));
    await waitFor(() => expect(getByText('Language: Telugu')).toBeTruthy());

    const stored = await AsyncStorage.getItem('bible_language_preference');
    expect(stored).toBe('te');
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
    expect(flatStyle.backgroundColor).toBe('#FAF7F1');
  });

  it('renders with dark-mode colors when the device is in dark mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-screen')).toBeTruthy());
    const screen = getByTestId('chapter-screen');
    const flatStyle = Object.assign({}, ...[screen.props.contentContainerStyle].flat());
    expect(flatStyle.backgroundColor).toBe('#141A17');
  });

  it('goes back when the back button is pressed', async () => {
    const { getByTestId, goBack } = await renderScreen('genesis', 1);
    await waitFor(() => expect(getByTestId('chapter-back-button')).toBeTruthy());
    fireEvent.press(getByTestId('chapter-back-button'));
    expect(goBack).toHaveBeenCalled();
  });
});
