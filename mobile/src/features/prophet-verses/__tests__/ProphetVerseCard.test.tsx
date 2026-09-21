import React from 'react';
import { StyleSheet } from 'react-native';
import { cleanup, render } from '@testing-library/react-native';
import { ProphetVerseCard } from '../ProphetVerseCard';
import { useProphetVerse, type ProphetVerseState } from '../useProphetVerse';
import { usePreferences } from '../../../context/PreferencesContext';
import { fontFamilies, serifFor } from '../../../theme/tokens';
import type { ProphetVerse } from '../../../services/firebase/prophetVerses';

jest.mock('../../../services/firebase/app');
jest.mock('../../../context/PreferencesContext');
jest.mock('../useProphetVerse');

/**
 * The Prophet Verse block.
 *
 * The restraint is still the design -- no badge, no accent fill, no
 * reserved image frame. What CHANGED is the empty state. M5 rendered
 * nothing at all when no verse was published, and the test below used to
 * assert exactly that. A tester then looked for "Prophet Verse of the
 * Day" in the release build and reported the feature missing: complete,
 * and invisible to every church that had not published one yet, which on
 * day one is all of them.
 *
 * The assertion is reversed here rather than deleted, so the reversal is
 * legible to whoever reads this next: an empty prophet verse now renders
 * a NAMED, quiet card, and the name is what stops it reading as a second
 * copy of the Verse of the Day above it.
 */
function verse(partial: Partial<ProphetVerse> = {}): ProphetVerse {
  return {
    id: 'p1',
    title: 'A word for the church',
    reference: 'Isaiah 43:19',
    text: 'Behold, I will do a new thing.',
    attribution: null,
    imageUrl: null,
    publishAt: new Date('2026-04-01T06:00:00.000Z'),
    ...partial,
  };
}

function mockState(state: ProphetVerseState) {
  (useProphetVerse as jest.Mock).mockReturnValue(state);
}

/** Matches ../../../theme/__tests__/components.test.tsx's `flat()`. */
function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

function fontOf(node: { props: { style?: unknown } }): string | number | undefined {
  return flat(node).fontFamily;
}

beforeEach(() => {
  jest.clearAllMocks();
  (usePreferences as jest.Mock).mockReturnValue({
    isDark: false,
    appLanguage: 'en',
    bibleMode: 'te',
  });
});

afterEach(async () => {
  await cleanup();
});

describe('when there is nothing to show', () => {
  it('still renders the section, named, so the feature is visible', async () => {
    // REVERSED from M5, deliberately -- see this file's header.
    mockState({ status: 'empty' });
    const screen = await render(<ProphetVerseCard />);
    expect(screen.getByTestId('prophet-verse-empty')).toBeTruthy();
    expect(screen.getByText('Prophet Verse of the Day')).toBeTruthy();
    expect(screen.getByText('No prophet verse today')).toBeTruthy();
  });

  it('invents no devotional to fill the space', async () => {
    mockState({ status: 'empty' });
    const screen = await render(<ProphetVerseCard />);
    // Nothing that could be mistaken for scripture or for a word from
    // the church -- only a statement that there is none today.
    expect(screen.queryByTestId('prophet-verse-text')).toBeNull();
    expect(screen.queryByTestId('prophet-verse-reference')).toBeNull();
  });

  it('shows only a quiet spinner while loading', async () => {
    mockState({ status: 'loading' });
    const screen = await render(<ProphetVerseCard />);
    expect(screen.getByTestId('prophet-verse-loading')).toBeTruthy();
    expect(screen.queryByTestId('prophet-verse-card')).toBeNull();
  });
});

describe('a published verse', () => {
  it('shows its section label, title, reference and text', async () => {
    mockState({ status: 'ready', verse: verse() });
    const screen = await render(<ProphetVerseCard />);
    // "of the Day" is asserted deliberately: it is what tells a member
    // this block is not a second copy of the Verse of the Day above it.
    expect(screen.getByTestId('prophet-verse-section-title').props.children).toBe(
      'Prophet Verse of the Day'
    );
    expect(screen.getByTestId('prophet-verse-title').props.children).toBe(
      'A word for the church'
    );
    expect(screen.getByTestId('prophet-verse-reference').props.children).toBe(
      'Isaiah 43:19'
    );
    expect(screen.getByTestId('prophet-verse-text').props.children).toBe(
      'Behold, I will do a new thing.'
    );
  });

  it('gives the section label the heading role, so it is navigable', async () => {
    mockState({ status: 'ready', verse: verse() });
    const screen = await render(<ProphetVerseCard />);
    expect(
      screen.getByTestId('prophet-verse-section-title').props.accessibilityRole
    ).toBe('header');
  });

  it('collapses the image area entirely when there is no image', async () => {
    mockState({ status: 'ready', verse: verse() });
    const screen = await render(<ProphetVerseCard />);
    expect(screen.queryByTestId('prophet-verse-image')).toBeNull();
  });

  it('shows an external image with an accessible label when there is one', async () => {
    mockState({
      status: 'ready',
      verse: verse({ imageUrl: 'https://example.org/word.jpg' }),
    });
    const screen = await render(<ProphetVerseCard />);
    const image = screen.getByTestId('prophet-verse-image');
    expect(image.props.source).toEqual({ uri: 'https://example.org/word.jpg' });
    expect(image.props.accessibilityLabel).toBe('Illustration for this prophet verse');
  });

  it('omits the reference and the attribution when they are absent', async () => {
    mockState({ status: 'ready', verse: verse({ reference: '', attribution: null }) });
    const screen = await render(<ProphetVerseCard />);
    expect(screen.queryByTestId('prophet-verse-reference')).toBeNull();
    expect(screen.queryByTestId('prophet-verse-attribution')).toBeNull();
  });

  it('shows the attribution when the church supplied one', async () => {
    mockState({ status: 'ready', verse: verse({ attribution: 'Pastor Samuel' }) });
    const screen = await render(<ProphetVerseCard />);
    expect(screen.getByTestId('prophet-verse-attribution').props.children).toBe(
      'Pastor Samuel'
    );
  });
});

describe('typography', () => {
  it('sets administrator-written text in the interface family, never a serif', async () => {
    // The text is of unknown script and may mix Telugu and Latin; Noto
    // Serif Telugu has no Latin letters. See
    // ../../daily-verses/DailyVerseCard.tsx's header.
    mockState({
      status: 'ready',
      verse: verse({ text: 'దేవుడు says a new thing' }),
    });
    const screen = await render(<ProphetVerseCard />);
    const font = fontOf(screen.getByTestId('prophet-verse-text'));
    expect(font).toBe(fontFamilies.interfaceRegular);
    expect(font).not.toBe(serifFor('te', 'regular'));
  });

  it('follows the script of the text, not the interface language', async () => {
    // A Telugu passage under an English interface still needs Telugu's
    // extra leading.
    mockState({ status: 'ready', verse: verse({ text: 'దేవుడు' }) });
    const screen = await render(<ProphetVerseCard />);
    const telugu = flat(screen.getByTestId('prophet-verse-text'));
    await cleanup();

    mockState({ status: 'ready', verse: verse({ text: 'Behold' }) });
    const englishScreen = await render(<ProphetVerseCard />);
    const english = flat(englishScreen.getByTestId('prophet-verse-text'));
    expect(telugu.lineHeight).toBeGreaterThan(english.lineHeight as number);
  });
});
