import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { darkTokens } from '../../../theme/tokens';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { ChaptersListScreen } from '../ChaptersListScreen';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// See BooksListScreen.test.tsx's equivalent comment: ChaptersListScreen
// now reads isDark from usePreferences() (Day 9), so it needs the real
// provider stack, which still falls back to this same deep useColorScheme
// mock when signed out / nothing stored.
jest.mock('../../../services/firebase/app');

async function renderScreen(bookId: string) {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <ChaptersListScreen
          navigation={{ navigate, goBack } as never}
          route={
            { key: 'BibleChapters', name: 'BibleChapters', params: { bookId } } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

describe('ChaptersListScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders the single chapter of a one-chapter book', async () => {
    const { getByTestId, queryByTestId } = await renderScreen('jude');
    expect(getByTestId('chapter-1')).toBeTruthy();
    expect(queryByTestId('chapter-2')).toBeNull();
  });

  it('renders every chapter of a multi-chapter book', async () => {
    const { getByTestId } = await renderScreen('genesis');
    expect(getByTestId('chapter-1')).toBeTruthy();
    expect(getByTestId('chapter-25')).toBeTruthy();
    expect(getByTestId('chapter-50')).toBeTruthy();
  });

  it('renders all 150 chapters for the largest book (Psalms)', async () => {
    const { getByTestId } = await renderScreen('psalms');
    expect(getByTestId('chapter-1')).toBeTruthy();
    expect(getByTestId('chapter-150')).toBeTruthy();
  });

  it('navigates to BibleChapter with the tapped chapter number', async () => {
    const { getByTestId, navigate } = await renderScreen('genesis');
    await fireEvent.press(getByTestId('chapter-3'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'genesis',
      chapterNumber: 3,
    });
  });

  it('shows a not-found state for an unknown book id', async () => {
    const { getByTestId } = await renderScreen('not-a-book');
    expect(getByTestId('chapters-invalid-book')).toBeTruthy();
  });

  it('renders with dark-mode colors when the device is in dark mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderScreen('genesis');
    const list = getByTestId('bible-chapters-list');
    const flatStyle = Object.assign({}, ...[list.props.style].flat());
    expect(flatStyle.backgroundColor).toBe(darkTokens.paper);
  });

  it('has a top bar named for the book, in the Bible’s language, whose Back leaves the screen', async () => {
    const { getByText, getByRole, goBack } = await renderScreen('genesis');
    // The default Bible is Telugu, so the book is named in Telugu.
    expect(getByText('ఆదికాండము')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('says how many chapters the book has', async () => {
    const { getByText } = await renderScreen('genesis');
    expect(getByText('50 chapters')).toBeTruthy();
  });

  it('announces each tile as its chapter', async () => {
    const { getByRole } = await renderScreen('psalms');
    expect(getByRole('button', { name: 'Chapter 119' })).toBeTruthy();
  });

  it('lays the tiles out five to a row, the last row filled out with empty slots', async () => {
    const { getByTestId } = await renderScreen('genesis');
    // 50 chapters is ten full rows; Jude's single chapter is one tile and four empty slots.
    const rowOf = (id: string) =>
      (getByTestId(id).parent as unknown as { children: unknown[] }).children;
    expect(rowOf('chapter-1')).toHaveLength(5);
  });

  it('puts the single tile of a one-chapter book in the same column a longer book’s first would be', async () => {
    const { getByTestId } = await renderScreen('jude');
    const row = (getByTestId('chapter-1').parent as unknown as { children: unknown[] })
      .children;
    expect(row).toHaveLength(5);
  });
});
