import { onSnapshot } from 'firebase/firestore';
import {
  isBundledPlanId,
  subscribeToPlanDays,
  subscribeToPublishedPlans,
  type PublishedPlan,
  type PublishedPlanDay,
} from '../plans';
import { SEED_PLANS } from '../../../features/plans/seedPlans';

jest.mock('../app', () => ({ db: {} }));

/**
 * The five starter plans, and when they step aside.
 *
 * ../../features/plans/seedPlans.ts has defined five reading plans since
 * V1, but nothing except its own test imported them: they reached members
 * only if somebody ran scripts/seed-plans.mjs against production
 * Firestore. Nobody had, so "Start a Reading Plan" led to "No reading
 * plans yet" in the release build -- a finished feature that looked
 * unbuilt.
 *
 * The rule these tests pin is narrow and matters in both directions: the
 * bundled plans appear when the church has published NONE, and disappear
 * the moment it publishes one.
 */
function snapshotOf(docs: { id: string; data: () => unknown }[]) {
  return { docs };
}

/** Delivers a Firestore snapshot to whatever subscribes next. */
function deliver(docs: { id: string; data: () => unknown }[]) {
  (onSnapshot as jest.Mock).mockImplementation((_q, onNext) => {
    onNext(snapshotOf(docs));
    return jest.fn();
  });
}

/** Fails whatever subscribes next, the way an offline device would. */
function fail() {
  (onSnapshot as jest.Mock).mockImplementation((_q, _onNext, onError) => {
    onError?.({ code: 'unavailable' });
    return jest.fn();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the plan library', () => {
  it('hands back all five bundled plans when Firestore has none', () => {
    deliver([]);
    const onNext = jest.fn();
    subscribeToPublishedPlans(onNext, jest.fn());

    const plans = onNext.mock.calls[0][0] as PublishedPlan[];
    expect(plans).toHaveLength(5);
    expect(plans).toHaveLength(SEED_PLANS.length);
  });

  it('gives each bundled plan a real title, description and day count', () => {
    // Not placeholder text: these are what a member reads in the library.
    deliver([]);
    const onNext = jest.fn();
    subscribeToPublishedPlans(onNext, jest.fn());

    for (const plan of onNext.mock.calls[0][0] as PublishedPlan[]) {
      expect(plan.title.trim().length).toBeGreaterThan(0);
      expect(plan.description.trim().length).toBeGreaterThan(0);
      expect(plan.category.trim().length).toBeGreaterThan(0);
      expect(plan.dayCount).toBeGreaterThan(0);
    }
  });

  it('keeps the seed slugs as ids, so saved progress survives seeding', () => {
    deliver([]);
    const onNext = jest.fn();
    subscribeToPublishedPlans(onNext, jest.fn());

    const ids = (onNext.mock.calls[0][0] as PublishedPlan[]).map((plan) => plan.id);
    expect(ids).toEqual(SEED_PLANS.map((seed) => seed.id));
  });

  it("STANDS ASIDE the moment the church publishes one of its own", () => {
    // The important half. A church that writes its own plans must not
    // find five app-created ones mixed in with them.
    deliver([
      {
        id: 'church-plan',
        data: () => ({
          title: 'Our own plan',
          description: 'Written by the church.',
          category: 'Devotional',
          coverImageUrl: null,
          dayCount: 3,
        }),
      },
    ]);
    const onNext = jest.fn();
    subscribeToPublishedPlans(onNext, jest.fn());

    const plans = onNext.mock.calls[0][0] as PublishedPlan[];
    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe('church-plan');
  });

  it('falls back when the read FAILS, and still reports the error', () => {
    // An offline member should get the plans the app is carrying rather
    // than an error about content it already has.
    fail();
    const onNext = jest.fn();
    const onError = jest.fn();
    subscribeToPublishedPlans(onNext, onError);

    expect((onNext.mock.calls[0][0] as PublishedPlan[]).length).toBe(5);
    expect(onError).toHaveBeenCalled();
  });
});

describe('a plan’s days', () => {
  const firstSeed = SEED_PLANS[0]!;

  it('hands back the bundled days for a bundled plan', () => {
    deliver([]);
    const onNext = jest.fn();
    subscribeToPlanDays(firstSeed.id, onNext, jest.fn());

    const days = onNext.mock.calls[0][0] as PublishedPlanDay[];
    expect(days).toHaveLength(firstSeed.days.length);
    expect(days[0]?.dayNumber).toBe(1);
    expect(days[0]?.scriptureReference.trim().length).toBeGreaterThan(0);
  });

  it('numbers them from one, in order', () => {
    deliver([]);
    const onNext = jest.fn();
    subscribeToPlanDays(firstSeed.id, onNext, jest.fn());

    const days = onNext.mock.calls[0][0] as PublishedPlanDay[];
    expect(days.map((day) => day.dayNumber)).toEqual(
      days.map((_day, index) => index + 1)
    );
  });

  it('prefers the church’s own days when they exist', () => {
    deliver([
      {
        id: 'd1',
        data: () => ({
          dayNumber: 1,
          title: 'The church’s day one',
          scriptureReference: 'John 1',
          devotional: 'Written by the church.',
          prayerPrompt: '',
        }),
      },
    ]);
    const onNext = jest.fn();
    subscribeToPlanDays(firstSeed.id, onNext, jest.fn());

    const days = onNext.mock.calls[0][0] as PublishedPlanDay[];
    expect(days).toHaveLength(1);
    expect(days[0]?.title).toBe('The church’s day one');
  });

  it('hands back nothing for a plan that is neither bundled nor stored', () => {
    deliver([]);
    const onNext = jest.fn();
    subscribeToPlanDays('a-plan-that-does-not-exist', onNext, jest.fn());
    expect(onNext.mock.calls[0][0]).toEqual([]);
  });
});

describe('isBundledPlanId', () => {
  it('recognises every seed plan, and nothing else', () => {
    for (const seed of SEED_PLANS) expect(isBundledPlanId(seed.id)).toBe(true);
    expect(isBundledPlanId('church-plan')).toBe(false);
  });
});
