import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import { useMemberIdentity } from '../../context/useMemberIdentity';
import { translate } from '../../i18n';
import { darkTokens, lightTokens, serifFor } from '../../theme';
import { TabBar, type TabRouteName } from '../TabBar';

jest.mock('../../services/firebase/app');
jest.mock('../../context/useMemberIdentity');

/** The five destinations, in order: route, test id, English label. */
const TABS = [
  ['Home', 'tab-home', 'Home'],
  ['BibleBooks', 'tab-bible', 'Bible'],
  ['PrayersHub', 'tab-prayers', 'Prayers'],
  ['CommunityHub', 'tab-community', 'Community'],
  ['You', 'tab-you', 'You'],
] as const;

function memberNamed(displayName: string) {
  (useMemberIdentity as jest.Mock).mockReturnValue({
    uid: displayName ? 'u1' : null,
    displayName,
    canPost: true,
    suspended: false,
  });
}

async function renderBar(activeRoute: string | undefined, onNavigate = jest.fn()) {
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <TabBar activeRoute={activeRoute} onNavigate={onNavigate} />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, onNavigate };
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

const HIDDEN = { includeHiddenElements: true } as const;

interface Json {
  type: string;
  props: Record<string, unknown>;
  children?: (Json | string)[] | null;
}

/** Every host node under `node`, itself included, depth first. */
function descendants(node: Json | Json[] | null): Json[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  const kids = (node.children ?? []).filter((c): c is Json => typeof c !== 'string');
  return [node, ...kids.flatMap(descendants)];
}

/**
 * The tab glyphs (react-native-svg's host view) drawn inside the element with this
 * test id. Read from the rendered tree, which carries the stroke and fill the
 * glyph was drawn with; a test instance does not.
 */
function glyphsIn(tree: unknown, testID: string): Json[] {
  const holder = descendants(tree as Json).find((n) => n.props?.testID === testID);
  // 24 across is the tab's glyph; the ribbon over a selected tab is an svg too.
  return descendants(holder ?? null).filter(
    (n) => n.type === 'RNSVGSvgView' && n.props.width === 24
  );
}

beforeEach(() => {
  memberNamed('Grace');
});

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

describe('the five destinations', () => {
  it('renders Home, Bible, Prayers, Community and You, in that order', async () => {
    const { getAllByRole } = await renderBar('Home');
    const tabs = getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(
      TABS.map(([, , label]) => label)
    );
  });

  it.each(TABS)('has a tab for %s', async (_route, testID) => {
    const { getByTestId } = await renderBar('Home');
    expect(getByTestId(testID)).toBeTruthy();
  });

  it('no longer has Songs, Events or More: they live under Community and You', async () => {
    const { queryByTestId } = await renderBar('Home');
    expect(queryByTestId('tab-songs')).toBeNull();
    expect(queryByTestId('tab-events')).toBeNull();
    expect(queryByTestId('tab-more')).toBeNull();
  });

  it('is a tablist, so a screen reader hears "tab 3 of 5"', async () => {
    const { getByTestId } = await renderBar('Home');
    expect(getByTestId('tab-bar').props.accessibilityRole).toBe('tablist');
  });

  it('speaks every tab by its translated label', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderBar('Home');
    await waitFor(() =>
      expect(getByTestId('tab-home').props.accessibilityLabel).toBe(
        translate('te', 'nav.home')
      )
    );
    for (const [, testID, , key] of [
      ['Home', 'tab-home', '', 'nav.home'],
      ['BibleBooks', 'tab-bible', '', 'nav.bible'],
      ['PrayersHub', 'tab-prayers', '', 'nav.prayers'],
      ['CommunityHub', 'tab-community', '', 'nav.community'],
      ['You', 'tab-you', '', 'nav.you'],
    ] as const) {
      expect(getByTestId(testID).props.accessibilityLabel).toBe(
        translate('te', key as 'nav.home')
      );
    }
  });
});

describe('which tab is selected', () => {
  it.each(TABS)('selects only %s when it is the current route', async (route, testID) => {
    const { getByTestId } = await renderBar(route);
    for (const [, otherID] of TABS) {
      expect(getByTestId(otherID).props.accessibilityState.selected).toBe(
        otherID === testID
      );
    }
  });

  it.each(['SongsList', 'EventsList', 'SongDetail', 'Settings', undefined])(
    'selects none when the current route is %s, which is not one of the five',
    async (route) => {
      const { getByTestId } = await renderBar(route);
      for (const [, testID] of TABS) {
        expect(getByTestId(testID).props.accessibilityState.selected).toBe(false);
      }
    }
  );
});

describe('tapping a tab', () => {
  it.each(TABS)('asks to go to %s', async (route, testID) => {
    const { getByTestId, onNavigate } = await renderBar('Home');
    await fireEvent.press(getByTestId(testID));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(route as TabRouteName);
  });

  it('reports a tap on the tab that is already selected, and leaves it to the navigator', async () => {
    const { getByTestId, onNavigate } = await renderBar('PrayersHub');
    await fireEvent.press(getByTestId('tab-prayers'));
    expect(onNavigate).toHaveBeenCalledWith('PrayersHub');
  });
});

describe('the selected tab is marked three ways, never by colour alone', () => {
  it('hangs a gold ribbon from the bar over the selected tab, and over no other', async () => {
    const { getAllByTestId, getByTestId } = await renderBar('CommunityHub');
    expect(getAllByTestId('tab-ribbon', HIDDEN)).toHaveLength(1);
    expect(
      within(getByTestId('tab-community')).getByTestId('tab-ribbon', HIDDEN)
    ).toBeTruthy();
    expect(
      within(getByTestId('tab-home')).queryByTestId('tab-ribbon', HIDDEN)
    ).toBeNull();
  });

  it('shows no ribbon when no tab is the current route', async () => {
    const { queryByTestId } = await renderBar('SongsList');
    expect(queryByTestId('tab-ribbon', HIDDEN)).toBeNull();
  });

  it('sets the selected label bold and the others medium', async () => {
    const { getByText } = await renderBar('PrayersHub');
    expect(flat(getByText('Prayers')).fontWeight).toBe('700');
    for (const label of ['Home', 'Bible', 'Community']) {
      expect(flat(getByText(label)).fontWeight).toBe('500');
    }
  });

  it('draws the selected glyph heavier, with a wash of its own colour', async () => {
    const { toJSON } = await renderBar('Home');
    const strokeOf = (testID: string) => glyphsIn(toJSON(), testID)[0].props.strokeWidth;
    expect(strokeOf('tab-home')).toBe(2);
    expect(strokeOf('tab-bible')).toBe(1.75);
    // The wash: every shape of the selected glyph carries 14% of its own colour.
    const washed = (testID: string) =>
      descendants(glyphsIn(toJSON(), testID)).filter((n) => n.props.fillOpacity === 0.14)
        .length;
    expect(washed('tab-home')).toBeGreaterThan(0);
    expect(washed('tab-bible')).toBe(0);
  });

  it('inks the selected tab in the primary ink and the others in the quiet one', async () => {
    const { getByText } = await renderBar('Home');
    expect(flat(getByText('Home')).color).toBe(lightTokens.primary);
    expect(flat(getByText('Bible')).color).toBe(lightTokens.inkMuted);
  });

  it('never uses gold for the tab ink: gold stays a thin line', async () => {
    const { getByText } = await renderBar('Home');
    for (const label of ['Home', 'Bible', 'Prayers', 'Community']) {
      expect(flat(getByText(label)).color).not.toBe(lightTokens.accent);
    }
  });

  it('takes the night palette at night', async () => {
    await AsyncStorage.setItem('theme_preference', 'dark');
    const { getByText } = await renderBar('Home');
    await waitFor(() => expect(flat(getByText('Home')).color).toBe(darkTokens.primary));
    expect(flat(getByText('Bible')).color).toBe(darkTokens.inkMuted);
  });
});

describe('You is the member', () => {
  it("shows the member's initial in a ring, in place of a person glyph", async () => {
    const { getByTestId, getAllByTestId } = await renderBar('Home');
    const monogram = within(getByTestId('tab-you')).getByTestId('tab-monogram', HIDDEN);
    expect(within(monogram).getByText('G', HIDDEN)).toBeTruthy();
    expect(flat(monogram)).toMatchObject({
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'transparent',
    });
    // Only You is a person; the other four are glyphs.
    expect(getAllByTestId('tab-monogram', HIDDEN)).toHaveLength(1);
  });

  it('fills the circle when You is the selected tab', async () => {
    const { getByTestId } = await renderBar('You');
    const monogram = getByTestId('tab-monogram', HIDDEN);
    expect(flat(monogram).backgroundColor).toBe(lightTokens.primary);
    // ...and the letter takes the page colour, so it stays legible on the fill.
    expect(flat(within(monogram).getByText('G', HIDDEN)).color).toBe(lightTokens.paper);
  });

  it('takes the initial of the PROFILE name, which the member can edit', async () => {
    memberNamed('Esther Rao');
    const { getByTestId } = await renderBar('Home');
    expect(
      within(getByTestId('tab-monogram', HIDDEN)).getByText('E', HIDDEN)
    ).toBeTruthy();
  });

  it('keeps the vowel sign of a Telugu initial: the first letter, not half of it', async () => {
    memberNamed('కృపా');
    const { getByTestId } = await renderBar('Home');
    const letter = within(getByTestId('tab-monogram', HIDDEN)).getByText('కృ', HIDDEN);
    expect(letter).toBeTruthy();
    // ...set in the Telugu serif, which has the glyphs, not the Latin one.
    expect(flat(letter).fontFamily).toBe(serifFor('te', 'semiBold'));
  });

  it('falls back to the person glyph when there is no name to take a letter from', async () => {
    memberNamed('');
    const { queryByTestId, toJSON } = await renderBar('Home');
    expect(queryByTestId('tab-monogram', HIDDEN)).toBeNull();
    // Still a tab, with its glyph: not a "?" in a circle.
    expect(glyphsIn(toJSON(), 'tab-you')).toHaveLength(1);
  });

  it('is hidden from a screen reader, so the tab is announced as "You" and not "G"', async () => {
    const { getByTestId } = await renderBar('Home');
    const monogram = getByTestId('tab-monogram', HIDDEN);
    expect(monogram.props.accessibilityElementsHidden).toBe(true);
    expect(monogram.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(getByTestId('tab-you').props.accessibilityLabel).toBe('You');
  });
});

describe('size and language', () => {
  it('gives every tab at least 52 points to press', async () => {
    const { getByTestId } = await renderBar('Home');
    for (const [, testID] of TABS) {
      // Pressable's style is a function of its press state in production; the
      // test renderer resolves it for us.
      expect(flat(getByTestId(testID)).minHeight).toBeGreaterThanOrEqual(52);
    }
  });

  it('sets the labels at 11.5/14 in English', async () => {
    const { getByText } = await renderBar('Home');
    expect(flat(getByText('Bible'))).toMatchObject({ fontSize: 11.5, lineHeight: 14 });
  });

  it('steps the labels up in Telugu, which reads smaller at the same size', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByText } = await renderBar('Home');
    const bible = translate('te', 'nav.bible');
    await waitFor(() => expect(getByText(bible)).toBeTruthy());
    expect(flat(getByText(bible))).toMatchObject({ fontSize: 12.5, lineHeight: 16 });
  });

  it('keeps each label to one line, so no tab is taller than the rest', async () => {
    const { getByText } = await renderBar('Home');
    for (const label of ['Home', 'Bible', 'Prayers', 'Community', 'You']) {
      expect(getByText(label).props.numberOfLines).toBe(1);
    }
  });
});
