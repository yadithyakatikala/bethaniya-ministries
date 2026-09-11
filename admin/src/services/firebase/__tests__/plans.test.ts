import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockLogAdminAction, MockTimestamp } = vi.hoisted(() => {
  class MockTimestamp {
    seconds: number;
    constructor(seconds: number) {
      this.seconds = seconds;
    }
    toDate() {
      return new Date(this.seconds * 1000);
    }
  }
  return { mockLogAdminAction: vi.fn(), MockTimestamp };
});

vi.mock('../app', () => ({ db: {}, storage: {} }));
vi.mock('../auditLog', () => ({ logAdminAction: mockLogAdminAction }));

vi.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  collection: vi.fn((_db, ...segments: string[]) => segments.join('/')),
  doc: vi.fn((_db, ...segments: string[]) => ({ id: segments.join('/') })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((c) => c),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path) => ({ path })),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

import { addDoc, deleteDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  createPlan,
  createPlanDay,
  deletePlan,
  deletePlanDay,
  setPlanPublished,
  subscribeToPlanDays,
  subscribeToPlans,
  updatePlan,
} from '../plans';

describe('plans service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(addDoc).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(deleteDoc).mockReset();
    vi.mocked(getDocs).mockReset();
  });

  describe('createPlan', () => {
    it('writes a trimmed, unpublished, zero-day plan and logs the action', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'plan-1' } as never);
      const id = await createPlan({
        title: '  7 Days of Gratitude  ',
        description: '  A short plan.  ',
        category: '  Devotional  ',
        coverImageUrl: null,
        order: 2,
      });
      expect(id).toBe('plan-1');
      expect(addDoc).toHaveBeenCalledWith(
        'plans',
        expect.objectContaining({
          title: '7 Days of Gratitude',
          description: 'A short plan.',
          category: 'Devotional',
          dayCount: 0,
          order: 2,
          published: false,
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', collection: 'plans', documentId: 'plan-1' })
      );
    });
  });

  describe('updatePlan', () => {
    it('updates the trimmed fields without touching dayCount', async () => {
      await updatePlan('plan-1', {
        title: 'New title',
        description: 'New description',
        category: 'Topical',
        coverImageUrl: null,
        order: 5,
      });
      const payload = vi.mocked(updateDoc).mock.calls[0]?.[1];
      expect(payload).toEqual(
        expect.objectContaining({ title: 'New title', order: 5 })
      );
      expect(payload).not.toHaveProperty('dayCount');
    });
  });

  describe('deletePlan', () => {
    it('deletes the plan document and logs the action', async () => {
      await deletePlan('plan-1', '7 Days of Gratitude');
      expect(deleteDoc).toHaveBeenCalled();
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', collection: 'plans' })
      );
    });
  });

  describe('setPlanPublished', () => {
    it('logs a "publish" action', async () => {
      await setPlanPublished('plan-1', 'Title', true);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ published: true })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish' }));
    });
  });

  describe('subscribeToPlans', () => {
    it('maps snapshot docs into Plan objects', () => {
      const onNext = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'plan-1',
              data: () => ({
                title: 'Title',
                description: 'Description',
                category: 'Devotional',
                coverImageUrl: null,
                dayCount: 3,
                order: 0,
                published: true,
                createdAt: new MockTimestamp(1000),
                updatedAt: new MockTimestamp(2000),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToPlans(onNext, vi.fn());

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'plan-1', title: 'Title', dayCount: 3 }),
      ]);
    });
  });

  describe('createPlanDay / deletePlanDay (dayCount sync)', () => {
    it('recomputes dayCount from the real days subcollection after creating a day', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'day-1' } as never);
      vi.mocked(getDocs).mockResolvedValue({ size: 3 } as never);

      await createPlanDay('plan-1', 'Plan Title', {
        dayNumber: 3,
        title: 'Day 3',
        scriptureReference: 'John 3:16',
        devotional: 'Devotional text.',
        prayerPrompt: '',
      });

      expect(getDocs).toHaveBeenCalled();
      const dayCountCall = (updateDoc as ReturnType<typeof vi.fn>).mock.calls.find(
        ([, payload]) => 'dayCount' in payload
      );
      expect(dayCountCall?.[1]).toEqual(expect.objectContaining({ dayCount: 3 }));
    });

    it('recomputes dayCount from the real days subcollection after deleting a day', async () => {
      vi.mocked(getDocs).mockResolvedValue({ size: 1 } as never);

      await deletePlanDay('plan-1', 'Plan Title', 'day-1', 1);

      expect(deleteDoc).toHaveBeenCalled();
      const dayCountCall = (updateDoc as ReturnType<typeof vi.fn>).mock.calls.find(
        ([, payload]) => 'dayCount' in payload
      );
      expect(dayCountCall?.[1]).toEqual(expect.objectContaining({ dayCount: 1 }));
    });
  });

  describe('subscribeToPlanDays', () => {
    it('maps snapshot docs into PlanDay objects', () => {
      const onNext = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'day-1',
              data: () => ({
                dayNumber: 1,
                title: 'Day 1',
                scriptureReference: 'John 3:16',
                devotional: 'Text',
                prayerPrompt: '',
                createdAt: new MockTimestamp(1000),
                updatedAt: new MockTimestamp(2000),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToPlanDays('plan-1', onNext, vi.fn());

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'day-1', dayNumber: 1, title: 'Day 1' }),
      ]);
    });
  });
});
