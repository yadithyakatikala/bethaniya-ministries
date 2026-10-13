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
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { fontFamilies, lightTokens, serifFor } from '../../../theme';
import { formatDayMonthShort } from '../../../i18n/locale';
import { UpdateRow } from '../UpdateRow';
import { mergeUpdates, type UpdateItem } from '../updates';

jest.mock('../../../services/firebase/app');

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

// Local noon: the date shown is the same in every timezone the suite runs in.
const WHEN = new Date(2026, 9, 9, 12, 0);

function announcementItem(overrides: Partial<UpdateItem> = {}): UpdateItem {
  const [item] = mergeUpdates(
    [
      {
        id: 'a1',
        title: 'Youth meeting moved',
        content: 'The Friday youth meeting is now at 6pm in the hall, not 7pm.',
        imageUrl: null,
        createdAt: WHEN,
      },
    ],
    []
  );
  return { ...item, ...overrides };
}

function postItem(overrides: Partial<UpdateItem> = {}): UpdateItem {
  const [item] = mergeUpdates(
    [],
    [
      {
        id: 'p1',
        title: 'A testimony',
        content: 'What the Lord has done.',
        imageUrl: 'https://example.org/p1.jpg',
        createdAt: WHEN,
      },
    ]
  );
  return { ...item, ...overrides };
}

async function renderRow(item: UpdateItem, onPress = jest.fn()) {
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <UpdateRow item={item} onPress={onPress} />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, onPress };
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

describe('UpdateRow', () => {
  it('is ONE button, and presses', async () => {
    const { getByTestId, onPress } = await renderRow(announcementItem());
    const row = getByTestId('announcement-a1');
    expect(row.props.accessibilityRole).toBe('button');
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('speaks what it is, when it was, and what it says', async () => {
    const { getByTestId } = await renderRow(announcementItem());
    const date = formatDayMonthShort(WHEN, 'en');
    expect(getByTestId('announcement-a1').props.accessibilityLabel).toBe(
      `Announcement. ${date}. Youth meeting moved`
    );
    // Day first, no year for a date in the current year: "9 Oct".
    expect(date).toMatch(/^9 Oct( \d{4})?$/);
  });

  it('is named "From the church" when it is a post, with the post’s own test id', async () => {
    const { getByTestId } = await renderRow(postItem());
    expect(getByTestId('community-post-p1').props.accessibilityLabel).toBe(
      `From the church. ${formatDayMonthShort(WHEN, 'en')}. A testimony`
    );
  });

  it('puts what it is and the date in a gold kicker, the date quieter', async () => {
    const { getByText } = await renderRow(announcementItem());
    const kicker = getByText(/^Announcement/);
    expect(kicker.props.children[0]).toBe('Announcement');
    expect(flat(kicker).color).toBe(lightTokens.accent);
    const date = within(kicker).getByText(new RegExp(formatDayMonthShort(WHEN, 'en')));
    expect(flat(date).color).toBe(lightTokens.inkSubtle);
    // The date is not tracked out and capitalised like the label.
    expect(flat(date)).toMatchObject({ letterSpacing: 0, textTransform: 'none' });
  });

  it('shows the title and two lines of what it says', async () => {
    const { getByText } = await renderRow(announcementItem());
    expect(getByText('Youth meeting moved').props.numberOfLines).toBe(3);
    const preview = getByText(/The Friday youth meeting/);
    expect(preview.props.numberOfLines).toBe(2);
    expect(flat(preview)).toMatchObject({ fontSize: 14.5, lineHeight: 21 });
    expect(flat(preview).color).toBe(lightTokens.inkMuted);
  });

  it('sets the title in the serif at 17/24', async () => {
    const { getByText } = await renderRow(announcementItem());
    expect(flat(getByText('Youth meeting moved'))).toMatchObject({
      fontFamily: serifFor('en', 'semiBold'),
      fontSize: 17,
      lineHeight: 24,
      color: lightTokens.ink,
    });
  });

  it('sets a Telugu title in the Telugu serif, which has the glyphs', async () => {
    const title = 'యువజన సమావేశం మార్పు';
    const { getByText } = await renderRow(announcementItem({ title }));
    expect(flat(getByText(title))).toMatchObject({
      fontFamily: serifFor('te', 'semiBold'),
      fontSize: 16.5,
      lineHeight: 30,
    });
  });

  it('sets a title that mixes scripts in the face that has both', async () => {
    // A Telugu title with a Latin name in it must not lose half its letters.
    const title = 'పాస్టర్ John గారి సందేశం';
    const { getByText } = await renderRow(announcementItem({ title }));
    expect(flat(getByText(title)).fontFamily).toBe(fontFamilies.interfaceSemiBold);
  });

  it('shows a 76-point picture ONLY when the church attached one', async () => {
    const { getByTestId } = await renderRow(postItem());
    const picture = getByTestId('community-post-p1-image');
    expect(picture.props.source).toEqual({ uri: 'https://example.org/p1.jpg' });
    expect(flat(picture)).toMatchObject({ width: 76, height: 76, borderRadius: 12 });
    // A photograph is not inverted by a platform dark mode.
    expect(picture.props.accessibilityIgnoresInvertColors).toBe(true);
  });

  it('draws neither a chevron nor a grey box when there is no picture: a list of headlines', async () => {
    const { toJSON, queryByTestId } = await renderRow(announcementItem());
    expect(queryByTestId('announcement-a1-image')).toBeNull();
    // Nothing is drawn beside the words at all.
    expect(JSON.stringify(toJSON())).not.toContain('RNSVGSvgView');
  });

  it('draws nothing but the thumbnail beside the words when there is one', async () => {
    const { toJSON } = await renderRow(postItem());
    expect(JSON.stringify(toJSON())).not.toContain('RNSVGSvgView');
  });

  it('previews the FIRST paragraph only, on its own lines, not a blank line from the next', async () => {
    const { getByText } = await renderRow(
      announcementItem({
        content:
          'The new time is 6pm.\nSnacks after.\n\nWe will finish with a short prayer.',
      })
    );
    expect(getByText('The new time is 6pm. Snacks after.')).toBeTruthy();
  });

  it('gives a Telugu preview the 24-point line its marks need', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByText } = await renderRow(
      announcementItem({ content: 'దయచేసి కొత్త సమయాన్ని గమనించండి.' })
    );
    await waitFor(() =>
      expect(flat(getByText('దయచేసి కొత్త సమయాన్ని గమనించండి.')).lineHeight).toBe(24)
    );
  });

  it('leaves the date out, with its separator, when the item has none', async () => {
    const { getByTestId, getByText } = await renderRow(
      announcementItem({ createdAt: null })
    );
    expect(getByTestId('announcement-a1').props.accessibilityLabel).toBe(
      'Announcement. Youth meeting moved'
    );
    expect(getByText(/^Announcement/).props.children).toEqual(['Announcement', null]);
  });

  it('is at least 96 high, with a hairline foot', async () => {
    const { getByTestId } = await renderRow(announcementItem());
    expect(flat(getByTestId('announcement-a1'))).toMatchObject({
      minHeight: 96,
      borderBottomWidth: 1,
      borderBottomColor: lightTokens.border,
    });
  });

  it('shows the date in Telugu in a Telugu interface', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderRow(announcementItem());
    await waitFor(() =>
      expect(getByTestId('announcement-a1').props.accessibilityLabel).toMatch(
        /^ప్రకటన\. /
      )
    );
  });
});
