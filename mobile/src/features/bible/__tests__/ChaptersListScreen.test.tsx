import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { ChaptersListScreen } from '../ChaptersListScreen';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

async function renderScreen(bookId: string) {
  const navigate = jest.fn();
  const utils = await render(
    <ChaptersListScreen
      navigation={{ navigate } as never}
      route={{ key: 'BibleChapters', name: 'BibleChapters', params: { bookId } } as never}
    />
  );
  return { ...utils, navigate };
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
    expect(flatStyle.backgroundColor).toBe('#1F2937');
  });
});
