import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { fontFamilies, lightTokens, serifFor } from '../../../theme';
import { UpdateDetail, updateDate } from '../UpdateDetail';

jest.mock('../../../services/firebase/app');

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

type Props = Partial<React.ComponentProps<typeof UpdateDetail>>;

async function renderDetail(props: Props = {}) {
  const onBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <UpdateDetail
          kind="announcement"
          title="Fellowship Potluck"
          content="Join us after the service."
          imageUrl={null}
          createdAt={new Date(2020, 5, 20, 12, 0)}
          onBack={onBack}
          testPrefix="announcement-detail"
          {...props}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, onBack };
}

/** The paragraphs of the body, as test instances (typed loosely: they are host Text nodes). */
type Paragraph = { props: { style?: unknown; children?: unknown } };
function paragraphsOf(body: { children: unknown[] }): Paragraph[] {
  return body.children as unknown as Paragraph[];
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

describe('the screen', () => {
  it('has a Back that leaves, from the app’s own top bar', async () => {
    const { getByTestId, onBack } = await renderDetail();
    await fireEvent.press(getByTestId('top-bar-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('names its test ids after the kind, so each kind’s tests and scripts keep finding them', async () => {
    const { getByTestId } = await renderDetail({
      kind: 'post',
      testPrefix: 'community-post-detail',
      imageUrl: 'https://example.org/x.jpg',
    });
    for (const id of ['screen', 'image', 'date', 'title', 'content']) {
      expect(getByTestId(`community-post-detail-${id}`)).toBeTruthy();
    }
  });

  it('shows the picture at 16:9 only when the church attached one', async () => {
    const withPicture = await renderDetail({ imageUrl: 'https://example.org/x.jpg' });
    const image = withPicture.getByTestId('announcement-detail-image');
    expect(image.props.source).toEqual({ uri: 'https://example.org/x.jpg' });
    expect(flat(image)).toMatchObject({
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 16,
    });
    await withPicture.unmount();

    const without = await renderDetail({ imageUrl: null });
    // No grey box in its place.
    expect(without.queryByTestId('announcement-detail-image')).toBeNull();
  });
});

describe('the kicker', () => {
  it('says what it is, in gold ink, with the date quieter', async () => {
    const { getByTestId } = await renderDetail();
    const kicker = getByTestId('announcement-detail-date');
    expect(kicker.props.children[0]).toBe('Announcement');
    expect(flat(kicker).color).toBe(lightTokens.accent);
  });

  it('says "From the church" for a post', async () => {
    const { getByTestId } = await renderDetail({ kind: 'post' });
    expect(getByTestId('announcement-detail-date').props.children[0]).toBe(
      'From the church'
    );
  });

  it('gives an older update its year, spelt out', async () => {
    // A testimony from years ago should not read as though it were from last week.
    const { getByTestId } = await renderDetail({
      createdAt: new Date(2020, 5, 20, 12, 0),
    });
    expect(getByTestId('announcement-detail-date')).toHaveTextContent(/June 20, 2020$/);
  });

  it('gives this year’s update its weekday and day, with no year', async () => {
    const year = new Date().getFullYear();
    const { getByTestId } = await renderDetail({
      createdAt: new Date(year, 0, 15, 12, 0),
    });
    const text = getByTestId('announcement-detail-date');
    expect(text).toHaveTextContent(/, 15 January/);
    expect(text).not.toHaveTextContent(String(year));
  });

  it('leaves the date out, and its separator, when there is none', async () => {
    const { getByTestId } = await renderDetail({ createdAt: null });
    expect(getByTestId('announcement-detail-date').props.children).toEqual([
      'Announcement',
      null,
    ]);
    expect(getByTestId('announcement-detail-date')).not.toHaveTextContent('·');
  });
});

describe('updateDate', () => {
  const now = new Date(2026, 9, 12, 12, 0);

  it('is weekday, day and month for something from this year', () => {
    expect(updateDate(new Date(2026, 9, 9, 12, 0), 'en', now)).toBe('Friday, 9 October');
    expect(updateDate(new Date(2026, 0, 1, 12, 0), 'en', now)).toBe(
      'Thursday, 1 January'
    );
  });

  it('is the long date, with the year, for anything from another year', () => {
    expect(updateDate(new Date(2025, 11, 31, 12, 0), 'en', now)).toBe(
      'December 31, 2025'
    );
    expect(updateDate(new Date(2027, 0, 1, 12, 0), 'en', now)).toBe('January 1, 2027');
  });

  it('is in the interface language', () => {
    const telugu = updateDate(new Date(2026, 9, 9, 12, 0), 'te', now);
    expect(telugu).toMatch(/[ఀ-౿]/u);
    expect(telugu).not.toBe(updateDate(new Date(2026, 9, 9, 12, 0), 'en', now));
  });
});

describe('the words', () => {
  it('sets the heading as a heading, in the serif at 26/33', async () => {
    const { getByTestId } = await renderDetail();
    const heading = getByTestId('announcement-detail-title');
    expect(heading.props.accessibilityRole).toBe('header');
    expect(flat(heading)).toMatchObject({
      fontFamily: serifFor('en', 'semiBold'),
      fontSize: 26,
      lineHeight: 33,
      color: lightTokens.ink,
    });
  });

  it('sets a Telugu heading in the Telugu serif with room for its marks', async () => {
    const { getByTestId } = await renderDetail({ title: 'సహవాస భోజనం' });
    expect(flat(getByTestId('announcement-detail-title'))).toMatchObject({
      fontFamily: serifFor('te', 'semiBold'),
      fontSize: 24,
      lineHeight: 40,
    });
  });

  it('sets a heading that mixes scripts in the face that has both', async () => {
    const { getByTestId } = await renderDetail({ title: 'పాస్టర్ John గారి సందేశం' });
    expect(flat(getByTestId('announcement-detail-title')).fontFamily).toBe(
      fontFamilies.interfaceSemiBold
    );
  });

  it('turns blank lines into paragraphs and keeps single line breaks', async () => {
    const { getByTestId } = await renderDetail({
      content: 'First paragraph.\nStill the first.\n\nSecond paragraph.\n\n\n\nThird.',
    });
    const paragraphs = paragraphsOf(getByTestId('announcement-detail-content'));
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs.map((p) => p.props.children)).toEqual([
      'First paragraph.\nStill the first.',
      'Second paragraph.',
      'Third.',
    ]);
  });

  it('drops empty paragraphs and trims the ones it keeps', async () => {
    const { getByTestId } = await renderDetail({
      content: '\n\n  Only this.  \n\n   \n\n',
    });
    const paragraphs = paragraphsOf(getByTestId('announcement-detail-content'));
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].props.children).toBe('Only this.');
  });

  it('sets the paragraphs at 17/28, and Telugu ones at 16.5/34', async () => {
    const english = await renderDetail({ content: 'Plain words.' });
    const [para] = paragraphsOf(english.getByTestId('announcement-detail-content'));
    expect(flat(para)).toMatchObject({
      fontFamily: serifFor('en', 'regular'),
      fontSize: 17,
      lineHeight: 28,
    });
    await english.unmount();

    const telugu = await renderDetail({ content: 'సహవాస భోజనం ఆదివారం.' });
    const [teluguPara] = paragraphsOf(telugu.getByTestId('announcement-detail-content'));
    expect(flat(teluguPara)).toMatchObject({
      fontFamily: serifFor('te', 'regular'),
      fontSize: 16.5,
      lineHeight: 34,
    });
  });

  it('names the back button in Telugu in a Telugu interface', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderDetail();
    await waitFor(() =>
      expect(getByTestId('top-bar-back').props.accessibilityLabel).toMatch(/[ఀ-౿]/u)
    );
  });
});
