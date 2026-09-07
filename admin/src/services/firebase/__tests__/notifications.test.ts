import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockCallable, MockTimestamp } = vi.hoisted(() => {
  class MockTimestamp {
    seconds: number;
    constructor(seconds: number) {
      this.seconds = seconds;
    }
    toDate() {
      return new Date(this.seconds * 1000);
    }
  }
  return { mockCallable: vi.fn(), MockTimestamp };
});

vi.mock('../app', () => ({ db: {}, storage: {}, functions: {} }));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mockCallable) }));

vi.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  collection: vi.fn(() => 'notifications_log-collection'),
  query: vi.fn((c) => c),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  getCountFromServer: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path) => ({ path })),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

import { getCountFromServer, onSnapshot, type FirestoreError } from 'firebase/firestore';
import { getDownloadURL, uploadBytes } from 'firebase/storage';
import {
  estimateRecipientCount,
  sendNotification,
  subscribeToNotificationLog,
  uploadNotificationImage,
} from '../notifications';

describe('notifications service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    vi.mocked(getCountFromServer).mockReset();
  });

  describe('sendNotification', () => {
    it('calls the sendNotification callable and returns the recipient count', async () => {
      mockCallable.mockResolvedValue({ data: { sent: true, recipientCount: 42 } });
      const result = await sendNotification({
        title: 'Sunday Service',
        message: 'Join us at 10am.',
        imageUrl: null,
        recipientGroup: 'all_members',
      });
      expect(mockCallable).toHaveBeenCalledWith({
        title: 'Sunday Service',
        message: 'Join us at 10am.',
        imageUrl: null,
        recipientGroup: 'all_members',
      });
      expect(result).toEqual({ recipientCount: 42 });
    });
  });

  describe('estimateRecipientCount', () => {
    it("queries every user for 'all_members'", async () => {
      vi.mocked(getCountFromServer).mockResolvedValue({
        data: () => ({ count: 10 }),
      } as never);
      const count = await estimateRecipientCount('all_members');
      expect(count).toBe(10);
    });

    it("queries only admin-role users for 'admins_only'", async () => {
      vi.mocked(getCountFromServer).mockResolvedValue({
        data: () => ({ count: 3 }),
      } as never);
      const count = await estimateRecipientCount('admins_only');
      expect(count).toBe(3);
    });

    it('returns null (not a thrown error) when the count query fails -- e.g. a Host caller lacking /users list access', async () => {
      vi.mocked(getCountFromServer).mockRejectedValue(new Error('permission-denied'));
      const count = await estimateRecipientCount('all_members');
      expect(count).toBeNull();
    });
  });

  describe('subscribeToNotificationLog', () => {
    it('maps snapshot docs into NotificationLogEntry objects', () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'n1',
              data: () => ({
                title: 'Title',
                message: 'Message',
                image_url: null,
                recipient_group: 'admins_only',
                recipient_count: 5,
                sent_by: 'uid-1',
                sent_by_email: 'admin@example.com',
                timestamp: new MockTimestamp(1000),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToNotificationLog(onNext, onError);

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'n1',
          title: 'Title',
          message: 'Message',
          imageUrl: null,
          recipientGroup: 'admins_only',
          recipientCount: 5,
          sentBy: 'uid-1',
          sentByEmail: 'admin@example.com',
        }),
      ]);
    });

    it('forwards Firestore errors to onError', () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      const error = { code: 'permission-denied' } as FirestoreError;
      vi.mocked(onSnapshot).mockImplementation(((
        _q: unknown,
        _next: unknown,
        err: (e: FirestoreError) => void
      ) => {
        err(error);
        return vi.fn();
      }) as never);

      subscribeToNotificationLog(onNext, onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('uploadNotificationImage', () => {
    it('uploads the file and returns its download URL', async () => {
      vi.mocked(uploadBytes).mockResolvedValue(undefined as never);
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/uploaded.jpg');
      const file = new File(['a'], 'banner.jpg', { type: 'image/jpeg' });

      const url = await uploadNotificationImage(file);

      expect(uploadBytes).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('banner.jpg') }),
        file,
        { contentType: 'image/jpeg' }
      );
      expect(url).toBe('https://example.com/uploaded.jpg');
    });
  });
});
