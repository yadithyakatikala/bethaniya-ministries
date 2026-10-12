import React from 'react';
import { StyleSheet } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ContinueReading } from '../ContinueReading';
import { useAuth } from '../../../../context/AuthContext';
import { usePreferences } from '../../../../context/PreferencesContext';
import { subscribeToReadingPosition } from '../../../../services/firebase/readingPosition';
import { lightTokens, serifFor } from '../../../../theme';

jest.mock('../../../../services/firebase/app');
jest.mock('../../../../services/firebase/readingPosition');
jest.mock('../../../../context/AuthContext');
jest.mock('../../../../context/PreferencesContext');

/**
 * "Continue reading": where the member left off, offered rather than
 * imposed -- a thin gold bar, a quiet label, the book and chapter in the
 * serif. It has to be INVISIBLE until there is something to continue (an
 * empty card is worse than none), and when it is invisible it must leave
 * nothing behind: its outer margin is the row's own, so Home's rhythm has no
 * hole where it would have been.
 */
function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

function signedIn(uid: string | null = 'u1') {
  (useAuth as jest.Mock).mockReturnValue(
    uid
      ? { status: 'authenticated', user: { uid } }
      : { status: 'unauthenticated', user: null }
  );
}

function prefs(appLanguage: 'en' | 'te', bibleMode: 'en' | 'te' | 'bilingual') {
  (usePreferences as jest.Mock).mockReturnValue({
    isDark: false,
    appLanguage,
    bibleMode,
  });
}

function savedPosition(bookId: string, chapter = 3, verse = 16) {
  (subscribeToReadingPosition as jest.Mock).mockImplementation(
    (_uid, translationId, onNext) => {
      onNext({ translationId, bookId, chapter, verse, updatedAt: null });
      return jest.fn();
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  signedIn();
  prefs('en', 'en');
  (subscribeToReadingPosition as jest.Mock).mockImplementation((_uid, _tr, onNext) => {
    onNext(null);
    return jest.fn();
  });
});

afterEach(async () => {
  await cleanup();
});

describe('when there is nothing to continue', () => {
  it('renders nothing before the member has read anything', async () => {
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    expect(screen.queryByTestId('continue-reading-button')).toBeNull();
  });

  it('renders nothing while signed out, and does not even listen', async () => {
    signedIn(null);
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    expect(screen.queryByTestId('continue-reading-button')).toBeNull();
    expect(subscribeToReadingPosition).not.toHaveBeenCalled();
  });

  it('renders nothing for a book it has no name for, rather than a blank title', async () => {
    savedPosition('not-a-book');
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    expect(screen.queryByTestId('continue-reading-button')).toBeNull();
  });
});

describe('with a saved position', () => {
  it('names the book and the chapter under a quiet label', async () => {
    savedPosition('john', 3, 16);
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('continue-reading-button')).toBeTruthy()
    );

    expect(screen.getByText('Continue reading')).toBeTruthy();
    expect(screen.getByText('John 3')).toBeTruthy();
    // One button, and its spoken name carries both the label and the place.
    const row = screen.getByTestId('continue-reading-button');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toBe('Continue reading. John 3');
  });

  it('opens the reader at exactly the saved place', async () => {
    savedPosition('john', 3, 16);
    const onOpen = jest.fn();
    const screen = await render(<ContinueReading onOpen={onOpen} />);
    await waitFor(() =>
      expect(screen.getByTestId('continue-reading-button')).toBeTruthy()
    );

    await fireEvent.press(screen.getByTestId('continue-reading-button'));
    expect(onOpen).toHaveBeenCalledWith('john', 3, 16);
  });

  it('is a two-line row: 64 high at the least', async () => {
    savedPosition('john');
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('continue-reading-button')).toBeTruthy()
    );
    expect(flat(screen.getByTestId('continue-reading-button')).minHeight).toBe(64);
  });

  it('sets the book in the serif at 21/28', async () => {
    savedPosition('john');
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('John 3')).toBeTruthy());
    expect(flat(screen.getByText('John 3'))).toMatchObject({
      fontFamily: serifFor('en', 'semiBold'),
      fontSize: 21,
      lineHeight: 28,
      color: lightTokens.ink,
    });
  });

  it("names the book in the BIBLE's script and sets it in that script's serif", async () => {
    // A Telugu Bible under an English interface: the book is named in
    // Telugu, so it takes the Telugu serif (19/32, room for its marks).
    prefs('en', 'te');
    savedPosition('john');
    const screen = await render(<ContinueReading onOpen={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('continue-reading-button')).toBeTruthy()
    );

    const label = screen.getByTestId('continue-reading-button').props
      .accessibilityLabel as string;
    const book = label.replace('Continue reading. ', '');
    expect(book).toMatch(/[ఀ-౿]/u);
    expect(flat(screen.getByText(book))).toMatchObject({
      fontFamily: serifFor('te', 'semiBold'),
      fontSize: 19,
      lineHeight: 32,
    });
  });
});

describe('which translation it listens to', () => {
  it.each([
    ['en', 'en'],
    ['te', 'te'],
    // Two Bibles at once: the first (Telugu) is the one the position is kept for.
    ['bilingual', 'te'],
  ] as const)("listens to the %s Bible's position as %s", async (mode, translation) => {
    prefs('en', mode);
    await render(<ContinueReading onOpen={jest.fn()} />);
    expect(subscribeToReadingPosition).toHaveBeenCalledWith(
      'u1',
      translation,
      expect.any(Function),
      expect.any(Function)
    );
  });
});

describe('its outer style', () => {
  it('is applied to the row itself, so a missing row leaves no margin behind', async () => {
    savedPosition('john');
    const screen = await render(
      <ContinueReading onOpen={jest.fn()} style={{ marginTop: 32 }} />
    );
    await waitFor(() =>
      expect(screen.getByTestId('continue-reading-button')).toBeTruthy()
    );
    expect(flat(screen.getByTestId('continue-reading-button')).marginTop).toBe(32);
    await cleanup();

    (subscribeToReadingPosition as jest.Mock).mockImplementation((_uid, _tr, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const empty = await render(
      <ContinueReading onOpen={jest.fn()} style={{ marginTop: 32 }} />
    );
    // Nothing at all in the tree: not an empty wrapper with a 32-point margin.
    expect(empty.toJSON()).toBeNull();
  });
});
