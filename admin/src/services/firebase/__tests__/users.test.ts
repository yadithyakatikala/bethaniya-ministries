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
  collection: vi.fn(() => 'users-collection'),
  getDocs: vi.fn(),
}));

import { getDocs } from 'firebase/firestore';
import { fetchAllUsers, updateUserRole } from '../users';

describe('users service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    vi.mocked(getDocs).mockReset();
  });

  describe('fetchAllUsers', () => {
    it('maps every user document into an AdminUserSummary', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          {
            id: 'uid-1',
            data: () => ({
              displayName: 'Jane Doe',
              email: 'jane@example.com',
              phoneNumber: '+10000000000',
              role: 'content_admin',
              createdAt: new MockTimestamp(1000),
            }),
          },
          {
            id: 'uid-2',
            data: () => ({
              // A brand-new member profile can legitimately be missing
              // displayName/email/phoneNumber -- must not throw.
              role: 'member',
            }),
          },
        ],
      } as never);

      const users = await fetchAllUsers();

      expect(users).toEqual([
        {
          uid: 'uid-1',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '+10000000000',
          role: 'content_admin',
          createdAt: new Date(1000 * 1000),
        },
        {
          uid: 'uid-2',
          displayName: null,
          email: null,
          phoneNumber: null,
          role: 'member',
          createdAt: null,
        },
      ]);
    });

    it('defaults an unrecognized/missing role to member rather than throwing', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ id: 'uid-3', data: () => ({}) }],
      } as never);

      const users = await fetchAllUsers();
      expect(users[0]?.role).toBe('member');
    });
  });

  describe('updateUserRole', () => {
    it('calls the updateUserRole callable and returns the updated uid/role', async () => {
      mockCallable.mockResolvedValue({
        data: { updated: true, uid: 'uid-1', role: 'host' },
      });

      const result = await updateUserRole('uid-1', 'host');

      expect(mockCallable).toHaveBeenCalledWith({ targetUid: 'uid-1', newRole: 'host' });
      expect(result).toEqual({ uid: 'uid-1', role: 'host' });
    });

    it('propagates a rejection from the callable (e.g. self-demotion, permission-denied)', async () => {
      mockCallable.mockRejectedValue(new Error('permission-denied'));

      await expect(updateUserRole('uid-1', 'member')).rejects.toThrow(
        'permission-denied'
      );
    });
  });
});
