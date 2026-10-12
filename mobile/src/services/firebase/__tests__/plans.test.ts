import {
  collection,
  getDoc,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  markDayComplete,
  startPlan,
  subscribeToPlanDays,
  subscribeToPlanProgress,
  subscribeToPublishedPlans,
  subscribeToStartedPlanCount,
} from '../plans';

jest.mock('../app');

describe('plans service', () => {
  afterEach(() => jest.clearAllMocks());

  describe('subscribeToPublishedPlans', () => {
    it('maps snapshot docs into PublishedPlan objects', () => {
      const onNext = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
        next({
          docs: [
            {
              id: 'plan-1',
              data: () => ({
                title: '7 Days of Gratitude',
                description: 'A short devotional plan.',
                category: 'Devotional',
                coverImageUrl: null,
                dayCount: 7,
              }),
            },
          ],
        });
        return jest.fn();
      });

      subscribeToPublishedPlans(onNext, jest.fn());

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'plan-1',
          title: '7 Days of Gratitude',
          dayCount: 7,
        }),
      ]);
    });
  });

  describe('subscribeToStartedPlanCount', () => {
    it("counts the documents in the member's own planProgress collection", () => {
      const onNext = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        next({ docs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
        return jest.fn();
      });

      subscribeToStartedPlanCount('uid-1', onNext, jest.fn());

      expect(onNext).toHaveBeenCalledWith(3);
      // Only the member's own subcollection is listened to, never plans or days.
      expect(collection).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'uid-1',
        'planProgress'
      );
    });

    it('reports zero for a member who has started nothing', () => {
      const onNext = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        next({ docs: [] });
        return jest.fn();
      });
      subscribeToStartedPlanCount('uid-1', onNext, jest.fn());
      expect(onNext).toHaveBeenCalledWith(0);
    });

    it('passes a failure to the caller and hands back the unsubscribe', () => {
      const onError = jest.fn();
      const unsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_ref, _next, error) => {
        error({ code: 'permission-denied' });
        return unsubscribe;
      });
      const result = subscribeToStartedPlanCount('uid-1', jest.fn(), onError);
      expect(onError).toHaveBeenCalledWith({ code: 'permission-denied' });
      expect(result).toBe(unsubscribe);
    });
  });

  describe('subscribeToPlanDays', () => {
    it('maps snapshot docs into PublishedPlanDay objects', () => {
      const onNext = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
        next({
          docs: [
            {
              id: 'day-1',
              data: () => ({
                dayNumber: 1,
                title: 'Day 1',
                scriptureReference: 'Philippians 4:4',
                devotional: 'Rejoice always.',
                prayerPrompt: '',
              }),
            },
          ],
        });
        return jest.fn();
      });

      subscribeToPlanDays('plan-1', onNext, jest.fn());

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'day-1', dayNumber: 1, title: 'Day 1' }),
      ]);
    });
  });

  describe('subscribeToPlanProgress', () => {
    it('resolves null when no progress document exists', () => {
      const onNext = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        next({ exists: () => false });
        return jest.fn();
      });

      subscribeToPlanProgress('uid-1', 'plan-1', onNext, jest.fn());

      expect(onNext).toHaveBeenCalledWith(null);
    });

    it('maps an existing progress document', () => {
      const onNext = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
        next({
          exists: () => true,
          data: () => ({
            startedAt: new Timestamp(1000, 0),
            currentDay: 2,
            completedDays: [1],
            lastReadAt: new Timestamp(2000, 0),
          }),
        });
        return jest.fn();
      });

      subscribeToPlanProgress('uid-1', 'plan-1', onNext, jest.fn());

      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({ currentDay: 2, completedDays: [1] })
      );
    });
  });

  describe('startPlan', () => {
    it('creates a progress document when none exists', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
      await startPlan('uid-1', 'plan-1');
      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ currentDay: 1, completedDays: [] })
      );
    });

    it('does not overwrite an existing progress document', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });
      await startPlan('uid-1', 'plan-1');
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('markDayComplete', () => {
    it('adds the day to completedDays and advances currentDay when it was the current day', async () => {
      await markDayComplete('uid-1', 'plan-1', 2, 2, [1]);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ completedDays: [1, 2], currentDay: 3 })
      );
    });

    it('does not duplicate an already-completed day and does not rewind currentDay', async () => {
      await markDayComplete('uid-1', 'plan-1', 1, 3, [1, 2]);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ completedDays: [1, 2], currentDay: 3 })
      );
    });
  });
});
