import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { BibleSearchScreen } from '../BibleSearchScreen';

jest.mock('../../../services/firebase/app');

async function renderScreen() {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <BibleSearchScreen
          navigation={{ navigate, goBack } as never}
          route={{ key: 'BibleSearch', name: 'BibleSearch' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

describe('BibleSearchScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows the empty-query state before anything is typed', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('bible-search-empty-query')).toBeTruthy();
  });

  it('shows a no-results state for a query that matches nothing', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'xyznonexistentquery');
    await waitFor(() => expect(getByTestId('bible-search-no-results')).toBeTruthy());
  });

  it('shows matching results with a reference and matching text', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('bible-search-results')).toBeTruthy());
    expect(getByTestId('search-result-genesis-1-1')).toBeTruthy();
  });

  it('is case-insensitive and matches partial queries', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'GENE');
    await waitFor(() => expect(getByTestId('bible-search-results')).toBeTruthy());
    expect(getByTestId('search-result-genesis-1-1')).toBeTruthy();
  });

  it('opens the matched VERSE, not just its chapter, when a result is tapped', async () => {
    // M4: the reader takes an optional verse and opens at it. Landing at
    // the top of Psalm 119 for a match on verse 105 is the defect this
    // closes -- see ../reader/ReaderScreen.tsx.
    const { getByTestId, navigate } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('search-result-genesis-1-1')).toBeTruthy());

    await fireEvent.press(getByTestId('search-result-genesis-1-1'));

    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 1,
      verse: 1,
    });
  });

  it('clears results and shows the empty-query state when the input is cleared', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('bible-search-results')).toBeTruthy());

    await fireEvent.changeText(getByTestId('bible-search-input'), '');
    await waitFor(() => expect(getByTestId('bible-search-empty-query')).toBeTruthy());
  });

  /**
   * A ScrollView/FlatList defaults to keyboardShouldPersistTaps="never":
   * while a TextInput inside it has focus, the FIRST touch anywhere in the
   * scroll view is consumed dismissing the keyboard and never reaches the
   * control under the finger. The search field keeps focus while
   * results are showing, so the first tap on a result went nowhere.
   *
   * The native scroll view is what implements that, so there is nothing in
   * the JS test environment to simulate; what this pins is that the screen
   * never silently reverts to the broken default.
   */
  it('keeps taps alive so the first tap on a result navigates', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('bible-search-results')).toBeTruthy());
    expect(getByTestId('bible-search-results').props.keyboardShouldPersistTaps).toBe(
      'handled'
    );
  });

  it('has a round Back before the field', async () => {
    const { getByRole, goBack } = await renderScreen();
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('says how many results there are', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('bible-search-count')).toBeTruthy());
    expect(getByTestId('bible-search-count')).toHaveTextContent(/^\d+ results$/);
  });

  it('offers a clear button only once something is typed, and it empties the field', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();
    expect(queryByTestId('bible-search-clear')).toBeNull();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    expect(getByTestId('bible-search-clear')).toBeTruthy();
    await fireEvent.press(getByTestId('bible-search-clear'));
    expect(getByTestId('bible-search-input').props.value).toBe('');
    expect(getByTestId('bible-search-empty-query')).toBeTruthy();
    expect(queryByTestId('bible-search-clear')).toBeNull();
  });

  it('sets the matched words in bold, with no background wash, and shows two lines of the verse at most', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('search-result-genesis-1-1')).toBeTruthy());
    const row = within(getByTestId('search-result-genesis-1-1'));
    // The match is in the REFERENCE ("Genesis 1:1"); its words are the one nested Text.
    const bold = row
      .getByTestId('search-result-reference')
      .children.find((child) => typeof child !== 'string') as
      { props: { style: unknown } } | undefined;
    expect(bold).toBeDefined();
    const style = StyleSheet.flatten(bold?.props.style as never) as {
      fontWeight?: string;
      backgroundColor?: string;
    };
    expect(style.fontWeight).toBe('700');
    expect(style.backgroundColor).toBeUndefined();
    expect(row.getByTestId('search-result-text').props.numberOfLines).toBe(2);
  });

  it('names each result by its reference and its words, for a screen reader', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('search-result-genesis-1-1')).toBeTruthy());
    expect(getByTestId('search-result-genesis-1-1').props.accessibilityLabel).toMatch(
      /^Genesis 1:1\. /
    );
  });
});
