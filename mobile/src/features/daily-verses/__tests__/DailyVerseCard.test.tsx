import React from 'react';
import { Share, StyleSheet } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { DailyVerseCard } from '../DailyVerseCard';
import { usePreferences } from '../../../context/PreferencesContext';
import { useVerseOfTheDay, type VerseOfTheDayState } from '../useVerseOfTheDay';
import { fontFamilies, serifFor } from '../../../theme/tokens';
import type { VotdContent } from '../votdResolver';

jest.mock('../../../services/firebase/app');
jest.mock('../../../context/PreferencesContext');
jest.mock('../useVerseOfTheDay');

/**
 * The card, state by state.
 *
 * The resolving is ../votdResolver.ts's and the plumbing is
 * ../useVerseOfTheDay.ts's, both tested on their own. This file is about
 * what a member actually sees -- including the typographic rule that
 * corpus text takes the scripture serif and an administrator's own text
 * does not, which is the difference between a readable Telugu verse and a
 * line of substituted glyphs.
 */
function mockState(state: VerseOfTheDayState) {
  (useVerseOfTheDay as jest.Mock).mockReturnValue(state);
}

function content(partial: Partial<VotdContent> = {}): VotdContent {
  return {
    source: 'pool',
    reference: 'John 3:16',
    body: { kind: 'text', language: 'en', text: 'For God so loved the world...' },
    imageUrl: null,
    label: '16',
    citation: { bookName: 'John', chapter: 3, label: '16' },
    ...partial,
  };
}

function ready(partial: Partial<VotdContent> = {}): VerseOfTheDayState {
  return { status: 'ready', content: content(partial), dateKey: '2026-04-03' };
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
    bibleMode: 'en',
  });
});

afterEach(async () => {
  await cleanup();
});

describe('the states', () => {
  it('shows a labelled loading state, not a bare spinner', async () => {
    mockState({ status: 'loading' });
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-loading')).toBeTruthy();
    expect(screen.getByText("Loading today's verse")).toBeTruthy();
  });

  it('shows the shared empty state only when nothing at all could be resolved', async () => {
    mockState({ status: 'empty' });
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-empty')).toBeTruthy();
    // NOT "no verse set for today" -- with automation there is always one.
    expect(screen.getByText("Today's verse could not be loaded.")).toBeTruthy();
  });

  it('renders the verse text and its reference', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-card')).toBeTruthy();
    expect(screen.getByText('For God so loved the world...')).toBeTruthy();
    expect(screen.getByTestId('daily-verse-reference').props.children).toBe('John 3:16');
    expect(screen.queryByTestId('daily-verse-image')).toBeNull();
  });

  it("renders an override's image with an accessible label", async () => {
    mockState(
      ready({
        source: 'override',
        citation: null,
        imageUrl: 'https://example.org/verse.jpg',
      })
    );
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-image').props.accessibilityLabel).toBe(
      "Illustration for today's verse"
    );
  });
});

describe('the typeface follows where the text came from', () => {
  it('sets a corpus verse in the scripture serif', async () => {
    mockState(ready({ body: { kind: 'text', language: 'te', text: 'దేవుడు' } }));
    const screen = await render(<DailyVerseCard />);
    expect(fontOf(screen.getByTestId('daily-verse-text'))).toBe(
      serifFor('te', 'regular')
    );
  });

  it("sets an administrator's own text in the interface family, which covers both scripts", async () => {
    // Noto Serif Telugu has no Latin letters and Noto Serif no Telugu
    // ones, so a mixed-script override set in either would lose half its
    // characters to a substituted face.
    mockState(
      ready({
        source: 'override',
        citation: null,
        body: { kind: 'text', language: 'te', text: 'దేవుడు loved the world' },
      })
    );
    const screen = await render(<DailyVerseCard />);
    expect(fontOf(screen.getByTestId('daily-verse-text'))).toBe(
      fontFamilies.interfaceRegular
    );
  });
});

describe('bilingual', () => {
  it('renders each language as its own node, in its own face', async () => {
    mockState(ready({ body: { kind: 'paired', english: 'For God', telugu: 'దేవుడు' } }));
    const screen = await render(<DailyVerseCard />);
    expect(fontOf(screen.getByTestId('daily-verse-english'))).toBe(
      serifFor('en', 'regular')
    );
    expect(fontOf(screen.getByTestId('daily-verse-telugu'))).toBe(
      serifFor('te', 'regular')
    );
    expect(screen.queryByTestId('daily-verse-not-in-translation')).toBeNull();
  });

  it('says the Telugu text is absent when that is the reason', async () => {
    mockState(
      ready({
        body: {
          kind: 'englishOnly',
          english: 'Behold, I send',
          notice: 'notInTranslation',
        },
      })
    );
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-english')).toBeTruthy();
    expect(screen.getByTestId('daily-verse-not-in-translation').props.children).toBe(
      'This chapter is not in this translation.'
    );
  });

  it('says the numbering differs when THAT is the reason, which is a different thing', async () => {
    // The Telugu text exists for this chapter; it just divides it
    // differently, so verse N is not verse N. Telling a member it "is not
    // in this translation" would be false.
    mockState(
      ready({
        body: { kind: 'englishOnly', english: 'Yahweh said', notice: 'numberingDiffers' },
      })
    );
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-not-in-translation').props.children).toContain(
      'Verse numbering differs'
    );
  });
});

describe('sharing reuses the M4 formatter', () => {
  it('shares the verse and its reference, with NO licence block', async () => {
    // M6 regression. The share used to read like a licence notice with
    // some scripture attached:
    //   "యెహోవా నా కాపరి…"
    //   కీర్తనల గ్రంథము 23:1 (Indian Revised Version (IRV) 2019)
    //   © Bridge Connectivity Solutions, CC BY-SA 4.0
    // The attribution obligation is on bundling the text, and it is met
    // by the Settings credits card -- ../../bible/translationCredits.ts.
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    mockState(ready({ body: { kind: 'text', language: 'te', text: 'దేవుడు' } }));
    const screen = await render(<DailyVerseCard />);

    fireEvent.press(screen.getByTestId('daily-verse-share'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0]![0] as { message: string }).message;
    expect(message).toBe('"దేవుడు"\n\nJohn 3:16');
    expect(message).not.toContain('Indian Revised Version');
    expect(message).not.toContain('CC BY-SA');
    expect(message).not.toContain('©');
  });

  it('claims no translation for an override, whose source is unknown', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    mockState(
      ready({
        source: 'override',
        citation: null,
        reference: 'Isaiah 53:5 (NIV)',
        body: { kind: 'text', language: 'en', text: 'But he was pierced' },
      })
    );
    const screen = await render(<DailyVerseCard />);

    fireEvent.press(screen.getByTestId('daily-verse-share'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0]![0] as { message: string }).message;
    expect(message).toContain('Isaiah 53:5 (NIV)');
    expect(message).not.toContain('World English Bible');
  });

  it('confirms a copy where a screen reader will hear it', async () => {
    const copy = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true);
    mockState(ready());
    const screen = await render(<DailyVerseCard />);

    fireEvent.press(screen.getByTestId('daily-verse-copy'));
    await waitFor(() => expect(screen.getByTestId('daily-verse-notice')).toBeTruthy());
    expect(copy).toHaveBeenCalledWith('John 3:16\nFor God so loved the world...');
    const notice = screen.getByTestId('daily-verse-notice');
    expect(notice.props.children).toBe('Copied to the clipboard.');
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
  });

  it('says so when a copy fails', async () => {
    jest.spyOn(Clipboard, 'setStringAsync').mockRejectedValue(new Error('no clipboard'));
    mockState(ready());
    const screen = await render(<DailyVerseCard />);

    fireEvent.press(screen.getByTestId('daily-verse-copy'));
    await waitFor(() =>
      expect(screen.getByTestId('daily-verse-notice').props.children).toBe(
        'Could not copy this verse.'
      )
    );
  });
});
