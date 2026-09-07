import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { BooksListScreen } from '../BooksListScreen';
import { BIBLE_BOOKS } from '../books';

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
  afterEach(() => jest.clearAllMocks());

  it('renders all 66 books', async () => {
    const { getByTestId } = await renderScreen();
    for (const book of BIBLE_BOOKS) {
      expect(getByTestId(`book-${book.id}`)).toBeTruthy();
    }
  });

  it('separates Old Testament and New Testament into their own sections', async () => {
    const { getByTestId, getByText } = await renderScreen();
    expect(getByTestId('bible-section-Old Testament')).toBeTruthy();
    expect(getByTestId('bible-section-New Testament')).toBeTruthy();
    expect(getByText('Old Testament')).toBeTruthy();
    expect(getByText('New Testament')).toBeTruthy();
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
    expect(flatStyle.backgroundColor).toBe('#F9FAFB');
  });

  it('renders with dark-mode colors when the device is in dark mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = await renderScreen();
    const list = getByTestId('bible-books-list');
    const flatStyle = Object.assign({}, ...[list.props.style].flat());
    expect(flatStyle.backgroundColor).toBe('#1F2937');
  });
});
