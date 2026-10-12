import React from 'react';
import { Share, StyleSheet } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { DailyVerseCard } from '../DailyVerseCard';
import { usePreferences } from '../../../context/PreferencesContext';
import { useVerseOfTheDay, type VerseOfTheDayState } from '../useVerseOfTheDay';
import { fontFamilies, lightTokens, onPhoto, serifFor } from '../../../theme';
import { scriptureBilingualStyle, scriptureDisplayStyle } from '../../../theme/tokens';
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
    location: { bookId: 'john', chapter: 3, verse: 16 },
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
  it("shows a labelled loading state in the verse's own shape, not a bare spinner", async () => {
    // Four grey lines where the verse will be say what is coming; the
    // container says "busy" -- and what it is waiting for -- to a screen reader.
    mockState({ status: 'loading' });
    const screen = await render(<DailyVerseCard />);
    const loading = screen.getByTestId('daily-verse-loading');
    expect(loading.props.accessibilityRole).toBe('progressbar');
    expect(loading.props.accessibilityLabel).toBe("Loading today's verse");
    expect(loading.props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId('daily-verse-card')).toBeNull();
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

describe('the hero: date, label, rule, verse, reference, actions', () => {
  it('says what day it is, in the words of the app language', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    // ready() is keyed 2026-04-03, a Friday.
    expect(screen.getByTestId('daily-verse-date').props.children).toBe('Friday, 3 April');
  });

  it('names itself with a gold label that is a heading', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    const label = screen.getByText('Verse of the day');
    expect(label.props.accessibilityRole).toBe('header');
    expect(flat(label).color).toBe(lightTokens.accent);
  });

  it('sets the reference in gold ink at 15/20 semibold', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    const reference = flat(screen.getByTestId('daily-verse-reference'));
    expect(reference).toMatchObject({
      color: lightTokens.accent,
      fontSize: 15,
      lineHeight: 20,
      fontFamily: fontFamilies.interfaceSemiBold,
    });
  });

  it('offers "See all" only where it was asked for, and it goes where it was told', async () => {
    mockState(ready());
    const home = await render(<DailyVerseCard />);
    expect(home.queryByText('See all')).toBeNull();
    await cleanup();

    const onSeeAll = jest.fn();
    mockState(ready());
    const withLink = await render(<DailyVerseCard onSeeAll={onSeeAll} />);
    // Its spoken name carries the section: two "See all" links on Home are
    // otherwise two identical buttons.
    expect(withLink.getByTestId('daily-verse-see-all').props.accessibilityLabel).toBe(
      'See all, Verse of the day'
    );
    await fireEvent.press(withLink.getByTestId('daily-verse-see-all'));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });
});

describe('"Read chapter"', () => {
  it("opens the Bible at the verse's own place", async () => {
    const onReadChapter = jest.fn();
    mockState(ready({ location: { bookId: 'john', chapter: 14, verse: 27 } }));
    const screen = await render(<DailyVerseCard onReadChapter={onReadChapter} />);

    await fireEvent.press(screen.getByTestId('daily-verse-read'));
    expect(onReadChapter).toHaveBeenCalledWith({
      bookId: 'john',
      chapter: 14,
      verse: 27,
    });
  });

  it('is the primary action: a full-width pill that wears the label and an arrow', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard onReadChapter={jest.fn()} />);
    expect(screen.getByText('Read chapter')).toBeTruthy();
    const button = screen.getByTestId('daily-verse-read');
    expect(button.props.accessibilityRole).toBe('button');
    expect(flat(button).borderRadius).toBe(999);
    expect(flat(button).backgroundColor).toBe(lightTokens.primary);
  });

  it('is not offered for an override, whose place cannot be known', async () => {
    // An override is a string an administrator typed. It cannot be taken
    // apart into a book and a chapter, and must not be guessed at.
    mockState(ready({ source: 'override', citation: null, location: null }));
    const screen = await render(<DailyVerseCard onReadChapter={jest.fn()} />);
    expect(screen.queryByTestId('daily-verse-read')).toBeNull();
    // ...but it can still be shared and copied.
    expect(screen.getByTestId('daily-verse-share')).toBeTruthy();
    expect(screen.getByTestId('daily-verse-copy')).toBeTruthy();
  });

  it('is not offered where the screen did not say what opening it means', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    expect(screen.queryByTestId('daily-verse-read')).toBeNull();
  });
});

describe('Share and Copy', () => {
  it('are round 44-point buttons with spoken names, since an icon says nothing aloud', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    for (const [id, label] of [
      ['daily-verse-share', 'Share'],
      ['daily-verse-copy', 'Copy'],
    ] as const) {
      const button = screen.getByTestId(id);
      expect(button.props.accessibilityLabel).toBe(label);
      expect(flat(button)).toMatchObject({ width: 44, height: 44, borderRadius: 999 });
    }
  });
});

describe('the verse is set in three steps by its length', () => {
  const body = (text: string) =>
    ({ kind: 'text', language: 'en', text }) as VotdContent['body'];

  it('steps down 28 / 24 / 21 as the verse grows, and never cuts it off', async () => {
    const short = 'Jesus wept.';
    const medium = 'A'.repeat(120);
    const long = 'B'.repeat(200);
    for (const [text, size, line] of [
      [short, 28, 40],
      [medium, 24, 36],
      [long, 21, 32],
    ] as const) {
      mockState(ready({ body: body(text) }));
      const screen = await render(<DailyVerseCard />);
      const node = screen.getByTestId('daily-verse-text');
      expect(flat(node)).toMatchObject({ fontSize: size, lineHeight: line });
      // The whole verse, never a clamp.
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.children).toBe(text);
      await cleanup();
    }
  });

  it('uses the same steps the Home type token defines', async () => {
    mockState(ready({ body: body('For God so loved the world...') }));
    const screen = await render(<DailyVerseCard />);
    const expected = scriptureDisplayStyle('en', 'For God so loved the world...');
    expect(flat(screen.getByTestId('daily-verse-text'))).toMatchObject({
      fontSize: expected.fontSize,
      lineHeight: expected.lineHeight,
      fontFamily: expected.fontFamily,
    });
  });

  it('sets a Telugu verse two points smaller with more leading', async () => {
    const text = 'దేవుడు లోకమును ఎంతో ప్రేమించెను';
    mockState(ready({ body: { kind: 'text', language: 'te', text } }));
    const screen = await render(<DailyVerseCard />);
    const telugu = flat(screen.getByTestId('daily-verse-text'));
    expect(telugu.fontSize).toBe(26);
    expect(telugu.lineHeight).toBe(45);
    expect(telugu.fontFamily).toBe(serifFor('te', 'regular'));
  });
});

describe("an administrator's own text takes the serif of the script it is written in", () => {
  function override(text: string, language: 'en' | 'te') {
    return ready({
      source: 'override',
      citation: null,
      location: null,
      body: { kind: 'text', language, text },
    });
  }

  it('Latin text takes the English serif', async () => {
    mockState(override('Peace I leave with you', 'en'));
    const screen = await render(<DailyVerseCard />);
    expect(fontOf(screen.getByTestId('daily-verse-text'))).toBe(
      serifFor('en', 'regular')
    );
  });

  it('Telugu text takes the Telugu serif', async () => {
    mockState(override('శాంతి మీకిచ్చి వెళ్తున్నాను', 'te'));
    const screen = await render(<DailyVerseCard />);
    expect(fontOf(screen.getByTestId('daily-verse-text'))).toBe(
      serifFor('te', 'regular')
    );
  });

  it('text that mixes both takes the face that has both', async () => {
    mockState(override('యేసు Christ is Lord', 'te'));
    const screen = await render(<DailyVerseCard />);
    expect(fontOf(screen.getByTestId('daily-verse-text'))).toBe(
      fontFamilies.interfaceRegular
    );
  });
});

describe('a verse in both languages', () => {
  it('sets English at 22/33 in ink and the Telugu beneath at 19/34 in quieter ink', async () => {
    mockState(ready({ body: { kind: 'paired', english: 'For God', telugu: 'దేవుడు' } }));
    const screen = await render(<DailyVerseCard />);
    const english = flat(screen.getByTestId('daily-verse-english'));
    const telugu = flat(screen.getByTestId('daily-verse-telugu'));
    expect(english).toMatchObject({
      fontSize: scriptureBilingualStyle('en').fontSize,
      lineHeight: scriptureBilingualStyle('en').lineHeight,
      color: lightTokens.ink,
    });
    expect(english).toMatchObject({ fontSize: 22, lineHeight: 33 });
    expect(telugu).toMatchObject({
      fontSize: 19,
      lineHeight: 34,
      color: lightTokens.inkMuted,
    });
  });
});

describe('a verse set on a photograph the church attached', () => {
  function withPhoto() {
    return ready({
      source: 'override',
      citation: null,
      location: null,
      imageUrl: 'https://example.org/verse.jpg',
    });
  }

  it('lays a dark veil over the picture, so white words hold on any photograph', async () => {
    mockState(withPhoto());
    const screen = await render(<DailyVerseCard />);
    const card = flat(screen.getByTestId('daily-verse-card'));
    // What shows if the picture never loads is dark, not the white page.
    expect(card.backgroundColor).toBe(onPhoto.base);
    expect(card.overflow).toBe('hidden');
    // The picture fills the card behind the words.
    const picture = screen.getByTestId('daily-verse-image');
    expect(flat(picture)).toMatchObject({ position: 'absolute' });
    expect(picture.props.resizeMode).toBe('cover');
  });

  it('lays the veil OVER the picture and UNDER the words, and the veil takes no touches', async () => {
    mockState(withPhoto());
    const screen = await render(<DailyVerseCard />);
    const veil = screen.getByTestId('daily-verse-veil');
    expect(flat(veil)).toMatchObject({
      backgroundColor: onPhoto.veil,
      position: 'absolute',
    });
    expect(veil.props.pointerEvents).toBe('none');

    // Painted in this order: the picture, the veil, then the words.
    const ids = (
      (screen.toJSON() as { children: { props: { testID?: string } }[] }).children ?? []
    ).map((child) => child.props.testID);
    expect(ids.indexOf('daily-verse-image')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('daily-verse-veil')).toBe(ids.indexOf('daily-verse-image') + 1);
    expect(ids.indexOf('daily-verse-date')).toBeGreaterThan(
      ids.indexOf('daily-verse-veil')
    );
  });

  it('has no veil, and no picture, on a plain page', async () => {
    mockState(ready());
    const screen = await render(<DailyVerseCard />);
    expect(screen.queryByTestId('daily-verse-veil')).toBeNull();
    expect(screen.queryByTestId('daily-verse-image')).toBeNull();
  });

  it('sets every word white and keeps gold to the hairline', async () => {
    mockState(withPhoto());
    const screen = await render(<DailyVerseCard onSeeAll={jest.fn()} />);
    for (const node of [
      screen.getByTestId('daily-verse-date'),
      screen.getByText('Verse of the day'),
      screen.getByText('See all'),
      screen.getByTestId('daily-verse-text'),
      screen.getByTestId('daily-verse-reference'),
    ]) {
      expect(flat(node).color).toBe(onPhoto.ink);
    }
  });

  it('wears the same controls, white', async () => {
    mockState({
      status: 'ready',
      dateKey: '2026-04-03',
      content: content({
        source: 'override',
        citation: null,
        imageUrl: 'https://example.org/verse.jpg',
      }),
    });
    const screen = await render(<DailyVerseCard onReadChapter={jest.fn()} />);
    // content() gives the override a location, so the pill is offered.
    const read = screen.getByTestId('daily-verse-read');
    expect(flat(read).backgroundColor).toBe(onPhoto.button);
    expect(flat(screen.getByTestId('daily-verse-share')).borderColor).toBe(onPhoto.ring);
  });

  it("keeps the picture's accessible label", async () => {
    mockState(withPhoto());
    const screen = await render(<DailyVerseCard />);
    expect(screen.getByTestId('daily-verse-image').props.accessibilityLabel).toBe(
      "Illustration for today's verse"
    );
  });
});
