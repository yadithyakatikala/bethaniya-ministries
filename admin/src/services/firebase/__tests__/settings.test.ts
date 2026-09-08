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

vi.mock('../app', () => ({ db: {} }));
vi.mock('../auditLog', () => ({ logAdminAction: mockLogAdminAction }));

vi.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  doc: vi.fn((_db, collection, id) => ({ collection, id })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { doc, onSnapshot, setDoc, type FirestoreError } from 'firebase/firestore';
import { saveChurchSettings, subscribeToChurchSettings } from '../settings';

describe('settings service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(setDoc).mockReset();
    vi.mocked(onSnapshot).mockReset();
  });

  describe('subscribeToChurchSettings', () => {
    it('maps an existing settings/church document', () => {
      vi.mocked(onSnapshot).mockImplementation((_ref, next) => {
        (next as (snap: unknown) => void)({
          exists: () => true,
          data: () => ({
            churchName: 'Bethaniya Ministries',
            logoUrl: 'https://example.com/logo.png',
            description: 'A community of faith.',
            supportEmail: 'support@example.com',
            updatedAt: new MockTimestamp(1000),
          }),
        });
        return vi.fn();
      });

      const onNext = vi.fn();
      subscribeToChurchSettings(onNext, vi.fn());

      expect(doc).toHaveBeenCalledWith({}, 'settings', 'church');
      expect(onNext).toHaveBeenCalledWith({
        churchName: 'Bethaniya Ministries',
        logoUrl: 'https://example.com/logo.png',
        description: 'A community of faith.',
        supportEmail: 'support@example.com',
        updatedAt: new Date(1000 * 1000),
      });
    });

    it('reports null when the document does not exist yet', () => {
      vi.mocked(onSnapshot).mockImplementation((_ref, next) => {
        (next as (snap: unknown) => void)({ exists: () => false, data: () => undefined });
        return vi.fn();
      });

      const onNext = vi.fn();
      subscribeToChurchSettings(onNext, vi.fn());

      expect(onNext).toHaveBeenCalledWith(null);
    });

    it('forwards a subscription error to onError', () => {
      const error = { code: 'permission-denied' } as FirestoreError;
      vi.mocked(onSnapshot).mockImplementation((_ref, _next, onErr) => {
        (onErr as unknown as (e: FirestoreError) => void)(error);
        return vi.fn();
      });

      const onError = vi.fn();
      subscribeToChurchSettings(vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('saveChurchSettings', () => {
    it('writes the trimmed fields with merge:true and logs the action', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await saveChurchSettings({
        churchName: '  Bethaniya Ministries  ',
        logoUrl: '  https://example.com/logo.png  ',
        description: '  A community of faith.  ',
        supportEmail: '  support@example.com  ',
      });

      expect(setDoc).toHaveBeenCalledWith(
        { collection: 'settings', id: 'church' },
        {
          churchName: 'Bethaniya Ministries',
          logoUrl: 'https://example.com/logo.png',
          description: 'A community of faith.',
          supportEmail: 'support@example.com',
          updatedAt: 'SERVER_TIMESTAMP',
        },
        { merge: true }
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith({
        action: 'update',
        collection: 'settings',
        documentId: 'church',
        changeSummary: 'Updated church settings ("Bethaniya Ministries")',
      });
    });

    it('propagates a write failure without calling logAdminAction', async () => {
      vi.mocked(setDoc).mockRejectedValue(new Error('network error'));

      await expect(
        saveChurchSettings({
          churchName: 'X',
          logoUrl: 'https://example.com',
          description: 'Y',
          supportEmail: 'x@example.com',
        })
      ).rejects.toThrow('network error');

      expect(mockLogAdminAction).not.toHaveBeenCalled();
    });
  });
});
