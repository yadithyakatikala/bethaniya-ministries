import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { BibleSearchScreen } from '../BibleSearchScreen';

jest.mock('../../../services/firebase/app');

async function renderScreen() {
  const navigate = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <BibleSearchScreen
          navigation={{ navigate } as never}
          route={{ key: 'BibleSearch', name: 'BibleSearch' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate };
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

  it('navigates to the matched chapter when a result is tapped', async () => {
    const { getByTestId, navigate } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('search-result-genesis-1-1')).toBeTruthy());

    await fireEvent.press(getByTestId('search-result-genesis-1-1'));

    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 1,
    });
  });

  it('clears results and shows the empty-query state when the input is cleared', async () => {
    const { getByTestId } = await renderScreen();
    await fireEvent.changeText(getByTestId('bible-search-input'), 'genesis');
    await waitFor(() => expect(getByTestId('bible-search-results')).toBeTruthy());

    await fireEvent.changeText(getByTestId('bible-search-input'), '');
    await waitFor(() => expect(getByTestId('bible-search-empty-query')).toBeTruthy());
  });
});
