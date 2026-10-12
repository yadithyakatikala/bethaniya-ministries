import React from 'react';
import { StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { useMemberIdentity } from '../../../context/useMemberIdentity';
import { getChapter } from '../../bible/dataSource';
import {
  fontFamilies,
  highlightTints,
  lightTokens,
  serifFor,
} from '../../../theme/tokens';
import { SavedVersesScreen } from '../SavedVersesScreen';
import {
  subscribeToBookmarks,
  subscribeToHighlights,
  subscribeToVerseNotes,
} from '../../../services/firebase/readerAnnotations';

jest.mock('../../../services/firebase/app');
jest.mock('../../../context/useMemberIdentity');
jest.mock('../../../services/firebase/readerAnnotations');

/**
 * Notes, highlights and bookmarks as lists: the member's own verses, newest
 * first, each opening the Bible at that verse. The words of a verse come from
 * the Bible bundled on the phone, in the translation the annotation was made
 * in -- nothing is fetched to show them.
 */
type Emit = (items: unknown[]) => void;
type Fail = (error: unknown) => void;

let emit: Record<string, Emit>;
let fail: Record<string, Fail>;
let unsubscribe: Record<string, jest.Mock>;

function wire(name: string, fn: jest.Mock) {
  unsubscribe[name] = jest.fn();
  fn.mockImplementation((_uid: string, next: Emit, onError: Fail) => {
    emit[name] = next;
    fail[name] = onError;
    return unsubscribe[name];
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  emit = {};
  fail = {};
  unsubscribe = {};
  wire('notes', subscribeToVerseNotes as jest.Mock);
  wire('highlights', subscribeToHighlights as jest.Mock);
  wire('bookmarks', subscribeToBookmarks as jest.Mock);
  (useMemberIdentity as jest.Mock).mockReturnValue({
    uid: 'u1',
    displayName: 'Grace',
    canPost: true,
    suspended: false,
  });
});

afterEach(async () => {
  await cleanup();
});

/** Delivers a snapshot to a listener the way Firestore would: outside the test, inside act. */
async function push(name: string, items: unknown[]) {
  await act(async () => emit[name](items));
}

async function pull(name: string, error: unknown) {
  await act(async () => fail[name](error));
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

async function renderScreen(kind?: 'notes' | 'highlights' | 'bookmarks') {
  const goBack = jest.fn();
  const navigate = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <SavedVersesScreen
          navigation={{ goBack, navigate } as never}
          route={
            {
              key: 'SavedVerses',
              name: 'SavedVerses',
              params: kind ? { kind } : undefined,
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, goBack, navigate };
}

// Local noon: the same calendar day in every timezone the suite runs in.
const day = (month: number, date: number) => new Date(2026, month, date, 12, 0);

const john316 = {
  translationId: 'en',
  bookId: 'john',
  chapter: 3,
  verse: 16,
};
const psalm231 = { translationId: 'en', bookId: 'psalms', chapter: 23, verse: 1 };

function verseText(
  bookId: string,
  chapter: number,
  verse: number,
  language: 'en' | 'te'
) {
  return getChapter(bookId, chapter, language)!.verses.find((v) => v.number === verse)!
    .text;
}

describe('the screen', () => {
  it('has a Back that leaves, and a Saved title', async () => {
    const { getByTestId, getByText, goBack } = await renderScreen();
    expect(getByText('Saved')).toBeTruthy();
    await fireEvent.press(getByTestId('top-bar-back'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('offers Notes, Highlights and Bookmarks as one three-part choice, Notes chosen', async () => {
    const { getByTestId } = await renderScreen();
    const group = getByTestId('saved-kind');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe('Saved');

    const options = ['notes', 'highlights', 'bookmarks'].map((kind) =>
      getByTestId(`saved-kind-${kind}`)
    );
    expect(options.map((o) => o.props.accessibilityLabel)).toEqual([
      'Notes',
      'Highlights',
      'Bookmarks',
    ]);
    expect(options.map((o) => o.props.accessibilityState.selected)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('chooses the part it was opened on', async () => {
    const { getByTestId } = await renderScreen('bookmarks');
    expect(getByTestId('saved-kind-bookmarks').props.accessibilityState.selected).toBe(
      true
    );
    expect(getByTestId('saved-kind-notes').props.accessibilityState.selected).toBe(false);
  });

  it.each([
    ['notes', 'saved-verses-loading'],
    ['highlights', 'saved-verses-loading'],
    ['bookmarks', 'saved-verses-loading'],
  ] as const)(
    'opens on %s when asked to, and waits with a skeleton',
    async (kind, loading) => {
      const { getByTestId } = await renderScreen(kind);
      expect(getByTestId(loading, { includeHiddenElements: true })).toBeTruthy();
      expect(subscribeToVerseNotes as jest.Mock).toHaveBeenCalledTimes(
        kind === 'notes' ? 1 : 0
      );
      expect(subscribeToHighlights as jest.Mock).toHaveBeenCalledTimes(
        kind === 'highlights' ? 1 : 0
      );
      expect(subscribeToBookmarks as jest.Mock).toHaveBeenCalledTimes(
        kind === 'bookmarks' ? 1 : 0
      );
    }
  );

  it('opens on Notes when it is not told', async () => {
    await renderScreen();
    expect(subscribeToVerseNotes).toHaveBeenCalledTimes(1);
    expect(subscribeToHighlights).not.toHaveBeenCalled();
  });

  it('listens for the signed-in member’s own verses only', async () => {
    await renderScreen('notes');
    expect((subscribeToVerseNotes as jest.Mock).mock.calls[0][0]).toBe('u1');
  });

  it('does not listen for anyone when no member is known', async () => {
    (useMemberIdentity as jest.Mock).mockReturnValue({
      uid: null,
      displayName: '',
      canPost: false,
      suspended: false,
    });
    await renderScreen('notes');
    expect(subscribeToVerseNotes).not.toHaveBeenCalled();
  });

  it('switches list when another part is chosen, letting go of the last listener', async () => {
    const { getByText, getByTestId } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await fireEvent.press(getByText('Highlights'));
    await waitFor(() => expect(subscribeToHighlights).toHaveBeenCalledTimes(1));
    expect(unsubscribe.notes).toHaveBeenCalledTimes(1);
    expect(
      getByTestId('saved-verses-loading', { includeHiddenElements: true })
    ).toBeTruthy();

    await fireEvent.press(getByText('Bookmarks'));
    await waitFor(() => expect(subscribeToBookmarks).toHaveBeenCalledTimes(1));
    expect(unsubscribe.highlights).toHaveBeenCalledTimes(1);
  });
});

describe('notes', () => {
  const notes = [
    {
      id: 'n-old',
      ...john316,
      text: 'He gave: the verb is past tense.',
      createdAt: day(1, 9),
      updatedAt: day(1, 9),
    },
    {
      id: 'n-new',
      ...psalm231,
      text: 'Prayed about this one in a hard week.',
      createdAt: day(1, 2),
      updatedAt: day(2, 20),
    },
  ];

  it('lists them newest first -- by when they were last EDITED -- and shows each with its verse', async () => {
    const { getByTestId, getAllByTestId } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', notes);
    await waitFor(() => expect(getByTestId('saved-verses-list')).toBeTruthy());

    const rows = getAllByTestId(/^saved-verse-n-(new|old)$/);
    expect(rows.map((row) => row.props.testID)).toEqual([
      'saved-verse-n-new',
      'saved-verse-n-old',
    ]);
  });

  it('shows the reference, the date, the verse and the note itself', async () => {
    const { getByTestId, getByText } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', [notes[0]]);
    await waitFor(() => expect(getByTestId('saved-verse-n-old')).toBeTruthy());

    expect(getByText('John 3:16')).toBeTruthy();
    expect(getByTestId('saved-verse-text-n-old')).toHaveTextContent(
      verseText('john', 3, 16, 'en')
    );
    expect(getByTestId('saved-note-n-old')).toHaveTextContent(
      'He gave: the verb is past tense.'
    );
  });

  it('keeps the verse quiet and the member’s own words in ink: the note is the point', async () => {
    const { getByTestId } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', [notes[0]]);
    await waitFor(() => expect(getByTestId('saved-verse-n-old')).toBeTruthy());

    expect(flat(getByTestId('saved-verse-text-n-old'))).toMatchObject({
      color: lightTokens.inkMuted,
      fontSize: 15,
      lineHeight: 23,
    });
    expect(getByTestId('saved-verse-text-n-old').props.numberOfLines).toBe(2);
    expect(flat(getByTestId('saved-note-n-old')).color).toBe(lightTokens.ink);
  });

  it('sets the note itself in the interface face at 15.5/23: plain words beside the serif verse', async () => {
    const { getByTestId } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', [notes[0]]);
    await waitFor(() => expect(getByTestId('saved-note-n-old')).toBeTruthy());
    expect(flat(getByTestId('saved-note-n-old'))).toMatchObject({
      fontFamily: fontFamilies.interfaceRegular,
      fontSize: 15.5,
      lineHeight: 23,
    });
  });

  it('shows the date as the day and month, as the list is drawn: "9 Oct"', async () => {
    const { getByTestId, getByText } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', [notes[0]]);
    await waitFor(() => expect(getByTestId('saved-verse-n-old')).toBeTruthy());
    // 9 February this year: day first, no year.
    expect(getByText(/^9 Feb( \d{4})?$/)).toBeTruthy();
    expect(getByTestId('saved-verse-n-old').props.accessibilityLabel).toMatch(
      /^John 3:16\. 9 Feb/
    );
  });

  it('is empty in words, for notes', async () => {
    const { getByTestId, getByText } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', []);
    await waitFor(() => expect(getByTestId('saved-verses-empty')).toBeTruthy());
    expect(getByText('No notes yet')).toBeTruthy();
  });

  it('says it could not load, and does not show an empty list for a failed read', async () => {
    const { getByTestId, queryByTestId } = await renderScreen('notes');
    await waitFor(() => expect(fail.notes).toBeDefined());
    await pull('notes', { code: 'unavailable' });
    await waitFor(() => expect(getByTestId('saved-verses-error')).toBeTruthy());
    expect(queryByTestId('saved-verses-empty')).toBeNull();
  });
});

describe('highlights', () => {
  it('shows the verse on the tint the member chose, and nothing else but its reference', async () => {
    const { getByTestId, queryByTestId } = await renderScreen('highlights');
    await waitFor(() => expect(emit.highlights).toBeDefined());
    await push('highlights', [
      { id: 'h1', ...john316, colour: 'blue', createdAt: day(1, 9) },
      { id: 'h2', ...psalm231, colour: 'yellow', createdAt: day(1, 3) },
    ]);
    await waitFor(() => expect(getByTestId('saved-verse-h1')).toBeTruthy());

    expect(flat(getByTestId('saved-verse-text-h1')).backgroundColor).toBe(
      highlightTints.light.blue
    );
    expect(flat(getByTestId('saved-verse-text-h2')).backgroundColor).toBe(
      highlightTints.light.yellow
    );
    // A highlight has no note.
    expect(queryByTestId('saved-note-h1')).toBeNull();
  });

  it('sets the verse in the serif at 17/26, with a little room round it on its tint', async () => {
    const { getByTestId } = await renderScreen('highlights');
    await waitFor(() => expect(emit.highlights).toBeDefined());
    await push('highlights', [
      { id: 'h1', ...john316, colour: 'green', createdAt: day(1, 9) },
    ]);
    await waitFor(() => expect(getByTestId('saved-verse-h1')).toBeTruthy());
    expect(flat(getByTestId('saved-verse-text-h1'))).toMatchObject({
      fontFamily: serifFor('en', 'regular'),
      fontSize: 17,
      lineHeight: 26,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginHorizontal: -8,
      borderRadius: 4,
    });
  });

  it('leaves the verse in ink on its tint, with room for four lines', async () => {
    const { getByTestId } = await renderScreen('highlights');
    await waitFor(() => expect(emit.highlights).toBeDefined());
    await push('highlights', [
      { id: 'h1', ...john316, colour: 'green', createdAt: day(1, 9) },
    ]);
    await waitFor(() => expect(getByTestId('saved-verse-h1')).toBeTruthy());
    expect(flat(getByTestId('saved-verse-text-h1')).color).toBe(lightTokens.ink);
    expect(getByTestId('saved-verse-text-h1').props.numberOfLines).toBe(4);
  });

  it('is empty in words, for highlights', async () => {
    const { getByTestId, getByText } = await renderScreen('highlights');
    await waitFor(() => expect(emit.highlights).toBeDefined());
    await push('highlights', []);
    await waitFor(() => expect(getByTestId('saved-verses-empty')).toBeTruthy());
    expect(getByText('No highlights yet')).toBeTruthy();
  });
});

describe('bookmarks', () => {
  it('shows the reference, the date and the verse', async () => {
    const { getByTestId, getByText } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', [{ id: 'b1', ...psalm231, createdAt: day(5, 1) }]);
    await waitFor(() => expect(getByTestId('saved-verse-b1')).toBeTruthy());
    expect(getByText('Psalms 23:1')).toBeTruthy();
    expect(getByTestId('saved-verse-text-b1')).toHaveTextContent(
      verseText('psalms', 23, 1, 'en')
    );
    expect(getByTestId('saved-verse-text-b1').props.numberOfLines).toBe(3);
    expect(flat(getByTestId('saved-verse-text-b1'))).toMatchObject({
      fontFamily: serifFor('en', 'regular'),
      fontSize: 17,
      lineHeight: 26,
      color: lightTokens.ink,
    });
  });

  it('is empty in words, for bookmarks', async () => {
    const { getByTestId, getByText } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', []);
    await waitFor(() => expect(getByTestId('saved-verses-empty')).toBeTruthy());
    expect(getByText('No bookmarks yet')).toBeTruthy();
  });
});

describe('opening a verse', () => {
  it('opens the Bible at exactly that chapter and verse', async () => {
    const { getByTestId, navigate } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', [{ id: 'b1', ...john316, createdAt: day(5, 1) }]);
    await waitFor(() => expect(getByTestId('saved-verse-b1')).toBeTruthy());

    await fireEvent.press(getByTestId('saved-verse-b1'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'john',
      chapterNumber: 3,
      verse: 16,
    });
  });

  it('is one button whose spoken name is the reference and the date', async () => {
    const { getByTestId } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', [{ id: 'b1', ...john316, createdAt: day(5, 1) }]);
    await waitFor(() => expect(getByTestId('saved-verse-b1')).toBeTruthy());
    const row = getByTestId('saved-verse-b1');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toMatch(/^John 3:16\. /);
  });
});

describe('a verse in the other translation, or one that cannot be found', () => {
  it('names the book and sets the verse in the language it was saved in', async () => {
    const { getByTestId } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', [
      {
        id: 'b-te',
        translationId: 'te',
        bookId: 'john',
        chapter: 3,
        verse: 16,
        createdAt: day(5, 1),
      },
    ]);
    await waitFor(() => expect(getByTestId('saved-verse-b-te')).toBeTruthy());

    expect(getByTestId('saved-verse-b-te').props.accessibilityLabel).toMatch(/[ఀ-౿]/u);
    const text = getByTestId('saved-verse-text-b-te');
    expect(text).toHaveTextContent(verseText('john', 3, 16, 'te'));
    // The Telugu serif at 16/30: its marks stack above and below the line.
    expect(flat(text)).toMatchObject({
      fontFamily: serifFor('te', 'regular'),
      fontSize: 16,
      lineHeight: 30,
    });
  });

  it('still shows the reference and the note when the verse text cannot be found', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderScreen('notes');
    await waitFor(() => expect(emit.notes).toBeDefined());
    await push('notes', [
      {
        id: 'n-gone',
        translationId: 'en',
        bookId: 'john',
        chapter: 999,
        verse: 1,
        text: 'A note on a verse that is not in the bundle.',
        createdAt: day(1, 1),
        updatedAt: day(1, 1),
      },
    ]);
    await waitFor(() => expect(getByTestId('saved-verse-n-gone')).toBeTruthy());
    expect(getByText('John 999:1')).toBeTruthy();
    expect(queryByTestId('saved-verse-text-n-gone')).toBeNull();
    expect(getByTestId('saved-note-n-gone')).toHaveTextContent(
      'A note on a verse that is not in the bundle.'
    );
  });

  it('shows the slug rather than a blank when the book is unknown', async () => {
    const { getByTestId, getByText } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', [
      {
        id: 'b-x',
        translationId: 'en',
        bookId: 'not-a-book',
        chapter: 1,
        verse: 1,
        createdAt: null,
      },
    ]);
    await waitFor(() => expect(getByTestId('saved-verse-b-x')).toBeTruthy());
    expect(getByText('not-a-book 1:1')).toBeTruthy();
  });

  it('leaves the date out when the record has none', async () => {
    const { getByTestId } = await renderScreen('bookmarks');
    await waitFor(() => expect(emit.bookmarks).toBeDefined());
    await push('bookmarks', [{ id: 'b1', ...john316, createdAt: null }]);
    await waitFor(() => expect(getByTestId('saved-verse-b1')).toBeTruthy());
    expect(getByTestId('saved-verse-b1').props.accessibilityLabel).toBe('John 3:16');
  });
});
