import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useColorScheme from 'react-native/Libraries/Utilities/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import { darkTokens, lightTokens, sepiaTokens } from '../../../../theme/tokens';
import { AuthProvider } from '../../../../context/AuthContext';
import { PreferencesProvider } from '../../../../context/PreferencesContext';
import { ReadingPreferencesProvider } from '../../../../context/ReadingPreferencesContext';
import {
  markDayComplete,
  startPlan,
  subscribeToPlanProgress,
  type PlanProgress,
} from '../../../../services/firebase/plans';
import { translate } from '../../../../i18n/strings';
import type { PlanReading } from '../../../plans/planReading';
import type { BibleMode } from '../../types';
import { ReaderScreen } from '../ReaderScreen';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: jest.fn(() => null) }));
jest.mock('../../../../services/firebase/app');
jest.mock('../../../../services/firebase/plans');

/**
 * What the redesign added around the page, which ReaderScreen.test.tsx does not
 * look at: the top bar and what is in it, the Bible-language sheet, Search, the
 * floating chapter buttons, the sepia page and the line it draws between the
 * page and the sheets, the plan chip, and the two kinds of notice.
 */
const BIBLE_MODE_KEY = 'bible_mode_preference';
const PAGE_KEY = 'reader_page_preference';

const PLAN: PlanReading = {
  planId: 'seven-days',
  title: 'Seven Days in the Psalms',
  dayCount: 7,
  dayNumber: 2,
};

const progress = (overrides: Partial<PlanProgress> = {}): PlanProgress => ({
  startedAt: null,
  currentDay: 2,
  completedDays: [1],
  lastReadAt: null,
  ...overrides,
});

function signedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: null, email: null, phoneNumber: null });
    return jest.fn();
  });
}

function withProgress(value: PlanProgress | null) {
  (subscribeToPlanProgress as jest.Mock).mockImplementation((_uid, _id, onNext) => {
    onNext(value);
    return jest.fn();
  });
}

async function renderReader(
  bookId: string,
  chapterNumber: number,
  params: { verse?: number; fromPlan?: PlanReading } = {}
) {
  const navigate = jest.fn();
  const goBack = jest.fn();
  const replace = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <ReadingPreferencesProvider>
          <ReaderScreen
            navigation={{ navigate, goBack, replace } as never}
            route={
              {
                key: 'BibleChapter',
                name: 'BibleChapter',
                params: { bookId, chapterNumber, ...params },
              } as never
            }
          />
        </ReadingPreferencesProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack, replace };
}

const seedBible = (mode: BibleMode) => AsyncStorage.setItem(BIBLE_MODE_KEY, mode);

const background = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as never) as { backgroundColor?: string })
    .backgroundColor;

beforeEach(() => {
  (useWindowDimensions as unknown as jest.Mock).mockReturnValue({
    width: 390,
    height: 844,
    scale: 3,
    fontScale: 1,
  });
  (useColorScheme as jest.Mock).mockReturnValue('light');
  (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  withProgress(null);
  (startPlan as jest.Mock).mockResolvedValue(undefined);
  (markDayComplete as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
});

describe('the top bar', () => {
  it('holds Back, the place, the language, Search and the text settings -- and no chapter buttons', async () => {
    await seedBible('en');
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('reader-top-bar')).toBeTruthy());

    const bar = within(getByTestId('reader-top-bar'));
    for (const id of [
      'reader-back-button',
      'chapter-selector-button',
      'reader-language-button',
      'reader-search-button',
      'reader-settings-button',
    ]) {
      expect(bar.getByTestId(id)).toBeTruthy();
    }
    // Previous and next float at the foot instead.
    expect(bar.queryByTestId('previous-chapter-button')).toBeNull();
    expect(bar.queryByTestId('next-chapter-button')).toBeNull();
    expect(
      within(getByTestId('reader-bottom-bar')).getByTestId('previous-chapter-button')
    ).toBeTruthy();
    expect(
      within(getByTestId('reader-bottom-bar')).getByTestId('next-chapter-button')
    ).toBeTruthy();
  });

  it('prints the place as "John 3" and opens the chapter picker from it', async () => {
    await seedBible('en');
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('reader-reference')).toBeTruthy());
    expect(getByTestId('reader-reference').props.children).toBe('John 3');

    fireEvent.press(getByTestId('chapter-selector-button'));
    await waitFor(() => expect(getByTestId('chapter-picker-chapters')).toBeTruthy());
  });

  it('opens the chapter picker on the testament of the book being read', async () => {
    await seedBible('en');
    const nt = await renderReader('john', 3);
    await waitFor(() => expect(nt.getByTestId('chapter-selector-button')).toBeTruthy());
    fireEvent.press(nt.getByTestId('chapter-selector-button'));
    await waitFor(() =>
      expect(nt.getByTestId('chapter-picker-back-to-books')).toBeTruthy()
    );
    fireEvent.press(nt.getByTestId('chapter-picker-back-to-books'));
    // John is in the New Testament, which is what the list opens on.
    await waitFor(() => expect(nt.getByTestId('chapter-picker-book-john')).toBeTruthy());
    expect(nt.queryByTestId('chapter-picker-book-genesis')).toBeNull();
    expect(
      nt.getByTestId('chapter-picker-testament-NT').props.accessibilityState.selected
    ).toBe(true);
    await nt.unmount();

    const ot = await renderReader('genesis', 1);
    await waitFor(() => expect(ot.getByTestId('chapter-selector-button')).toBeTruthy());
    fireEvent.press(ot.getByTestId('chapter-selector-button'));
    await waitFor(() =>
      expect(ot.getByTestId('chapter-picker-back-to-books')).toBeTruthy()
    );
    fireEvent.press(ot.getByTestId('chapter-picker-back-to-books'));
    await waitFor(() =>
      expect(ot.getByTestId('chapter-picker-book-genesis')).toBeTruthy()
    );
    expect(ot.queryByTestId('chapter-picker-book-john')).toBeNull();
  });

  it('opens the Bible search from the magnifier', async () => {
    await seedBible('en');
    const { getByTestId, navigate } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('reader-search-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-search-button'));
    expect(navigate).toHaveBeenCalledWith('BibleSearch');
  });

  it('floats the chapter buttons without taking touches between them', async () => {
    // A tap beside the buttons has to reach the page and hide the chrome.
    await seedBible('en');
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('reader-bottom-bar')).toBeTruthy());
    expect(getByTestId('reader-bottom-bar').props.pointerEvents).toBe('box-none');
  });
});

describe('the Bible language, from the top bar', () => {
  it.each([
    ['te', 'తె'],
    ['en', 'EN'],
    ['bilingual', 'EN + తె'],
  ] as const)(
    'prints %s as "%s" and says its name to a screen reader',
    async (mode, code) => {
      await seedBible(mode);
      const { getByTestId } = await renderReader('john', 3);
      await waitFor(() => expect(getByTestId('reader-language-button')).toBeTruthy());
      expect(within(getByTestId('reader-language-button')).getByText(code)).toBeTruthy();
      const label = getByTestId('reader-language-button').props
        .accessibilityLabel as string;
      expect(label).toContain(translate('en', 'settings.bibleLanguage'));
      const modeKey =
        mode === 'te'
          ? 'bible.modeTelugu'
          : mode === 'en'
            ? 'bible.modeEnglish'
            : 'bible.modeBilingual';
      expect(label).toContain(translate('en', modeKey));
    }
  );

  it('opens one sheet, with the current choice ticked, and a choice closes it and changes only the Bible', async () => {
    await AsyncStorage.setItem('app_language_preference', 'en');
    await seedBible('te');
    const { getByTestId, queryByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('reader-language-button')).toBeTruthy());

    fireEvent.press(getByTestId('reader-language-button'));
    await waitFor(() => expect(getByTestId('reader-language-en')).toBeTruthy());
    expect(getByTestId('reader-language-te').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('reader-language-en').props.accessibilityState.checked).toBe(
      false
    );
    expect(getByTestId('reader-language-bilingual')).toBeTruthy();

    fireEvent.press(getByTestId('reader-language-en'));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(BIBLE_MODE_KEY)).toBe('en')
    );
    expect(queryByTestId('reader-language-sheet')).toBeNull();
    // The interface language is a different setting, and was not touched.
    expect(await AsyncStorage.getItem('app_language_preference')).toBe('en');
    // The pill follows the choice.
    await waitFor(() =>
      expect(within(getByTestId('reader-language-button')).getByText('EN')).toBeTruthy()
    );
  });

  it('offers the same sheet from a chapter the Telugu Bible lacks, as "Switch language"', async () => {
    await seedBible('te');
    const { getByTestId } = await renderReader('malachi', 4);
    await waitFor(() => expect(getByTestId('chapter-unavailable')).toBeTruthy());

    fireEvent.press(getByTestId('chapter-unavailable-switch'));
    await waitFor(() => expect(getByTestId('reader-language-sheet')).toBeTruthy());
    expect(getByTestId('reader-language-en')).toBeTruthy();
  });
});

describe('the sepia page', () => {
  it('sets the page, the bar and the chapter buttons in sepia, and nothing else', async () => {
    await seedBible('en');
    await AsyncStorage.setItem(PAGE_KEY, 'sepia');
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() =>
      expect(background(getByTestId('reader-screen'))).toBe(sepiaTokens.paper)
    );

    expect(background(getByTestId('reader-top-bar'))).toBe(sepiaTokens.surface);
    expect(background(getByTestId('previous-chapter-button'))).toBe(sepiaTokens.surface);
    // The gutter number is the sepia gold, a step darker than on paper.
    const verse = JSON.stringify(getByTestId('verse-1'));
    expect(verse).toContain(sepiaTokens.accent);
    expect(verse).not.toContain(lightTokens.accent);
  });

  it('leaves the sheets in the app palette -- a Modal would inherit the scope if they were inside it', async () => {
    await seedBible('en');
    await AsyncStorage.setItem(PAGE_KEY, 'sepia');
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('reader-settings-button')).toBeTruthy());
    fireEvent.press(getByTestId('reader-settings-button'));
    await waitFor(() => expect(getByTestId('reader-size-sample')).toBeTruthy());

    const ink = (
      StyleSheet.flatten(getByTestId('reader-size-sample').props.style) as {
        color?: string;
      }
    ).color;
    expect(ink).toBe(lightTokens.ink);
    expect(ink).not.toBe(sepiaTokens.ink);
  });

  it('is still sepia on a dark app, with the sheets dark and the status bar dark over the cream', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    await seedBible('en');
    await AsyncStorage.setItem(PAGE_KEY, 'sepia');
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() =>
      expect(background(getByTestId('reader-screen'))).toBe(sepiaTokens.paper)
    );

    fireEvent.press(getByTestId('reader-settings-button'));
    await waitFor(() => expect(getByTestId('reader-size-sample')).toBeTruthy());
    expect(
      (
        StyleSheet.flatten(getByTestId('reader-size-sample').props.style) as {
          color?: string;
        }
      ).color
    ).toBe(darkTokens.ink);
    // The app's status bar is light-on-dark; the reader asks for dark icons.
    expect(StatusBar as unknown as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'dark' }),
      undefined
    );
  });

  it('asks nothing of the status bar on a light app, or on a dark page', async () => {
    await seedBible('en');
    await AsyncStorage.setItem(PAGE_KEY, 'sepia');
    const light = await renderReader('john', 3);
    await waitFor(() => expect(light.getByTestId('reader-screen')).toBeTruthy());
    expect(StatusBar as unknown as jest.Mock).not.toHaveBeenCalled();
    await light.unmount();

    await AsyncStorage.clear();
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    await seedBible('en');
    const dark = await renderReader('john', 3);
    await waitFor(() =>
      expect(background(dark.getByTestId('reader-screen'))).toBe(darkTokens.paper)
    );
    expect(StatusBar as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('the plan chip', () => {
  it('shows the day, the plan and Mark Complete, for a signed-in member reading for a plan', async () => {
    signedIn();
    withProgress(progress());
    await seedBible('en');
    const { getByTestId } = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(getByTestId('reader-plan-chip')).toBeTruthy());

    const chip = within(getByTestId('reader-plan-chip'));
    expect(chip.getByText('Day 2 of 7')).toBeTruthy();
    expect(chip.getByText('Seven Days in the Psalms')).toBeTruthy();
    expect(chip.getByText('Mark Complete')).toBeTruthy();
  });

  it('is not there without a plan, or without a member', async () => {
    signedIn();
    await seedBible('en');
    const noPlan = await renderReader('psalms', 23);
    await waitFor(() => expect(noPlan.getByTestId('reader-top-bar')).toBeTruthy());
    expect(noPlan.queryByTestId('reader-plan-chip')).toBeNull();
    await noPlan.unmount();

    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const signedOut = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(signedOut.getByTestId('reader-top-bar')).toBeTruthy());
    expect(signedOut.queryByTestId('reader-plan-chip')).toBeNull();
  });

  it('leaves room beneath the last verse for the chip, and only when there is one', async () => {
    signedIn();
    withProgress(progress());
    await seedBible('en');
    const padding = (node: { props: { contentContainerStyle?: unknown } }) =>
      (
        StyleSheet.flatten(node.props.contentContainerStyle as never) as {
          paddingBottom: number;
        }
      ).paddingBottom;

    const withChip = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(withChip.getByTestId('reader-plan-chip')).toBeTruthy());
    const roomWith = padding(withChip.getByTestId('reader-scroll'));
    await withChip.unmount();

    const without = await renderReader('psalms', 23);
    await waitFor(() => expect(without.getByTestId('reader-top-bar')).toBeTruthy());
    const roomWithout = padding(without.getByTestId('reader-scroll'));

    // The chip (64) and the gap above the chapter buttons (14) are extra room.
    expect(roomWith - roomWithout).toBe(78);
    await without.unmount();

    // A signed-out member has no chip, so no room is kept for one.
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const signedOut = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(signedOut.getByTestId('reader-top-bar')).toBeTruthy());
    expect(padding(signedOut.getByTestId('reader-scroll'))).toBe(roomWithout);
  });

  it('goes away with the rest of the chrome when the page is tapped, and comes back', async () => {
    signedIn();
    withProgress(progress());
    await seedBible('en');
    const { getByTestId, queryByTestId } = await renderReader('psalms', 23, {
      fromPlan: PLAN,
    });
    await waitFor(() => expect(getByTestId('reader-plan-chip')).toBeTruthy());

    fireEvent.press(getByTestId('reader-scripture-surface'));
    await waitFor(() => expect(queryByTestId('reader-plan-chip')).toBeNull());
    fireEvent.press(getByTestId('reader-scripture-surface'));
    await waitFor(() => expect(getByTestId('reader-plan-chip')).toBeTruthy());
  });

  it('marks the plan day done with the member’s own progress, and stays on the passage', async () => {
    signedIn();
    withProgress(progress({ currentDay: 2, completedDays: [1] }));
    await seedBible('en');
    const { getByTestId, replace } = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(getByTestId('reader-plan-complete-button')).toBeTruthy());

    await fireEvent.press(getByTestId('reader-plan-complete-button'));
    await waitFor(() =>
      expect(markDayComplete).toHaveBeenCalledWith('u1', 'seven-days', 2, 2, [1])
    );
    expect(startPlan).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('starts a plan the member has not begun, and then marks the day', async () => {
    signedIn();
    withProgress(null);
    await seedBible('en');
    const { getByTestId } = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(getByTestId('reader-plan-complete-button')).toBeTruthy());

    await fireEvent.press(getByTestId('reader-plan-complete-button'));
    await waitFor(() =>
      expect(markDayComplete).toHaveBeenCalledWith('u1', 'seven-days', 2, 1, [])
    );
    expect(startPlan).toHaveBeenCalledWith('u1', 'seven-days');
  });

  it('ends on "Plan complete" when that was the last day left', async () => {
    signedIn();
    withProgress(progress({ currentDay: 7, completedDays: [1, 2, 3, 4, 5, 6] }));
    await seedBible('en');
    const { getByTestId, replace } = await renderReader('psalms', 150, {
      fromPlan: { ...PLAN, dayNumber: 7 },
    });
    await waitFor(() => expect(getByTestId('reader-plan-complete-button')).toBeTruthy());

    await fireEvent.press(getByTestId('reader-plan-complete-button'));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('PlanDone', {
        plan: expect.objectContaining({
          id: 'seven-days',
          title: PLAN.title,
          dayCount: 7,
        }),
      })
    );
  });

  it('does not end the plan when the last day is marked but an earlier one was skipped', async () => {
    signedIn();
    withProgress(progress({ currentDay: 7, completedDays: [1, 2, 3, 5, 6] }));
    await seedBible('en');
    const { getByTestId, replace } = await renderReader('psalms', 150, {
      fromPlan: { ...PLAN, dayNumber: 7 },
    });
    await waitFor(() => expect(getByTestId('reader-plan-complete-button')).toBeTruthy());

    await fireEvent.press(getByTestId('reader-plan-complete-button'));
    await waitFor(() => expect(markDayComplete).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it('says Completed, with a tick, and offers no second mark, once the day is done', async () => {
    signedIn();
    withProgress(progress({ currentDay: 3, completedDays: [1, 2] }));
    await seedBible('en');
    const { getByTestId, queryByTestId } = await renderReader('psalms', 23, {
      fromPlan: PLAN,
    });
    await waitFor(() => expect(getByTestId('reader-plan-completed')).toBeTruthy());

    expect(
      within(getByTestId('reader-plan-completed')).getByText('Completed')
    ).toBeTruthy();
    expect(queryByTestId('reader-plan-complete-button')).toBeNull();
  });

  it('carries the plan to the next chapter, so its chip is still there', async () => {
    signedIn();
    withProgress(progress());
    await seedBible('en');
    const { getByTestId, navigate } = await renderReader('psalms', 23, {
      fromPlan: PLAN,
    });
    await waitFor(() => expect(getByTestId('next-chapter-button')).toBeTruthy());

    fireEvent.press(getByTestId('next-chapter-button'));
    expect(navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'psalms',
      chapterNumber: 24,
      fromPlan: PLAN,
    });
  });

  it('says so, in a notice, when the day could not be saved -- and lets the member try again', async () => {
    signedIn();
    withProgress(progress());
    (markDayComplete as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await seedBible('en');
    const { getByTestId } = await renderReader('psalms', 23, { fromPlan: PLAN });
    await waitFor(() => expect(getByTestId('reader-plan-complete-button')).toBeTruthy());

    await fireEvent.press(getByTestId('reader-plan-complete-button'));
    await waitFor(() => expect(getByTestId('reader-notice')).toBeTruthy());
    expect(getByTestId('reader-notice')).toHaveTextContent(
      translate('en', 'bible.saveFailed')
    );
    // Not stuck: the button is back and presses again.
    await waitFor(() => expect(getByTestId('reader-plan-complete-button')).toBeTruthy());
    await fireEvent.press(getByTestId('reader-plan-complete-button'));
    await waitFor(() => expect(markDayComplete).toHaveBeenCalledTimes(2));
  });
});

describe('notices', () => {
  it('confirms a copy as a toast, and says a failed copy as a warning, in words', async () => {
    await seedBible('en');
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(true);
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());

    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('copy-verse-button')).toBeTruthy());
    fireEvent.press(getByTestId('copy-verse-button'));
    await waitFor(() => expect(getByTestId('reader-notice')).toBeTruthy());
    expect(getByTestId('reader-notice')).toHaveTextContent(
      translate('en', 'bible.copied')
    );
    expect(getByTestId('reader-notice').props.accessibilityRole).toBe('alert');
  });

  it('uses the warning notice, not the confirmation, when the copy fails', async () => {
    await seedBible('en');
    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    const { getByTestId } = await renderReader('john', 3);
    await waitFor(() => expect(getByTestId('verse-16')).toBeTruthy());

    fireEvent.press(getByTestId('verse-16'));
    await waitFor(() => expect(getByTestId('copy-verse-button')).toBeTruthy());
    fireEvent.press(getByTestId('copy-verse-button'));
    await waitFor(() => expect(getByTestId('reader-notice')).toBeTruthy());
    expect(getByTestId('reader-notice')).toHaveTextContent(
      translate('en', 'bible.copyFailed')
    );
    // A NoticeBanner is a polite live region; the Toast is an alert with a tick.
    expect(getByTestId('reader-notice').props.accessibilityRole).not.toBe('alert');
  });
});
