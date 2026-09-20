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
  doc: vi.fn((_db, ...segments: string[]) => ({ path: segments.join('/') })),
  updateDoc: vi.fn(),
}));

import { doc, getDocs, updateDoc } from 'firebase/firestore';
import { fetchAllUsers, updateUserRole } from '../users';

describe('users service', () => {
  beforeEach(() => {
    mockCallable.mockReset();
    vi.mocked(getDocs).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(doc).mockClear();
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

      // M7's fields map to null for a document that does not carry them,
      // which is every document written before M7 -- except
      // accountStatus, which defaults to 'active': a member with no
      // stored status is not suspended, and treating a missing value as
      // a suspension would silently mute the whole congregation.
      const m7Defaults = {
        gender: null,
        appLanguage: null,
        authProvider: null,
        lastActiveAt: null,
        profileCompletedAt: null,
        accountStatus: 'active',
      };

      expect(users).toEqual([
        {
          uid: 'uid-1',
          displayName: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '+10000000000',
          role: 'content_admin',
          createdAt: new Date(1000 * 1000),
          ...m7Defaults,
        },
        {
          uid: 'uid-2',
          displayName: null,
          email: null,
          phoneNumber: null,
          role: 'member',
          createdAt: null,
          ...m7Defaults,
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
    // Role changes deliberately do NOT go through the updateUserRole
    // callable any more: Cloud Functions cannot be deployed on the Spark
    // plan, so that path made the Users page's role selector a control
    // that could only ever fail. It is now a direct, rules-protected
    // write -- see ../users.ts's header comment.

    it('writes the role directly to the target user document', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const result = await updateUserRole('uid-1', 'host');

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/uid-1' }),
        { role: 'host' }
      );
      expect(result).toEqual({ uid: 'uid-1', role: 'host' });
    });

    it('writes ONLY the role field', async () => {
      // firestore.rules' affectedKeys().hasOnly(['role']) rejects any
      // other field, including an updatedAt touch -- so adding one here
      // would turn every role change into permission-denied.
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateUserRole('uid-1', 'content_admin');

      // Indexed rather than destructured: updateDoc is overloaded, so the
      // tuple type of mock.calls[0] is a union TypeScript will not spread.
      const payload = vi.mocked(updateDoc).mock.calls[0]?.[1] as unknown as Record<
        string,
        unknown
      >;
      expect(Object.keys(payload)).toEqual(['role']);
    });

    it('does not call any Cloud Function to change a role', async () => {
      // Regression guard: reintroducing the callable would silently break
      // role management again on Spark.
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await updateUserRole('uid-1', 'host');

      expect(mockCallable).not.toHaveBeenCalledWith(
        expect.objectContaining({ targetUid: expect.anything() })
      );
    });

    it('propagates permission-denied from Firestore (non-super-admin, or self-demotion)', async () => {
      // Both of those are enforced by firestore.rules, not by this client.
      vi.mocked(updateDoc).mockRejectedValue(new Error('permission-denied'));

      await expect(updateUserRole('uid-1', 'member')).rejects.toThrow(
        'permission-denied'
      );
    });

    it('still reports success when the Blaze-gated audit log call fails', async () => {
      // logAdminAction swallows its own failures; a lost audit entry must
      // not make a completed role change look like a failure.
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      mockCallable.mockRejectedValue(new Error('functions/not-found'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(updateUserRole('uid-1', 'host')).resolves.toEqual({
        uid: 'uid-1',
        role: 'host',
      });

      errorSpy.mockRestore();
    });
  });
});
