import {
  markDayComplete,
  startPlan,
  type PlanProgress,
  type PublishedPlan,
} from '../../../services/firebase/plans';
import { markPlanDay, planFromReading, planReadingFor } from '../planReading';
import { makePlan } from '../../../testing/planFixtures';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/plans');

const PLAN: PublishedPlan = makePlan({
  coverImageUrl: 'https://example.org/cover.png',
});

const progress = (overrides: Partial<PlanProgress> = {}): PlanProgress => ({
  startedAt: new Date(2026, 9, 1),
  currentDay: 2,
  completedDays: [1],
  lastReadAt: new Date(2026, 9, 10),
  ...overrides,
});

beforeEach(() => {
  (startPlan as jest.Mock).mockResolvedValue(undefined);
  (markDayComplete as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.clearAllMocks());

describe('planReadingFor', () => {
  it('keeps the four plain values the reader needs, and nothing a route cannot carry', () => {
    const reading = planReadingFor(PLAN, 2);
    expect(reading).toEqual({
      planId: 'psalms',
      title: 'Seven Days in the Psalms',
      dayCount: 7,
      dayNumber: 2,
    });
    // Serialisable: a route's params should survive being written down and read back.
    expect(JSON.parse(JSON.stringify(reading))).toEqual(reading);
  });
});

describe('planFromReading', () => {
  it('rebuilds just enough of a plan for "Plan complete", which prints its name and length', () => {
    expect(planFromReading(planReadingFor(PLAN, 7))).toEqual(
      makePlan({
        id: 'psalms',
        title: 'Seven Days in the Psalms',
        description: '',
        category: '',
        coverImageUrl: null,
        dayCount: 7,
      })
    );
  });
});

describe('markPlanDay', () => {
  const call = (day: number, p: PlanProgress | null, dayCount = 7) =>
    markPlanDay({ uid: 'u1', planId: 'psalms', dayNumber: day, dayCount, progress: p });

  it("marks the day with the member's own current day and completed days", async () => {
    await call(2, progress({ currentDay: 2, completedDays: [1] }));
    expect(markDayComplete).toHaveBeenCalledWith('u1', 'psalms', 2, 2, [1]);
    expect(startPlan).not.toHaveBeenCalled();
  });

  it('starts a plan the member has not begun, first, and then marks the day', async () => {
    const order: string[] = [];
    (startPlan as jest.Mock).mockImplementation(async () => void order.push('start'));
    (markDayComplete as jest.Mock).mockImplementation(
      async () => void order.push('mark')
    );
    await call(2, null);
    expect(order).toEqual(['start', 'mark']);
    expect(markDayComplete).toHaveBeenCalledWith('u1', 'psalms', 2, 1, []);
  });

  it('does not finish a plan while days remain', async () => {
    expect(await call(2, progress())).toEqual({ finished: false });
  });

  it('finishes a plan when the day marked is the last one left', async () => {
    const result = await call(
      7,
      progress({ currentDay: 7, completedDays: [1, 2, 3, 4, 5, 6] })
    );
    expect(result).toEqual({ finished: true });
  });

  it('does not finish a plan whose last day is marked but an earlier one was skipped', async () => {
    const result = await call(
      7,
      progress({ currentDay: 7, completedDays: [1, 2, 3, 5, 6] })
    );
    expect(result).toEqual({ finished: false });
  });

  it('does not count a day twice when it is marked again', async () => {
    const result = await call(
      6,
      progress({ currentDay: 7, completedDays: [1, 2, 3, 4, 5, 6] })
    );
    expect(result).toEqual({ finished: false });
  });

  it('can never finish a plan with no days', async () => {
    expect(await call(1, progress({ completedDays: [] }), 0)).toEqual({
      finished: false,
    });
  });

  it('does not report a finish when the write fails -- it throws, so the caller can say so', async () => {
    (markDayComplete as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(call(2, progress())).rejects.toThrow('offline');
  });
});
