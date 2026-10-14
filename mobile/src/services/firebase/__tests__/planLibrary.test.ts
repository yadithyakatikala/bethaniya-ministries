import { getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  comparePublishedPlans,
  getBundledPlan,
  subscribeToMostRecentPlanProgress,
  subscribeToPlanDays,
  subscribeToPublishedPlans,
  toPublishedPlan,
  toPublishedPlanDay,
  type PublishedPlan,
} from '../plans';
import { SEED_PLANS } from '../../../features/plans/seedPlans';
import { makePlan } from '../../../testing/planFixtures';

jest.mock('../app', () => ({ db: {} }));

/**
 * The plans a member can read, as the admin site's plan manager writes them.
 *
 * Two queries feed the library -- the published plans, and the scheduled ones
 * whose time has come -- and what these tests pin is the contract between the
 * two sides: which documents are asked for (the rules refuse a member any
 * query that could reach a draft or an archived plan, so the QUERY is the
 * visibility rule on the phone), how they are merged, and that a failure of
 * the second never spoils the first. firestore.rules and the real queries are
 * checked against the emulator in firebase-tests/.
 */

interface Constraint {
  field: string;
  op: string;
  value: unknown;
}
interface Listener {
  constraints: Constraint[];
  next: (snapshot: unknown) => void;
  error: (error: { code: string }) => void;
  unsubscribe: jest.Mock;
}

const listeners: Listener[] = [];

const published = () =>
  listeners.find((l) => l.constraints.some((c) => c.field === 'published'))!;
const dueListeners = () =>
  listeners.filter((l) => l.constraints.some((c) => c.field === 'status'));
const latestDue = () => dueListeners().at(-1)!;

function snapshotOf(...docs: [string, Record<string, unknown>][]) {
  return { docs: docs.map(([id, data]) => ({ id, data: () => data })) };
}

/** A plan document as the plan manager writes it. */
function planDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'A plan',
    subtitle: 'A line under the title',
    description: 'What it is about.',
    category: 'Devotional',
    coverImageUrl: 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg',
    dayCount: 7,
    language: 'en',
    estimatedMinutes: 10,
    author: 'Pastor Samuel',
    order: 1,
    status: 'published',
    published: true,
    ...overrides,
  };
}

const NOW = new Date('2026-06-01T12:00:00Z');
const boundOf = (listener: Listener) =>
  (
    listener.constraints.find((c) => c.field === 'publishAt')!.value as {
      seconds: number;
    }
  ).seconds;
const secondsAt = (date: Date) => Math.floor(date.getTime() / 1000);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  listeners.length = 0;
  (where as jest.Mock).mockImplementation((field, op, value) => ({ field, op, value }));
  (query as jest.Mock).mockImplementation((_ref, ...constraints) => ({ constraints }));
  (onSnapshot as jest.Mock).mockImplementation((q, next, error) => {
    const unsubscribe = jest.fn();
    listeners.push({ constraints: q.constraints, next, error, unsubscribe });
    return unsubscribe;
  });
});

afterEach(() => {
  jest.useRealTimers();
  (where as jest.Mock).mockReset();
  (query as jest.Mock).mockImplementation((...args) => args[0]);
});

function subscribe(onError = jest.fn()) {
  const onNext = jest.fn();
  const stop = subscribeToPublishedPlans(onNext, onError, { now: () => NOW });
  return { onNext, onError, stop };
}

const lastLibrary = (onNext: jest.Mock) =>
  (onNext.mock.calls.at(-1)![0] as PublishedPlan[]).map((plan) => plan.id);

describe('which plans are asked for', () => {
  it('asks for the published plans, and for those only', () => {
    subscribe();
    expect(published().constraints).toEqual([
      { field: 'published', op: '==', value: true },
    ]);
  });

  it('does not ask Firestore to order by `order`, which would silently drop a plan that has none', () => {
    subscribe();
    expect(orderBy).not.toHaveBeenCalledWith('order', expect.anything());
    expect(orderBy).not.toHaveBeenCalledWith('order');
  });

  it('asks for scheduled plans only up to a moment just behind the phone’s clock', () => {
    subscribe();
    const due = latestDue();
    expect(due.constraints[0]).toEqual({ field: 'status', op: '==', value: 'scheduled' });
    expect(due.constraints[1]).toMatchObject({ field: 'publishAt', op: '<=' });
    // A minute behind the phone's clock, so a clock that runs a little fast is not refused.
    expect(boundOf(due)).toBe(secondsAt(new Date(NOW.getTime() - 60_000)));
  });

  it('asks for nothing else: no draft, no archived plan, no scheduled plan without a time bound', () => {
    subscribe();
    const asked = listeners.map((listener) =>
      listener.constraints
        .map(
          (c) =>
            `${c.field} ${c.op} ${typeof c.value === 'object' ? '<time>' : String(c.value)}`
        )
        .join(' AND ')
    );
    expect(asked.sort()).toEqual([
      'published == true',
      'status == scheduled AND publishAt <= <time>',
    ]);
  });
});

describe('the library a member sees', () => {
  it('is the published plans, in the church’s order and then by title', () => {
    const { onNext } = subscribe();
    published().next(
      snapshotOf(
        ['c', planDoc({ title: 'B', order: 2 })],
        ['b', planDoc({ title: 'B', order: 1 })],
        ['a', planDoc({ title: 'A', order: 1 })]
      )
    );
    expect(lastLibrary(onNext)).toEqual(['a', 'b', 'c']);
  });

  it('includes a plan that has no order, as order 0, instead of leaving it out', () => {
    const { onNext } = subscribe();
    const { order: _order, ...withoutOrder } = planDoc({ title: 'Older plan' });
    published().next(
      snapshotOf(['older', withoutOrder], ['newer', planDoc({ order: 5 })])
    );
    expect(lastLibrary(onNext)).toEqual(['older', 'newer']);
    expect((onNext.mock.calls[0]![0] as PublishedPlan[])[0]!.order).toBe(0);
  });

  it('adds the scheduled plans whose time has come', () => {
    const { onNext } = subscribe();
    published().next(snapshotOf(['live', planDoc({ order: 1 })]));
    latestDue().next(
      snapshotOf(['due', planDoc({ order: 2, status: 'scheduled', published: false })])
    );
    expect(lastLibrary(onNext)).toEqual(['live', 'due']);
  });

  it('lists a plan once even if both queries return it', () => {
    const { onNext } = subscribe();
    published().next(snapshotOf(['both', planDoc()]));
    latestDue().next(snapshotOf(['both', planDoc({ status: 'scheduled' })]));
    expect(lastLibrary(onNext)).toEqual(['both']);
  });

  it('shows the published plans at once, without waiting for the scheduled query', () => {
    const { onNext } = subscribe();
    published().next(snapshotOf(['live', planDoc()]));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(lastLibrary(onNext)).toEqual(['live']);
  });

  it('shows nothing until the published query has answered', () => {
    const { onNext } = subscribe();
    latestDue().next(snapshotOf(['due', planDoc({ status: 'scheduled' })]));
    expect(onNext).not.toHaveBeenCalled();
    published().next(snapshotOf(['live', planDoc({ order: 0 })]));
    expect(lastLibrary(onNext)).toEqual(['live', 'due']);
  });

  it('picks up a plan that becomes due while the library is open', () => {
    const { onNext } = subscribe();
    published().next(snapshotOf(['live', planDoc({ order: 1 })]));
    latestDue().next(snapshotOf());
    expect(lastLibrary(onNext)).toEqual(['live']);

    latestDue().next(snapshotOf(['soon', planDoc({ order: 2, status: 'scheduled' })]));
    expect(lastLibrary(onNext)).toEqual(['live', 'soon']);
  });

  it('drops a plan that was unpublished', () => {
    const { onNext } = subscribe();
    published().next(
      snapshotOf(['a', planDoc({ order: 1 })], ['b', planDoc({ order: 2 })])
    );
    published().next(snapshotOf(['a', planDoc({ order: 1 })]));
    expect(lastLibrary(onNext)).toEqual(['a']);
  });

  describe('when the church has published nothing', () => {
    it('falls back to the starter plans that ship with the app', () => {
      const { onNext } = subscribe();
      published().next(snapshotOf());
      latestDue().next(snapshotOf());
      expect(lastLibrary(onNext)).toEqual(SEED_PLANS.map((seed) => seed.id));
    });

    it('steps aside for a scheduled plan that has come due, which is the church’s own', () => {
      const { onNext } = subscribe();
      published().next(snapshotOf());
      latestDue().next(snapshotOf(['due', planDoc({ status: 'scheduled' })]));
      expect(lastLibrary(onNext)).toEqual(['due']);
    });
  });
});

describe('when something fails', () => {
  it('falls back to the starter plans and reports it when the published plans cannot be read', () => {
    const { onNext, onError } = subscribe();
    const error = { code: 'unavailable' };
    published().error(error);
    expect(lastLibrary(onNext)).toEqual(SEED_PLANS.map((seed) => seed.id));
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('keeps quiet about a scheduled-plans query that fails, and leaves the library as it was', () => {
    const { onNext, onError } = subscribe();
    published().next(snapshotOf(['live', planDoc()]));
    latestDue().error({ code: 'failed-precondition' });
    expect(onError).not.toHaveBeenCalled();
    expect(lastLibrary(onNext)).toEqual(['live']);
  });

  it('asks again further back, once, when the server refuses the bound as later than its own clock', () => {
    const { onNext, onError } = subscribe();
    published().next(snapshotOf(['live', planDoc()]));
    const first = latestDue();
    first.error({ code: 'permission-denied' });

    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(dueListeners()).toHaveLength(2);
    const retry = latestDue();
    expect(boundOf(retry)).toBe(secondsAt(new Date(NOW.getTime() - 10 * 60_000)));

    // The retry works.
    retry.next(snapshotOf(['due', planDoc({ order: 2, status: 'scheduled' })]));
    expect(lastLibrary(onNext)).toEqual(['live', 'due']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('gives up quietly if the retry is refused too', () => {
    const { onNext, onError } = subscribe();
    published().next(snapshotOf(['live', planDoc()]));
    latestDue().error({ code: 'permission-denied' });
    latestDue().error({ code: 'permission-denied' });
    expect(dueListeners()).toHaveLength(2);
    expect(onError).not.toHaveBeenCalled();
    expect(lastLibrary(onNext)).toEqual(['live']);
  });

  it('does not let a late answer to a stopped subscription through', () => {
    const { onNext, stop } = subscribe();
    const listener = published();
    stop();
    const calls = onNext.mock.calls.length;
    latestDue().next(snapshotOf(['due', planDoc()]));
    expect(onNext.mock.calls.length).toBe(calls);
    expect(listener.unsubscribe).toHaveBeenCalled();
  });
});

describe('keeping the scheduled plans current', () => {
  it('asks again every five minutes with a later bound, and lets go of the earlier question', () => {
    subscribe();
    const first = latestDue();
    const firstBound = boundOf(first);

    jest.advanceTimersByTime(5 * 60_000);
    expect(dueListeners()).toHaveLength(2);
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    // `now` is the injected, fixed clock here, so the bound is the same; what
    // matters is that it was asked again and the old question was dropped.
    expect(boundOf(latestDue())).toBe(firstBound);

    jest.advanceTimersByTime(5 * 60_000);
    expect(dueListeners()).toHaveLength(3);
  });

  it('uses the clock at the time it asks again', () => {
    let clock = NOW.getTime();
    const onNext = jest.fn();
    subscribeToPublishedPlans(onNext, jest.fn(), { now: () => new Date(clock) });
    const firstBound = boundOf(latestDue());
    clock += 5 * 60_000;
    jest.advanceTimersByTime(5 * 60_000);
    expect(boundOf(latestDue())).toBe(firstBound + 300);
  });

  it('stops asking when the library is closed', () => {
    const { stop } = subscribe();
    stop();
    for (const listener of listeners) expect(listener.unsubscribe).toHaveBeenCalled();
    jest.advanceTimersByTime(60 * 60_000);
    expect(dueListeners()).toHaveLength(1);
  });

  it('does not keep a process alive for its timer', () => {
    // A library nobody closed must not hang a test run (or a Node process): the
    // refresh timer is unref'd where the runtime has such a thing.
    const unref = jest.fn();
    const spy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((() => ({ unref })) as unknown as typeof setTimeout);
    subscribe();
    expect(unref).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('a plan’s days', () => {
  it('is asked for in day order, on the plan it belongs to', () => {
    subscribeToPlanDays('some-plan', jest.fn(), jest.fn());
    expect(orderBy).toHaveBeenCalledWith('dayNumber', 'asc');
  });
});

describe('reading a plan document', () => {
  it('maps every field the plan manager writes', () => {
    expect(toPublishedPlan('p', planDoc())).toEqual({
      id: 'p',
      title: 'A plan',
      subtitle: 'A line under the title',
      description: 'What it is about.',
      category: 'Devotional',
      coverImageUrl: 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg',
      dayCount: 7,
      language: 'en',
      estimatedMinutes: 10,
      author: 'Pastor Samuel',
      order: 1,
    });
  });

  it('reads a plan written before the plan manager, with only the original five fields', () => {
    expect(
      toPublishedPlan('old', {
        title: 'Old plan',
        description: 'D',
        category: 'Gospels',
        coverImageUrl: null,
        dayCount: 14,
        published: true,
      })
    ).toEqual({
      id: 'old',
      title: 'Old plan',
      subtitle: '',
      description: 'D',
      category: 'Gospels',
      coverImageUrl: null,
      dayCount: 14,
      language: null,
      estimatedMinutes: null,
      author: '',
      order: 0,
    });
  });

  it('survives an empty document', () => {
    expect(toPublishedPlan('empty', {})).toEqual(
      makePlan({
        id: 'empty',
        title: '',
        description: '',
        category: '',
        subtitle: '',
        dayCount: 0,
      })
    );
  });

  it.each([
    ['a language the app does not have', { language: 'fr' }, { language: null }],
    ['a language that is not text', { language: 3 }, { language: null }],
    [
      'minutes that are not a number',
      { estimatedMinutes: '10' },
      { estimatedMinutes: null },
    ],
    ['minutes of zero', { estimatedMinutes: 0 }, { estimatedMinutes: null }],
    ['negative minutes', { estimatedMinutes: -5 }, { estimatedMinutes: null }],
    [
      'minutes that are not finite',
      { estimatedMinutes: Infinity },
      { estimatedMinutes: null },
    ],
    ['an order that is not a number', { order: 'first' }, { order: 0 }],
    ['an order that is not finite', { order: NaN }, { order: 0 }],
    ['an empty cover address', { coverImageUrl: '' }, { coverImageUrl: null }],
    ['a cover that is not text', { coverImageUrl: 4 }, { coverImageUrl: null }],
    ['an author that is not text', { author: 7 }, { author: '' }],
    ['a subtitle that is not text', { subtitle: {} }, { subtitle: '' }],
    ['a day count that is not a number', { dayCount: '7' }, { dayCount: 0 }],
  ])('ignores %s', (_name, bad, expected) => {
    expect(toPublishedPlan('p', planDoc(bad))).toMatchObject(expected);
  });

  it('accepts Telugu', () => {
    expect(toPublishedPlan('p', planDoc({ language: 'te' })).language).toBe('te');
  });
});

describe('reading a day document', () => {
  it('maps every part of a day', () => {
    expect(
      toPublishedPlanDay('d', {
        dayNumber: 2,
        title: 'The Lord is my shepherd',
        scriptureReference: 'Psalm 23; John 10:11-18',
        devotional: 'Rest.',
        reflectionQuestion: 'Where has he led you?',
        application: 'Call a friend.',
        prayerPrompt: 'Thank him.',
        notes: 'A psalm of David.',
      })
    ).toEqual({
      id: 'd',
      dayNumber: 2,
      title: 'The Lord is my shepherd',
      scriptureReference: 'Psalm 23; John 10:11-18',
      devotional: 'Rest.',
      reflectionQuestion: 'Where has he led you?',
      application: 'Call a friend.',
      prayerPrompt: 'Thank him.',
      notes: 'A psalm of David.',
    });
  });

  it('reads a day with only the original parts, the new ones empty', () => {
    expect(
      toPublishedPlanDay('d', {
        dayNumber: 1,
        title: 'Day',
        scriptureReference: 'Psalm 1',
        devotional: 'D',
        prayerPrompt: 'P',
      })
    ).toEqual({
      id: 'd',
      dayNumber: 1,
      title: 'Day',
      scriptureReference: 'Psalm 1',
      devotional: 'D',
      reflectionQuestion: '',
      application: '',
      prayerPrompt: 'P',
      notes: '',
    });
  });

  it('survives an empty document and parts that are not text', () => {
    expect(toPublishedPlanDay('d', {})).toMatchObject({
      dayNumber: 0,
      title: '',
      devotional: '',
      reflectionQuestion: '',
      application: '',
      prayerPrompt: '',
      notes: '',
    });
    expect(
      toPublishedPlanDay('d', { notes: 5, application: [], reflectionQuestion: null })
    ).toMatchObject({ notes: '', application: '', reflectionQuestion: '' });
  });
});

describe('library order', () => {
  it('puts the lower number first, then the title', () => {
    const plans = [
      makePlan({ id: 'c', title: 'B', order: 2 }),
      makePlan({ id: 'b', title: 'B', order: 1 }),
      makePlan({ id: 'a', title: 'A', order: 1 }),
    ];
    expect(plans.sort(comparePublishedPlans).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('the starter plans', () => {
  it('are English, with every new field at its default', () => {
    const seed = SEED_PLANS[0]!;
    expect(getBundledPlan(seed.id)).toEqual({
      id: seed.id,
      subtitle: '',
      language: 'en',
      estimatedMinutes: null,
      author: '',
      order: 0,
      ...seed.plan,
    });
  });

  it('keep their own order', () => {
    expect(SEED_PLANS.map((seed) => getBundledPlan(seed.id)!.order)).toEqual(
      SEED_PLANS.map((_seed, index) => index)
    );
  });

  it('are found by id, and only by id', () => {
    expect(getBundledPlan('not-a-starter-plan')).toBeUndefined();
  });
});

describe('"continue your plan" on Home', () => {
  const progressDoc = (id: string) => ({
    docs: [{ id, data: () => ({ currentDay: 2, completedDays: [1] }) }],
  });

  function start() {
    const onNext = jest.fn();
    subscribeToMostRecentPlanProgress('u1', onNext, jest.fn());
    return { onNext, progress: listeners[0]! };
  }

  /** Lets the plan lookup that follows a progress snapshot settle. */
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };

  it('resolves a plan the church published, with everything it wrote about it', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: 'church-plan',
      data: () => planDoc({ title: 'Our plan', subtitle: 'A line' }),
    });
    const { onNext, progress } = start();
    progress.next(progressDoc('church-plan'));
    await settle();
    expect(onNext).toHaveBeenCalledTimes(1);
    const summary = onNext.mock.calls[0]![0];
    expect(summary.planId).toBe('church-plan');
    expect(summary.plan).toMatchObject({
      id: 'church-plan',
      title: 'Our plan',
      subtitle: 'A line',
    });
    expect(summary.progress).toMatchObject({ currentDay: 2, completedDays: [1] });
  });

  it('still resolves a starter plan that was never written to Firestore', async () => {
    const seed = SEED_PLANS[0]!;
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    const { onNext, progress } = start();
    progress.next(progressDoc(seed.id));
    await settle();
    expect(onNext.mock.calls[0]![0].plan).toMatchObject({
      id: seed.id,
      title: seed.plan.title,
    });
  });

  it('has nothing to continue when the plan has since been deleted', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    const { onNext, progress } = start();
    progress.next(progressDoc('a-deleted-plan'));
    await settle();
    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('has nothing to continue when the plan was unpublished, which the rules refuse a member', async () => {
    (getDoc as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    const { onNext, progress } = start();
    progress.next(progressDoc('an-unpublished-plan'));
    await settle();
    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('keeps a starter plan the member began, even when the lookup fails', async () => {
    const seed = SEED_PLANS[0]!;
    (getDoc as jest.Mock).mockRejectedValue({ code: 'unavailable' });
    const { onNext, progress } = start();
    progress.next(progressDoc(seed.id));
    await settle();
    expect(onNext.mock.calls[0]![0].planId).toBe(seed.id);
  });

  it('has nothing to continue for a member who has started no plan', () => {
    const { onNext, progress } = start();
    progress.next({ docs: [] });
    expect(onNext).toHaveBeenCalledWith(null);
  });
});
