import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  startPlan,
  subscribeToPlanDays,
  subscribeToPlanProgress,
  type PublishedPlan,
  type PublishedPlanDay,
} from '../../../services/firebase/plans';
import { PlanDetailScreen } from '../PlanDetailScreen';
import { PlanDayScreen } from '../PlanDayScreen';
import { translate } from '../../../i18n';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/plans');

/**
 * The plan screens' loading/empty/error states.
 *
 * Both screens used to route a READ FAILURE into the same `[]` their
 * "this plan is empty" path uses. A member whose connection dropped was
 * told the plan had no readings, or that the day "could not be found" --
 * a plausible-looking statement about the content that was actually
 * false, and that offered nothing to do about it. See the error handlers
 * in ../PlanDetailScreen.tsx and ../PlanDayScreen.tsx.
 */
const PLAN: PublishedPlan = {
  id: 'plan-1',
  title: '7 Days in Psalms',
  description: 'A week of psalms.',
  category: 'Devotional',
  coverImageUrl: null,
  dayCount: 7,
};

const DAY_ONE: PublishedPlanDay = {
  id: 'day-1',
  dayNumber: 1,
  title: 'Psalm 1',
  scriptureReference: 'Psalm 1:1-6',
  devotional: 'Blessed is the one...',
  prayerPrompt: 'Ask for a rooted heart.',
};

function mockSignedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: 'Jane Doe', email: 'jane@example.com' });
    return jest.fn();
  });
}

/** Emits `days`, or invokes the error callback when `days` is 'error'. */
function mockDays(days: PublishedPlanDay[] | 'error' | 'pending') {
  (subscribeToPlanDays as jest.Mock).mockImplementation((_id, onNext, onError) => {
    if (days === 'error') onError(new Error('unavailable'));
    else if (days !== 'pending') onNext(days);
    return jest.fn();
  });
}

function mockNoProgress() {
  (subscribeToPlanProgress as jest.Mock).mockImplementation((_uid, _id, onNext) => {
    onNext(null);
    return jest.fn();
  });
}

function renderDetail() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PlanDetailScreen
          route={{ params: { plan: PLAN } } as never}
          navigation={{ navigate: jest.fn() } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function renderDay() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PlanDayScreen
          route={{ params: { plan: PLAN, dayNumber: 1 } } as never}
          navigation={{ navigate: jest.fn() } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('PlanDetailScreen states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignedIn();
    mockNoProgress();
    (startPlan as jest.Mock).mockResolvedValue(undefined);
  });

  it('shows a loading state before the first snapshot', async () => {
    mockDays('pending');
    const { getByTestId } = await renderDetail();
    expect(getByTestId('plan-days-loading')).toBeTruthy();
  });

  it('shows the day list once days arrive', async () => {
    mockDays([DAY_ONE]);
    const { getByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-day-row-day-1')).toBeTruthy());
  });

  it('says the plan has no readings when it genuinely has none', async () => {
    mockDays([]);
    const { getByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-days-empty')).toBeTruthy());
  });

  it('reports a read FAILURE as a failure, not as an empty plan', async () => {
    mockDays('error');
    const { getByTestId, queryByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-days-error')).toBeTruthy());
    expect(queryByTestId('plan-days-empty')).toBeNull();
  });

  it('does not offer Start Plan while the days could not be read', async () => {
    // Starting a plan whose readings are unavailable would record progress
    // against content the member cannot open.
    mockDays('error');
    const { getByTestId } = await renderDetail();
    await waitFor(() => expect(getByTestId('plan-days-error')).toBeTruthy());
    expect(
      getByTestId('plan-start-continue-button').props.accessibilityState.disabled
    ).toBe(true);
  });
});

describe('PlanDayScreen states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignedIn();
    mockNoProgress();
    (startPlan as jest.Mock).mockResolvedValue(undefined);
  });

  it('reports a read failure as a connection problem, not a missing day', async () => {
    mockDays('error');
    const { getByTestId, queryByTestId } = await renderDay();
    await waitFor(() => expect(getByTestId('plan-day-error')).toBeTruthy());
    expect(queryByTestId('plan-day-not-found')).toBeNull();
  });

  it('still says "not found" for a day that really is absent', async () => {
    mockDays([]);
    const { getByTestId } = await renderDay();
    await waitFor(() => expect(getByTestId('plan-day-not-found')).toBeTruthy());
  });

  /**
   * A member reaching a day straight from the plan's day list has no
   * progress document yet. "Mark Complete" used to be permanently
   * disabled here -- a dead button with nothing explaining it.
   */
  it('offers Start Plan, enabled, when the member has not started the plan', async () => {
    mockDays([DAY_ONE]);
    const { getByTestId, getByText } = await renderDay();
    await waitFor(() => expect(getByTestId('plan-day-screen')).toBeTruthy());

    // The label is localized; the default language is Telugu.
    expect(getByText(translate('en', 'plans.start'))).toBeTruthy();
    expect(getByTestId('plan-day-mark-complete').props.accessibilityState.disabled).toBe(
      false
    );

    await fireEvent.press(getByTestId('plan-day-mark-complete'));
    await waitFor(() => expect(startPlan).toHaveBeenCalledWith('u1', 'plan-1'));
  });
});
