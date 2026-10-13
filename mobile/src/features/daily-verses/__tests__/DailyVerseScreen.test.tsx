import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n';
import { lightTokens, serifFor } from '../../../theme';
import {
  subscribeToDailyVerseArchive,
  type TodaysDailyVerse,
} from '../../../services/firebase/dailyVerses';
import { DailyVerseScreen } from '../DailyVerseScreen';
import { useIndiaDateKey } from '../useIndiaDateKey';
import { useVerseOfTheDay, type VerseOfTheDayState } from '../useVerseOfTheDay';
import type { VotdContent } from '../votdResolver';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/dailyVerses');
jest.mock('../useVerseOfTheDay');
jest.mock('../useIndiaDateKey');

/**
 * THE VERSE OF THE DAY SCREEN.
 *
 * Its top is Home's own verse card (so its states, typefaces and sharing are
 * pinned in ./DailyVerseCard.test.tsx; here the hook behind it is replaced by
 * a state a test hands over). What this file pins is what the SCREEN adds: the
 * top bar, the label and the picture placement it asks the card for, "Read
 * chapter" going to the Bible, and the list of verses the church wrote on
 * EARLIER days -- which must not repeat today's, must not list next week's,
 * and must say so honestly when it cannot be read.
 */
const TODAY = '2026-10-11';

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

function verse(
  id: string,
  date: string,
  text = 'The Lord is my shepherd...',
  reference = 'Psalm 23:1'
): TodaysDailyVerse {
  return { id, date, text, reference, imageUrl: null };
}

function content(partial: Partial<VotdContent> = {}): VotdContent {
  return {
    source: 'pool',
    reference: 'John 14:27',
    body: { kind: 'text', language: 'en', text: 'Peace I leave with you.' },
    imageUrl: null,
    label: '27',
    citation: { bookName: 'John', chapter: 14, label: '27' },
    location: { bookId: 'john', chapter: 14, verse: 27 },
    ...partial,
  };
}

const ready = (partial: Partial<VotdContent> = {}): VerseOfTheDayState => ({
  status: 'ready',
  content: content(partial),
  dateKey: TODAY,
});

type Handlers = { next: (rows: TodaysDailyVerse[]) => void; fail: (e: Error) => void };

/** Hands the archive listener's callbacks to the test, so IT decides when and what arrives. */
function archiveListener() {
  const listeners: Handlers[] = [];
  const stop = jest.fn();
  (subscribeToDailyVerseArchive as jest.Mock).mockImplementation((next, fail) => {
    listeners.push({ next, fail });
    return stop;
  });
  return { listeners, stop, latest: () => listeners[listeners.length - 1] };
}

/** An archive that answers at once. */
function archiveIs(rows: TodaysDailyVerse[]) {
  (subscribeToDailyVerseArchive as jest.Mock).mockImplementation((next) => {
    next(rows);
    return jest.fn();
  });
}

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

function BibleChapterStub({ route }: { route: { params?: unknown } }) {
  return <Text testID="bible-chapter-stub">{JSON.stringify(route.params)}</Text>;
}

function renderScreen() {
  return render(
    <NavigationContainer ref={navigationRef}>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="Home"
              component={() => <Text testID="home-stub">Home</Text>}
            />
            <Stack.Screen name="DailyVerse" component={DailyVerseScreen} />
            <Stack.Screen name="BibleChapter" component={BibleChapterStub as never} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

/** Opens the screen over Home, the way a member arrives from "See all". */
async function openScreen() {
  const view = await renderScreen();
  await waitFor(() => expect(navigationRef.isReady()).toBe(true));
  await act(async () => navigationRef.navigate('DailyVerse'));
  await waitFor(() => expect(view.getByTestId('daily-verse-screen')).toBeTruthy());
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useIndiaDateKey as jest.Mock).mockReturnValue(TODAY);
  (useVerseOfTheDay as jest.Mock).mockReturnValue(ready());
  archiveIs([]);
});

afterEach(async () => {
  await AsyncStorage.clear();
});

describe('the top of the screen is Home’s verse', () => {
  it('opens with a top bar that says "Verse of the day", as a heading, and the card says "Today"', async () => {
    const { getByText, getByTestId } = await openScreen();
    const title = getByText('Verse of the day');
    expect(title.props.accessibilityRole).toBe('header');
    expect(getByTestId('daily-verse-card')).toBeTruthy();
    expect(getByText('Today').props.accessibilityRole).toBe('header');
  });

  it('shows what Home shows -- an automated or bundled verse on a day the church wrote none -- never "no verse today"', async () => {
    (useVerseOfTheDay as jest.Mock).mockReturnValue(
      ready({ source: 'fallback', reference: 'Matthew 16:24' })
    );
    const { getByTestId, queryByText } = await openScreen();
    expect(getByTestId('daily-verse-reference').props.children).toBe('Matthew 16:24');
    expect(queryByText('No daily verse set for today')).toBeNull();
  });

  it('is waiting while the verse is, and honest when none could be resolved', async () => {
    (useVerseOfTheDay as jest.Mock).mockReturnValue({ status: 'loading' });
    const waiting = await openScreen();
    expect(waiting.getByTestId('daily-verse-loading')).toBeTruthy();
    await waiting.unmount();

    (useVerseOfTheDay as jest.Mock).mockReturnValue({ status: 'empty' });
    const empty = await openScreen();
    expect(empty.getByTestId('daily-verse-empty')).toBeTruthy();
  });

  it('has Share and Copy, as Home does, and no "See all": this IS that screen', async () => {
    const { getByTestId, queryByTestId } = await openScreen();
    expect(getByTestId('daily-verse-share')).toBeTruthy();
    expect(getByTestId('daily-verse-copy')).toBeTruthy();
    expect(queryByTestId('daily-verse-see-all')).toBeNull();
  });

  it('opens the Bible at the verse’s own chapter from "Read chapter"', async () => {
    const { getByTestId } = await openScreen();
    await fireEvent.press(getByTestId('daily-verse-read'));
    await waitFor(() => expect(getByTestId('bible-chapter-stub')).toBeTruthy());
    expect(JSON.parse(String(getByTestId('bible-chapter-stub').props.children))).toEqual({
      bookId: 'john',
      chapterNumber: 14,
      verse: 27,
    });
  });

  it('offers no "Read chapter" for the church’s own typed verse, whose place cannot be known', async () => {
    (useVerseOfTheDay as jest.Mock).mockReturnValue(
      ready({ source: 'override', citation: null, location: null })
    );
    const { queryByTestId } = await openScreen();
    expect(queryByTestId('daily-verse-read')).toBeNull();
  });

  it('puts the church’s picture above the date, on the page, rather than behind the words', async () => {
    (useVerseOfTheDay as jest.Mock).mockReturnValue(
      ready({
        source: 'override',
        citation: null,
        location: null,
        imageUrl: 'https://example.org/verse.jpg',
      })
    );
    const { getByTestId, queryByTestId } = await openScreen();
    expect(flat(getByTestId('daily-verse-image'))).toMatchObject({ aspectRatio: 16 / 9 });
    expect(queryByTestId('daily-verse-veil')).toBeNull();
  });

  it('goes back when the top bar’s back button is pressed', async () => {
    const { getByTestId, queryByTestId } = await openScreen();
    await fireEvent.press(getByTestId('daily-verse-top-bar-back'));
    await waitFor(() => expect(getByTestId('home-stub')).toBeTruthy());
    expect(queryByTestId('daily-verse-screen')).toBeNull();
  });
});

describe('the verses the church wrote on earlier days', () => {
  it('shows a skeleton in the shape of the list until the first answer arrives', async () => {
    archiveListener();
    const { getByTestId, queryByTestId } = await openScreen();
    const loading = getByTestId('daily-verse-archive-loading');
    expect(loading.props.accessibilityRole).toBe('progressbar');
    expect(loading.props.accessibilityState).toMatchObject({ busy: true });
    expect(queryByTestId('daily-verse-archive-list')).toBeNull();
    expect(queryByTestId('daily-verse-archive-empty')).toBeNull();
  });

  it('lists them under "Previous verses", in the order the service gives -- newest first', async () => {
    archiveIs([
      verse('b', '2026-10-09', 'For God so loved the world...', 'John 3:16'),
      verse('a', '2026-10-08', 'In nothing be anxious...', 'Philippians 4:6–7'),
    ]);
    const { getByText, getByTestId } = await openScreen();
    expect(getByText('Previous verses').props.accessibilityRole).toBe('header');
    const list = getByTestId('daily-verse-archive-list');
    const ids = list.children
      .map((child) => (typeof child === 'string' ? child : child.props.testID))
      .filter(Boolean);
    expect(ids).toEqual(['daily-verse-archive-item-b', 'daily-verse-archive-item-a']);
    expect(getByText('For God so loved the world...')).toBeTruthy();
    expect(getByText('John 3:16')).toBeTruthy();
  });

  it('writes each date the way a list row does: the day, the short month, and the year only when it is not this one', async () => {
    const thisYear = new Date().getFullYear();
    archiveIs([verse('x', '2025-12-31'), verse('y', `${thisYear}-01-05`)]);
    const { getByText } = await openScreen();
    expect(getByText('31 Dec 2025')).toBeTruthy();
    // This year's needs none -- unless the clock itself is in 2025.
    expect(getByText(thisYear === 2025 ? '5 Jan 2025' : '5 Jan')).toBeTruthy();
  });

  it('does NOT list today’s verse again: it is the one above', async () => {
    archiveIs([
      verse('today', TODAY, 'Today’s written verse'),
      verse('past', '2026-10-09'),
    ]);
    const { queryByTestId } = await openScreen();
    expect(queryByTestId('daily-verse-archive-item-today')).toBeNull();
    expect(queryByTestId('daily-verse-archive-item-past')).toBeTruthy();
  });

  it('does NOT list a verse dated in the future: next week’s is not a "previous" verse', async () => {
    archiveIs([
      verse('later', '2026-10-20'),
      verse('tomorrow', '2026-10-12'),
      verse('past', '2026-10-09'),
    ]);
    const { queryByTestId } = await openScreen();
    expect(queryByTestId('daily-verse-archive-item-later')).toBeNull();
    expect(queryByTestId('daily-verse-archive-item-tomorrow')).toBeNull();
    expect(queryByTestId('daily-verse-archive-item-past')).toBeTruthy();
  });

  it('measures "today" by the canonical Indian date the verse card uses, not by the phone', async () => {
    // The card asks the same date key; if it rolls over, the list follows it.
    (useIndiaDateKey as jest.Mock).mockReturnValue('2026-10-10');
    archiveIs([verse('was-today', '2026-10-10'), verse('older', '2026-10-09')]);
    const { queryByTestId } = await openScreen();
    expect(queryByTestId('daily-verse-archive-item-was-today')).toBeNull();
    expect(queryByTestId('daily-verse-archive-item-older')).toBeTruthy();
  });

  it('says there are none yet -- in words -- when nothing was written on an earlier day', async () => {
    archiveIs([verse('today', TODAY), verse('later', '2026-10-20')]);
    const { getByTestId, getByText } = await openScreen();
    expect(getByTestId('daily-verse-archive-empty')).toBeTruthy();
    expect(getByText('No past verses yet')).toBeTruthy();
  });

  it('sets each in the serif of its own script, and the interface face when it mixes them', async () => {
    archiveIs([
      verse('en', '2026-10-09', 'Plain English words.', 'John 3:16'),
      verse('te', '2026-10-08', 'దేవుడు లోకాన్ని ప్రేమించాడు', 'యోహాను 3:16'),
      verse('mixed', '2026-10-07', 'God దేవుడు', 'John 3:16'),
    ]);
    const { getByText } = await openScreen();
    expect(flat(getByText('Plain English words.')).fontFamily).toBe(
      serifFor('en', 'regular')
    );
    expect(flat(getByText('దేవుడు లోకాన్ని ప్రేమించాడు')).fontFamily).toBe(
      serifFor('te', 'regular')
    );
    const mixed = flat(getByText('God దేవుడు')).fontFamily;
    expect(mixed).not.toBe(serifFor('en', 'regular'));
    expect(mixed).not.toBe(serifFor('te', 'regular'));
    // 17/27 for English, a point smaller with more leading for Telugu.
    expect(flat(getByText('Plain English words.'))).toMatchObject({
      fontSize: 17,
      lineHeight: 27,
    });
    expect(flat(getByText('దేవుడు లోకాన్ని ప్రేమించాడు'))).toMatchObject({
      fontSize: 16,
      lineHeight: 30,
    });
  });

  it('sets the reference in gold ink', async () => {
    archiveIs([verse('a', '2026-10-09', 'Words', 'John 3:16')]);
    const { getByText } = await openScreen();
    expect(flat(getByText('John 3:16')).color).toBe(lightTokens.accent);
  });

  it('says it could not be read, and offers to try again -- it does not claim there are none', async () => {
    const archive = archiveListener();
    const { getByTestId, queryByTestId, getByText } = await openScreen();
    await act(async () => archive.latest().fail(new Error('permission-denied')));
    expect(getByTestId('daily-verse-archive-error')).toBeTruthy();
    expect(getByText('Earlier verses could not be loaded.')).toBeTruthy();
    expect(queryByTestId('daily-verse-archive-empty')).toBeNull();
  });

  it('listens again when "Try again" is pressed, and shows the list when it works', async () => {
    const archive = archiveListener();
    const { getByTestId, queryByTestId, getByText } = await openScreen();
    await act(async () => archive.latest().fail(new Error('offline')));
    expect(archive.listeners).toHaveLength(1);

    await fireEvent.press(getByText('Try again'));
    // Back to waiting, with a second listener.
    await waitFor(() => expect(archive.listeners).toHaveLength(2));
    expect(getByTestId('daily-verse-archive-loading')).toBeTruthy();
    expect(queryByTestId('daily-verse-archive-error')).toBeNull();

    await act(async () => archive.latest().next([verse('p', '2026-10-09')]));
    expect(getByTestId('daily-verse-archive-item-p')).toBeTruthy();
  });

  it('stops listening to the failed listener when it listens again, and when the screen goes', async () => {
    const archive = archiveListener();
    const view = await openScreen();
    await act(async () => archive.latest().fail(new Error('offline')));
    await fireEvent.press(view.getByText('Try again'));
    await waitFor(() => expect(archive.listeners).toHaveLength(2));
    expect(archive.stop).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(archive.stop).toHaveBeenCalledTimes(2);
  });

  it('ignores a late answer from a listener it has already let go of', async () => {
    const archive = archiveListener();
    const view = await openScreen();
    const first = archive.latest();
    await act(async () => first.fail(new Error('offline')));
    await fireEvent.press(view.getByText('Try again'));
    await waitFor(() => expect(archive.listeners).toHaveLength(2));

    // The first listener is gone; suppose one more answer slips out of it anyway.
    await act(async () => first.next([verse('stale', '2026-10-09')]));
    expect(view.queryByTestId('daily-verse-archive-item-stale')).toBeNull();
    expect(view.getByTestId('daily-verse-archive-loading')).toBeTruthy();

    // The new listener's answer is the one that counts.
    await act(async () => archive.latest().next([verse('fresh', '2026-10-09')]));
    expect(view.getByTestId('daily-verse-archive-item-fresh')).toBeTruthy();
  });
});

describe('in Telugu', () => {
  it('names the top bar, the label and the list in Telugu, and keeps the dates day-first', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    archiveIs([verse('p', '2026-10-09', 'దేవుడు', 'యోహాను 3:16')]);
    const { getByText } = await openScreen();
    await waitFor(() =>
      expect(getByText(translate('te', 'home.verseOfTheDay'))).toBeTruthy()
    );
    expect(getByText(translate('te', 'dailyVerse.today'))).toBeTruthy();
    expect(getByText(translate('te', 'dailyVerse.archive'))).toBeTruthy();
    // "9 అక్టో" in a Telugu engine, "9 Oct" in one without Telugu date data: the day comes first either way.
    expect(getByText(/^9 /)).toBeTruthy();
  });
});
