import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  subscribeToAllPlanProgress,
  subscribeToPublishedPlans,
  type PlanProgress,
  type PublishedPlan,
} from '../../../services/firebase/plans';
import { PlansView } from '../PlansView';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/plans');

const plan = (id: string, overrides: Partial<PublishedPlan> = {}): PublishedPlan => ({
  id,
  title: `Plan ${id}`,
  description: `All about ${id}. And a second sentence.`,
  category: 'Devotional',
  coverImageUrl: null,
  dayCount: 7,
  ...overrides,
});

const progress = (overrides: Partial<PlanProgress> = {}): PlanProgress => ({
  startedAt: null,
  currentDay: 1,
  completedDays: [],
  lastReadAt: null,
  ...overrides,
});

function library(plans: PublishedPlan[]) {
  (subscribeToPublishedPlans as jest.Mock).mockImplementation((onNext) => {
    onNext(plans);
    return jest.fn();
  });
}

function started(all: Record<string, PlanProgress>) {
  (subscribeToAllPlanProgress as jest.Mock).mockImplementation((_uid, onNext) => {
    onNext(all);
    return jest.fn();
  });
}

function signedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: 'Jane', email: null, phoneNumber: null });
    return jest.fn();
  });
}

async function renderView() {
  const onOpenPlan = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <PlansView onOpenPlan={onOpenPlan} />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, onOpenPlan };
}

beforeEach(() => {
  signedIn();
  started({});
});

afterEach(async () => {
  await AsyncStorage.clear();
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  jest.clearAllMocks();
});

describe('the chips', () => {
  it('opens on My plans, and says which chip is chosen', async () => {
    library([plan('a')]);
    const { getByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plans-chip-my')).toBeTruthy());
    expect(getByTestId('plans-chip-my').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('plans-chip-find').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('plans-chip-completed').props.accessibilityState.selected).toBe(
      false
    );
  });

  it('sorts the library: started plans under My plans, the rest under Find plans, finished under Completed', async () => {
    library([plan('psalms'), plan('luke'), plan('romans', { dayCount: 2 })]);
    started({
      psalms: progress({ currentDay: 2, completedDays: [1] }),
      romans: progress({ currentDay: 3, completedDays: [1, 2] }),
    });
    const { getByTestId, queryByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plan-psalms')).toBeTruthy());
    expect(queryByTestId('plan-luke')).toBeNull();
    expect(queryByTestId('plan-romans')).toBeNull();

    await fireEvent.press(getByTestId('plans-chip-find'));
    expect(getByTestId('plan-luke')).toBeTruthy();
    expect(queryByTestId('plan-psalms')).toBeNull();

    await fireEvent.press(getByTestId('plans-chip-completed'));
    expect(getByTestId('plan-romans')).toBeTruthy();
    expect(queryByTestId('plan-luke')).toBeNull();
  });
});

describe('a started plan', () => {
  it('says the day and the percent, and draws a gold thread to that width', async () => {
    library([plan('psalms')]);
    started({ psalms: progress({ currentDay: 2, completedDays: [1] }) });
    const { getByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plan-psalms')).toBeTruthy());
    expect(getByTestId('plan-psalms')).toHaveTextContent(/Day 2 of 7 · 14%/);
    const fill = getByTestId('plan-psalms-thread').children[0] as unknown as {
      props: { style: unknown };
    };
    expect(
      (StyleSheet.flatten(fill.props.style as never) as { width: string }).width
    ).toBe('14%');
  });

  it('names the row by its title and where the member is', async () => {
    library([plan('psalms', { title: 'Seven Days in the Psalms' })]);
    started({ psalms: progress({ currentDay: 2, completedDays: [1] }) });
    const { getByRole } = await renderView();
    await waitFor(() =>
      expect(
        getByRole('button', { name: 'Seven Days in the Psalms. Day 2 of 7 · 14%' })
      ).toBeTruthy()
    );
  });

  it('opens the plan when the row is pressed', async () => {
    library([plan('psalms')]);
    started({ psalms: progress({ currentDay: 2, completedDays: [1] }) });
    const { getByTestId, onOpenPlan } = await renderView();
    await waitFor(() => expect(getByTestId('plan-psalms')).toBeTruthy());
    await fireEvent.press(getByTestId('plan-psalms'));
    expect(onOpenPlan).toHaveBeenCalledWith(expect.objectContaining({ id: 'psalms' }));
  });

  it('lists the plan read most recently first', async () => {
    library([plan('a'), plan('b')]);
    started({
      a: progress({ lastReadAt: new Date(2026, 9, 1) }),
      b: progress({ lastReadAt: new Date(2026, 9, 9) }),
    });
    const { getAllByTestId } = await renderView();
    await waitFor(() => expect(getAllByTestId(/^plan-[ab]$/)).toHaveLength(2));
    expect(getAllByTestId(/^plan-[ab]$/).map((row) => row.props.testID)).toEqual([
      'plan-b',
      'plan-a',
    ]);
  });
});

describe('Find plans', () => {
  it('says what each plan is: its category and length, and its first sentence', async () => {
    library([
      plan('luke', {
        title: 'The Life of Christ in Luke',
        category: 'Gospels',
        dayCount: 30,
      }),
    ]);
    const { getByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    expect(getByTestId('plan-luke')).toHaveTextContent(/Gospels · 30 days/);
    expect(getByTestId('plan-luke')).toHaveTextContent(/All about luke\./);
    // Only the first sentence: the row is a taste, the plan is the plan.
    expect(getByTestId('plan-luke')).not.toHaveTextContent(/second sentence/);
  });

  it('says "1 day" for a one-day plan', async () => {
    library([plan('one', { dayCount: 1 })]);
    const { getByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    expect(getByTestId('plan-one')).toHaveTextContent(/Devotional · 1 day(?!s)/);
  });

  it('draws the church’s cover when a plan has one, and none when it does not', async () => {
    library([
      plan('with', { coverImageUrl: 'https://example.com/c.jpg' }),
      plan('without'),
    ]);
    const { getByTestId, queryByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    expect(getByTestId('plan-with-cover')).toBeTruthy();
    expect(queryByTestId('plan-without-cover')).toBeNull();
  });
});

describe('Completed', () => {
  it('says so in words, on a badge, and shows the whole length', async () => {
    library([plan('romans', { dayCount: 2 })]);
    started({ romans: progress({ currentDay: 3, completedDays: [1, 2] }) });
    const { getByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-completed'));
    expect(getByTestId('plan-romans-done')).toHaveTextContent(/Completed/);
    expect(getByTestId('plan-romans')).toHaveTextContent(/Day 2 of 2/);
  });
});

describe('the language of a plan', () => {
  it('names English on a plan with no Telugu in a Telugu app, and on no other', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    library([plan('en-only'), plan('te', { title: 'కీర్తనలలో ఏడు రోజులు' })]);
    const { getByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    // Telugu "Find plans"
    expect(getByTestId('plan-en-only')).toHaveTextContent(/ఇంగ్లీష్/);
    expect(getByTestId('plan-te')).not.toHaveTextContent(/ఇంగ్లీష్/);
  });

  it('says nothing about language in an English app', async () => {
    library([plan('a')]);
    const { getByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    expect(getByTestId('plan-a')).not.toHaveTextContent(/English/);
  });
});

describe('states', () => {
  it('shows a skeleton until the library arrives', async () => {
    (subscribeToPublishedPlans as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId, queryByTestId } = await renderView();
    expect(getByTestId('plans-loading')).toBeTruthy();
    // The chips are there already.
    expect(getByTestId('plans-chip-my')).toBeTruthy();
    expect(queryByTestId('plans-error')).toBeNull();
  });

  it('shows an error with Try again when the library never arrived, and listens again', async () => {
    (subscribeToPublishedPlans as jest.Mock)
      .mockImplementationOnce((_next, onError) => {
        onError({ code: 'unavailable' });
        return jest.fn();
      })
      .mockImplementation((onNext) => {
        onNext([plan('back')]);
        return jest.fn();
      });
    const { getByTestId, getByText } = await renderView();
    await waitFor(() => expect(getByTestId('plans-error')).toBeTruthy());
    expect(getByTestId('plans-error')).toHaveTextContent(
      /Could not load reading plans\./
    );

    await fireEvent.press(getByText('Try again'));
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    expect(getByTestId('plan-back')).toBeTruthy();
  });

  it('shows the plans that ship with the app, not an error, when the read failed but the service fell back', async () => {
    // The service answers a failed read with the bundled plans AND an error.
    (subscribeToPublishedPlans as jest.Mock).mockImplementation((onNext, onError) => {
      onNext([plan('bundled')]);
      onError({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId, queryByTestId } = await renderView();
    await fireEvent.press(await waitForTestId(getByTestId, 'plans-chip-find'));
    expect(getByTestId('plan-bundled')).toBeTruthy();
    expect(queryByTestId('plans-error')).toBeNull();
  });

  it('says there are no plans at all when the church has none', async () => {
    library([]);
    const { getByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plans-empty')).toBeTruthy());
    expect(getByTestId('plans-empty')).toHaveTextContent(/No reading plans yet/);
  });

  it('invites a member who has started nothing to find one, and goes to Find plans', async () => {
    library([plan('a')]);
    const { getByTestId, queryByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plans-none-started')).toBeTruthy());
    expect(getByTestId('plans-none-started')).toHaveTextContent(/Start a Reading Plan/);

    await fireEvent.press(getByTestId('plans-find-a-plan'));
    expect(queryByTestId('plans-none-started')).toBeNull();
    expect(getByTestId('plan-a')).toBeTruthy();
    expect(getByTestId('plans-chip-find').props.accessibilityState.selected).toBe(true);
  });

  it('says nothing is completed yet, and nothing is left to find once every plan is started', async () => {
    library([plan('a')]);
    started({ a: progress({ currentDay: 2, completedDays: [1] }) });
    const { getByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plan-a')).toBeTruthy());
    await fireEvent.press(getByTestId('plans-chip-completed'));
    expect(getByTestId('plans-none-completed')).toBeTruthy();
    await fireEvent.press(getByTestId('plans-chip-find'));
    expect(getByTestId('plans-none-to-find')).toBeTruthy();
  });

  it('treats a member who is signed out as having started nothing, and does not listen for progress', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    library([plan('a')]);
    started({ a: progress({ currentDay: 2, completedDays: [1] }) });
    const { getByTestId } = await renderView();
    await waitFor(() => expect(getByTestId('plans-none-started')).toBeTruthy());
    expect(subscribeToAllPlanProgress).not.toHaveBeenCalled();
  });
});

/** The chips render with the first frame, but state set from an effect lands a tick later. */
async function waitForTestId<T>(getByTestId: (id: string) => T, id: string): Promise<T> {
  await waitFor(() => expect(getByTestId(id)).toBeTruthy());
  return getByTestId(id);
}
