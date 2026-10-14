import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  markDayComplete,
  startPlan,
  subscribeToPlanDays,
  subscribeToPlanProgress,
  type PlanProgress,
  type PublishedPlan,
  type PublishedPlanDay,
} from '../../../services/firebase/plans';
import { PlanDetailScreen } from '../PlanDetailScreen';
import { PlanDayScreen } from '../PlanDayScreen';
import { PlanDoneScreen } from '../PlanDoneScreen';
import { makeDay, makePlan } from '../../../testing/planFixtures';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/plans');

/**
 * The three plan screens as redesigned: the plan (not started / started /
 * finished), one day of it, and the finish. The loading, empty and failure
 * states are in planStates.test.tsx; what is here is what a member SEES and
 * DOES -- which body the plan shows for where they are, that the strip's tiles
 * and today's steps lead somewhere real, and that marking the last day done
 * ends on the finish screen and nowhere else.
 */
const PLAN: PublishedPlan = makePlan({
  description: 'A week of psalms. Read one a day, and pray as you go.',
  dayCount: 3,
});

const days: PublishedPlanDay[] = [1, 2, 3].map((n) =>
  makeDay({
    id: `day-${n}`,
    dayNumber: n,
    title: `Title ${n}`,
    scriptureReference: n === 2 ? 'Psalm 23' : `Psalm ${n}:1-6`,
    devotional: `Devotional ${n}, first.\n\nDevotional ${n}, second.`,
    prayerPrompt: `Prompt ${n}`,
  })
);

const progress = (overrides: Partial<PlanProgress> = {}): PlanProgress => ({
  startedAt: null,
  currentDay: 1,
  completedDays: [],
  lastReadAt: null,
  ...overrides,
});

function signedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: 'Jane', email: null, phoneNumber: null });
    return jest.fn();
  });
}

function withDays(list: PublishedPlanDay[] = days) {
  (subscribeToPlanDays as jest.Mock).mockImplementation((_id, onNext) => {
    onNext(list);
    return jest.fn();
  });
}

function withProgress(value: PlanProgress | null) {
  (subscribeToPlanProgress as jest.Mock).mockImplementation((_uid, _id, onNext) => {
    onNext(value);
    return jest.fn();
  });
}

function providers(ui: React.ReactElement) {
  return (
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
}

async function renderDetail(plan: PublishedPlan = PLAN) {
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
  const utils = await render(
    providers(
      <PlanDetailScreen
        route={{ params: { plan } } as never}
        navigation={navigation as never}
      />
    )
  );
  return { ...utils, navigation };
}

async function renderDay(dayNumber: number, plan: PublishedPlan = PLAN) {
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
  const utils = await render(
    providers(
      <PlanDayScreen
        route={{ params: { plan, dayNumber } } as never}
        navigation={navigation as never}
      />
    )
  );
  return { ...utils, navigation };
}

beforeEach(() => {
  signedIn();
  withDays();
  withProgress(null);
  (startPlan as jest.Mock).mockResolvedValue(undefined);
  (markDayComplete as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  jest.clearAllMocks();
});

describe('a plan not started', () => {
  it('shows its length, its title, its first sentence, every day, and Start Plan', async () => {
    const { getByTestId, getByText } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-days-list')).toBeTruthy());
    expect(getByText(/Devotional · 3 days/)).toBeTruthy();
    expect(getByTestId('plan-detail-title')).toHaveTextContent(
      'Seven Days in the Psalms'
    );
    expect(getByTestId('plan-detail-description')).toHaveTextContent(
      /^A week of psalms\.$/
    );
    for (const day of days) {
      expect(getByTestId(`plan-day-row-${day.id}`)).toHaveTextContent(
        new RegExp(`Day ${day.dayNumber} · Title ${day.dayNumber}`)
      );
      expect(getByTestId(`plan-day-row-${day.id}`)).toHaveTextContent(
        new RegExp(day.scriptureReference)
      );
    }
    expect(getByTestId('plan-start-continue-button')).toHaveTextContent('Start Plan');
  });

  it('starts the plan and opens day 1', async () => {
    const { getByTestId, navigation } = await renderDetail();
    await waitFor(() =>
      expect(
        getByTestId('plan-start-continue-button').props.accessibilityState.disabled
      ).toBe(false)
    );
    await fireEvent.press(getByTestId('plan-start-continue-button'));
    await waitFor(() => expect(startPlan).toHaveBeenCalledWith('u1', 'psalms'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanDay', {
      plan: PLAN,
      dayNumber: 1,
    });
  });

  it('draws the church’s cover when the plan has one, and none when it has not', async () => {
    const withCover = await renderDetail({
      ...PLAN,
      coverImageUrl: 'https://example.com/c.jpg',
    });
    expect(withCover.getByTestId('plan-detail-cover')).toBeTruthy();
    await withCover.unmount();
    const without = await renderDetail();
    expect(without.queryByTestId('plan-detail-cover')).toBeNull();
  });

  it('names English in the kicker of an English plan in a Telugu app, and in no other case', async () => {
    const { getByText, queryByText, unmount } = await renderDetail();
    expect(queryByText(/ఇంగ్లీష్/)).toBeNull();
    expect(getByText(/Devotional · 3 days/)).toBeTruthy();
    unmount();

    await AsyncStorage.setItem('app_language_preference', 'te');
    const telugu = await renderDetail();
    await waitFor(() => expect(telugu.getByText(/ఇంగ్లీష్/)).toBeTruthy());
    await AsyncStorage.removeItem('app_language_preference');
  });

  it('has a top bar named for the plan whose Back leaves it', async () => {
    const { getByRole, getAllByText, navigation } = await renderDetail();
    expect(getAllByText('Seven Days in the Psalms').length).toBeGreaterThan(0);
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('keeps Start Plan disabled for a member who is signed out', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const { getByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-days-list')).toBeTruthy());
    expect(
      getByTestId('plan-start-continue-button').props.accessibilityState.disabled
    ).toBe(true);
  });
});

describe('a plan in progress', () => {
  beforeEach(() => withProgress(progress({ currentDay: 2, completedDays: [1] })));

  it('says how far: the day, the percent, and a thread to that width', async () => {
    const { getByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-detail-progress')).toBeTruthy());
    expect(getByTestId('plan-detail-progress')).toHaveTextContent(/Day 2 of 3/);
    expect(getByTestId('plan-detail-progress')).toHaveTextContent(/33%/);
    const fill = getByTestId('plan-detail-progress-thread', {
      includeHiddenElements: true,
    }).children[0] as unknown as { props: { style: unknown } };
    expect(
      (StyleSheet.flatten(fill.props.style as never) as { width: string }).width
    ).toBe('33%');
  });

  it('draws a tile for every day, with the done one ticked, the current one marked Next, and each opening its day', async () => {
    const { getByTestId, navigation } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-day-strip')).toBeTruthy());
    expect(getByTestId('plan-strip-day-1').props.accessibilityLabel).toBe(
      'Day 1, Completed'
    );
    expect(getByTestId('plan-strip-day-2').props.accessibilityLabel).toBe('Day 2, Next');
    expect(getByTestId('plan-strip-day-2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('plan-strip-day-3').props.accessibilityLabel).toBe('Day 3');
    expect(getByTestId('plan-strip-day-3').props.accessibilityState.selected).toBe(false);

    await fireEvent.press(getByTestId('plan-strip-day-3'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanDay', {
      plan: PLAN,
      dayNumber: 3,
    });
  });

  it('lists today’s three steps, and Read opens the Bible at the passage', async () => {
    const { getByTestId, navigation } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-today')).toBeTruthy());
    expect(getByTestId('plan-step-read')).toHaveTextContent(/Read · Psalm 23/);
    expect(getByTestId('plan-step-read')).toHaveTextContent(/Open in the Bible/);
    expect(getByTestId('plan-step-reflect')).toHaveTextContent(/Reflect/);
    expect(getByTestId('plan-step-pray')).toHaveTextContent(/Prompt 2/);

    await fireEvent.press(getByTestId('plan-step-read'));
    // With the plan and the day, so the reader can show the plan's chip.
    expect(navigation.navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'psalms',
      chapterNumber: 23,
      verse: undefined,
      fromPlan: {
        planId: 'psalms',
        title: 'Seven Days in the Psalms',
        dayCount: 3,
        dayNumber: 2,
      },
    });
    await fireEvent.press(getByTestId('plan-step-reflect'));
    expect(navigation.navigate).toHaveBeenCalledWith('PlanDay', {
      plan: PLAN,
      dayNumber: 2,
    });
  });

  it('leaves the Read row as words, opening nothing, when the reading is not a passage the app has', async () => {
    withDays(
      days.map((d) =>
        d.dayNumber === 2 ? { ...d, scriptureReference: 'Somewhere 9' } : d
      )
    );
    const { getByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-step-read')).toBeTruthy());
    expect(getByTestId('plan-step-read').props.accessibilityRole).not.toBe('button');
  });

  it('offers Continue · Day 2 in the bar, and opens that day', async () => {
    const { getByTestId, navigation } = await renderDetail();
    await waitFor(() =>
      expect(
        getByTestId('plan-start-continue-button').props.accessibilityState.disabled
      ).toBe(false)
    );
    expect(getByTestId('plan-start-continue-button')).toHaveTextContent(
      'Continue · Day 2'
    );
    await fireEvent.press(getByTestId('plan-start-continue-button'));
    expect(startPlan).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('PlanDay', {
      plan: PLAN,
      dayNumber: 2,
    });
  });
});

describe('a plan with every day done', () => {
  it('offers to choose another plan instead of Continue, which opens Bible › Plans', async () => {
    withProgress(progress({ currentDay: 4, completedDays: [1, 2, 3] }));
    const { getByTestId, queryByTestId, navigation } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-choose-another')).toBeTruthy());
    expect(queryByTestId('plan-start-continue-button')).toBeNull();
    await fireEvent.press(getByTestId('plan-choose-another'));
    expect(navigation.navigate).toHaveBeenCalledWith('BibleBooks', { tab: 'plans' });
  });
});

describe('one day of a plan', () => {
  beforeEach(() => withProgress(progress({ currentDay: 2, completedDays: [1] })));

  it('shows the reference, the title, the reading step, the reflection by paragraph and the prayer', async () => {
    const { getByTestId, getByText } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    expect(getByText('Psalm 23')).toBeTruthy();
    expect(getByTestId('plan-day-title')).toHaveTextContent('Title 2');
    expect(getByTestId('plan-day-read')).toHaveTextContent(/Read · Psalm 23/);
    expect(getByText('Devotional 2, first.')).toBeTruthy();
    expect(getByText('Devotional 2, second.')).toBeTruthy();
    expect(getByTestId('plan-day-prayer')).toHaveTextContent('Prompt 2');
  });

  it('names the day in the top bar, and says how far in the bar at the foot', async () => {
    const { getAllByText, getByTestId } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-bar')).toBeTruthy());
    expect(getAllByText('Day 2 of 3').length).toBeGreaterThan(0);
    expect(getByTestId('plan-day-progress')).toHaveTextContent(/33%/);
  });

  it('opens the Bible at the passage from the Read step', async () => {
    const { getByTestId, navigation } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-read')).toBeTruthy());
    await fireEvent.press(getByTestId('plan-day-read'));
    expect(navigation.navigate).toHaveBeenCalledWith('BibleChapter', {
      bookId: 'psalms',
      chapterNumber: 23,
      verse: undefined,
      fromPlan: {
        planId: 'psalms',
        title: 'Seven Days in the Psalms',
        dayCount: 3,
        dayNumber: 2,
      },
    });
  });

  it('leaves out the prayer section for a day with no prompt', async () => {
    withDays(days.map((d) => ({ ...d, prayerPrompt: '' })));
    const { getByTestId, queryByTestId } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    expect(queryByTestId('plan-day-prayer')).toBeNull();
  });

  it('marks the day complete with the plan’s own numbers', async () => {
    const { getByTestId } = await renderDay(2);
    await waitFor(() =>
      expect(getByTestId('plan-day-mark-complete')).toHaveTextContent('Mark Complete')
    );
    await fireEvent.press(getByTestId('plan-day-mark-complete'));
    await waitFor(() =>
      expect(markDayComplete).toHaveBeenCalledWith('u1', 'psalms', 2, 2, [1])
    );
  });

  it('does not end on the finish screen when days remain', async () => {
    const { getByTestId, navigation } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-mark-complete')).toBeTruthy());
    await fireEvent.press(getByTestId('plan-day-mark-complete'));
    await waitFor(() => expect(markDayComplete).toHaveBeenCalled());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('opens the finish screen, in place of the day, when the last day is marked', async () => {
    withProgress(progress({ currentDay: 3, completedDays: [1, 2] }));
    const { getByTestId, navigation } = await renderDay(3);
    await waitFor(() => expect(getByTestId('plan-day-mark-complete')).toBeTruthy());
    await fireEvent.press(getByTestId('plan-day-mark-complete'));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('PlanDone', { plan: PLAN })
    );
  });

  it('does not finish a plan whose earlier day was skipped, when the last is marked', async () => {
    withProgress(progress({ currentDay: 3, completedDays: [2] }));
    const { getByTestId, navigation } = await renderDay(3);
    await waitFor(() => expect(getByTestId('plan-day-mark-complete')).toBeTruthy());
    await fireEvent.press(getByTestId('plan-day-mark-complete'));
    await waitFor(() => expect(markDayComplete).toHaveBeenCalled());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('says Completed, no longer presses, and offers the next day, once the day is done', async () => {
    withProgress(progress({ currentDay: 3, completedDays: [1, 2] }));
    const { getByTestId, navigation } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-next')).toBeTruthy());
    expect(getByTestId('plan-day-mark-complete')).toHaveTextContent('Completed');
    expect(getByTestId('plan-day-mark-complete').props.accessibilityState.disabled).toBe(
      true
    );
    expect(getByTestId('plan-day-next')).toHaveTextContent(/Next: day 3 · Title 3/);

    await fireEvent.press(getByTestId('plan-day-next'));
    expect(navigation.replace).toHaveBeenCalledWith('PlanDay', {
      plan: PLAN,
      dayNumber: 3,
    });
  });

  it('offers no next day on the last day', async () => {
    withProgress(progress({ currentDay: 4, completedDays: [1, 2, 3] }));
    const { getByTestId, queryByTestId } = await renderDay(3);
    await waitFor(() =>
      expect(getByTestId('plan-day-mark-complete')).toHaveTextContent('Completed')
    );
    expect(queryByTestId('plan-day-next')).toBeNull();
  });

  it('only starts a plan that has not been started, and marks nothing', async () => {
    withProgress(null);
    const { getByTestId } = await renderDay(1);
    await waitFor(() =>
      expect(getByTestId('plan-day-mark-complete')).toHaveTextContent('Start Plan')
    );
    await fireEvent.press(getByTestId('plan-day-mark-complete'));
    await waitFor(() => expect(startPlan).toHaveBeenCalledWith('u1', 'psalms'));
    expect(markDayComplete).not.toHaveBeenCalled();
  });
});

describe('the finish', () => {
  async function renderDone() {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const utils = await render(
      providers(
        <PlanDoneScreen
          route={{ params: { plan: PLAN } } as never}
          navigation={navigation as never}
        />
      )
    );
    return { ...utils, navigation };
  }

  it('says the plan is complete, in words, with its name and length', async () => {
    const { getByTestId, getByText, queryByText } = await renderDone();
    expect(getByTestId('plan-done-title')).toHaveTextContent('Plan complete');
    expect(getByTestId('plan-done-message')).toHaveTextContent(
      'You read all 3 days of Seven Days in the Psalms.'
    );
    expect(getByText('Day 3 of 3')).toBeTruthy();
    // The full thread says it; no "100%" repeats it.
    expect(queryByText('100%')).toBeNull();
    expect(getByTestId('plan-done-fish', { includeHiddenElements: true })).toBeTruthy();
  });

  it('offers another plan, which goes to Bible › Plans, and a plain Done, which goes back', async () => {
    const { getByTestId, navigation } = await renderDone();
    await fireEvent.press(getByTestId('plan-done-choose-another'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'BibleBooks',
      { tab: 'plans' },
      { pop: true }
    );
    await fireEvent.press(getByTestId('plan-done-done'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('has a close at the top that goes back', async () => {
    const { getByRole, navigation } = await renderDone();
    await fireEvent.press(getByRole('button', { name: 'Close' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('the optional parts of a day', () => {
  beforeEach(() => withProgress(progress({ currentDay: 2, completedDays: [1] })));

  const full = (n: number) =>
    makeDay({
      id: `day-${n}`,
      dayNumber: n,
      title: `Title ${n}`,
      scriptureReference: 'Psalm 23',
      devotional: 'Rest in him.',
      reflectionQuestion: 'Where has he led you?',
      application: 'Call a friend this week.',
      prayerPrompt: 'Thank him.',
      notes: 'A psalm of David.',
    });

  it('shows each part the church wrote, in the order the admin site’s Preview lays them out', async () => {
    withDays([full(1), full(2), full(3)]);
    const { getByTestId, getAllByTestId } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    expect(getByTestId('plan-day-question')).toHaveTextContent('Where has he led you?');
    expect(getByTestId('plan-day-application')).toHaveTextContent(
      'Call a friend this week.'
    );
    expect(getByTestId('plan-day-prayer')).toHaveTextContent('Thank him.');
    expect(getByTestId('plan-day-notes')).toHaveTextContent('A psalm of David.');
    // Reflect, Think about it, Put it into practice, Prayer, Notes.
    expect(
      getAllByTestId(/^plan-day-(reflection|question|application|prayer|notes)$/).map(
        (part) => part.props.testID
      )
    ).toEqual([
      'plan-day-reflection',
      'plan-day-question',
      'plan-day-application',
      'plan-day-prayer',
      'plan-day-notes',
    ]);
  });

  it('names each part with a heading', async () => {
    withDays([full(1), full(2), full(3)]);
    const { getByText, getAllByRole } = await renderDay(2);
    await waitFor(() => expect(getByText('Think about it')).toBeTruthy());
    expect(getByText('Put it into practice')).toBeTruthy();
    expect(getByText('Notes')).toBeTruthy();
    const headings = getAllByRole('header').map((heading) => heading.props.children);
    expect(headings).toEqual(
      expect.arrayContaining([
        'Reflect',
        'Think about it',
        'Put it into practice',
        'Notes',
      ])
    );
  });

  it('shows only the reading for a day that is nothing else', async () => {
    withDays([
      makeDay({
        id: 'day-2',
        dayNumber: 2,
        title: 'Just a reading',
        scriptureReference: 'Psalm 23',
      }),
    ]);
    const { getByTestId, queryByTestId, queryByText } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    expect(getByTestId('plan-day-read')).toHaveTextContent(/Read · Psalm 23/);
    for (const part of ['reflection', 'question', 'application', 'prayer', 'notes']) {
      expect(queryByTestId(`plan-day-${part}`)).toBeNull();
    }
    for (const heading of [
      'Reflect',
      'Think about it',
      'Put it into practice',
      'Prayer Prompt',
      'Notes',
    ]) {
      expect(queryByText(heading)).toBeNull();
    }
    // And it can still be completed.
    expect(getByTestId('plan-day-mark-complete')).toHaveTextContent('Mark Complete');
  });

  it('shows only what is there when the church wrote some of the parts', async () => {
    withDays([
      makeDay({
        id: 'day-2',
        dayNumber: 2,
        title: 'Some',
        reflectionQuestion: 'A question?',
        notes: 'A note.',
      }),
    ]);
    const { getByTestId, queryByTestId } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    expect(getByTestId('plan-day-question')).toBeTruthy();
    expect(getByTestId('plan-day-notes')).toBeTruthy();
    expect(queryByTestId('plan-day-reflection')).toBeNull();
    expect(queryByTestId('plan-day-application')).toBeNull();
    expect(queryByTestId('plan-day-prayer')).toBeNull();
  });

  it('treats text that is only spaces and blank lines as nothing', async () => {
    withDays([
      makeDay({
        id: 'day-2',
        dayNumber: 2,
        title: 'Blank',
        devotional: '  \n\n  ',
        reflectionQuestion: '   ',
        application: '\n',
        prayerPrompt: '',
        notes: ' ',
      }),
    ]);
    const { getByTestId, queryByTestId } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    for (const part of ['reflection', 'question', 'application', 'prayer', 'notes']) {
      expect(queryByTestId(`plan-day-${part}`)).toBeNull();
    }
  });

  it('shows a day from before the plan manager, with only a devotional and a prayer, exactly as it did', async () => {
    withDays([
      makeDay({
        id: 'day-2',
        dayNumber: 2,
        title: 'Old day',
        devotional: 'Old words.',
        prayerPrompt: 'Old prayer.',
      }),
    ]);
    const { getByText, getByTestId, queryByTestId } = await renderDay(2);
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());
    expect(getByText('Old words.')).toBeTruthy();
    expect(getByTestId('plan-day-prayer')).toHaveTextContent('Old prayer.');
    expect(queryByTestId('plan-day-question')).toBeNull();
    expect(queryByTestId('plan-day-notes')).toBeNull();
  });

  it('keeps a paragraph break the church typed in the devotional', async () => {
    withDays([
      makeDay({
        id: 'day-2',
        dayNumber: 2,
        title: 'Two',
        devotional: 'First.\n\nSecond.',
      }),
    ]);
    const { getByText } = await renderDay(2);
    await waitFor(() => expect(getByText('First.')).toBeTruthy());
    expect(getByText('Second.')).toBeTruthy();
  });

  it('labels the parts in Telugu in a Telugu app', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    try {
      withDays([full(1), full(2), full(3)]);
      const { getByText } = await renderDay(2);
      await waitFor(() => expect(getByText('ఆలోచించండి')).toBeTruthy());
      expect(getByText('ఆచరణలో పెట్టండి')).toBeTruthy();
      expect(getByText('గమనికలు')).toBeTruthy();
    } finally {
      await AsyncStorage.removeItem('app_language_preference');
    }
  });
});

describe('what the church says about a plan', () => {
  const described = makePlan({
    id: 'psalms',
    title: 'Seven Days in the Psalms',
    subtitle: 'Rest for the weary',
    description: 'A week of psalms. Read one a day.',
    dayCount: 3,
    estimatedMinutes: 12,
    author: 'Pastor Samuel',
    language: 'en',
  });

  it('shows the short line, the minutes a day and who wrote it', async () => {
    const { getByTestId, getByText } = await renderDetail(described);
    await waitFor(() => expect(getByTestId('plan-days-list')).toBeTruthy());
    expect(getByTestId('plan-detail-subtitle')).toHaveTextContent('Rest for the weary');
    expect(getByText(/Devotional · 3 days · 12 min a day/)).toBeTruthy();
    expect(getByTestId('plan-detail-author')).toHaveTextContent('by Pastor Samuel');
  });

  it('shows none of them for a plan that has none, and nothing odd in their place', async () => {
    const { getByTestId, queryByTestId, getByText } = await renderDetail(
      makePlan({ id: 'psalms', title: 'Seven Days in the Psalms', dayCount: 3 })
    );
    await waitFor(() => expect(getByTestId('plan-days-list')).toBeTruthy());
    expect(queryByTestId('plan-detail-subtitle')).toBeNull();
    expect(queryByTestId('plan-detail-author')).toBeNull();
    expect(getByText(/^Devotional · 3 days$/)).toBeTruthy();
  });

  it('still shows them once the plan is started', async () => {
    withProgress(progress({ currentDay: 2, completedDays: [1] }));
    const { getByTestId } = await renderDetail(described);
    await waitFor(() => expect(getByTestId('plan-detail-progress')).toBeTruthy());
    expect(getByTestId('plan-detail-subtitle')).toHaveTextContent('Rest for the weary');
    expect(getByTestId('plan-detail-author')).toHaveTextContent('by Pastor Samuel');
  });

  it('names Telugu on a plan written in Telugu, in an English app', async () => {
    const { getByText } = await renderDetail(
      makePlan({ id: 'te', title: 'కీర్తనలలో ఏడు రోజులు', dayCount: 3, language: 'te' })
    );
    await waitFor(() => expect(getByText(/Devotional · 3 days · Telugu/)).toBeTruthy());
  });

  it('names English on a plan the church wrote in English, in a Telugu app', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    try {
      const { getByText } = await renderDetail(described);
      await waitFor(() => expect(getByText(/ఇంగ్లీష్/)).toBeTruthy());
    } finally {
      await AsyncStorage.removeItem('app_language_preference');
    }
  });

  it('names nothing when the plan is in the language of the app', async () => {
    const { getByText, queryByText } = await renderDetail(described);
    await waitFor(() =>
      expect(getByText(/Devotional · 3 days · 12 min a day$/)).toBeTruthy()
    );
    expect(queryByText(/Telugu|English/)).toBeNull();
  });
});
