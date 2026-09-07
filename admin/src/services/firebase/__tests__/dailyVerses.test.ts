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
  collection: vi.fn(() => 'daily_verses-collection'),
  doc: vi.fn((_db, _c, id) => ({ id })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
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

import {
  addDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  type FirestoreError,
} from 'firebase/firestore';
import { getDownloadURL, uploadBytes } from 'firebase/storage';
import {
  createDailyVerse,
  deleteDailyVerse,
  subscribeToDailyVerses,
  updateDailyVerse,
  uploadDailyVerseImage,
} from '../dailyVerses';

describe('dailyVerses service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(addDoc).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(deleteDoc).mockReset();
  });

  describe('createDailyVerse', () => {
    it('writes a trimmed daily verse and logs the action', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
      const id = await createDailyVerse({
        reference: '  John 3:16  ',
        text: '  For God so loved the world...  ',
        imageUrl: null,
        date: '2026-09-07',
      });
      expect(id).toBe('new-id');
      expect(addDoc).toHaveBeenCalledWith(
        'daily_verses-collection',
        expect.objectContaining({
          reference: 'John 3:16',
          text: 'For God so loved the world...',
          imageUrl: null,
          date: '2026-09-07',
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          collection: 'daily_verses',
          documentId: 'new-id',
        })
      );
    });

    it('does not write a published field -- daily_verses has no publish/unpublish concept', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
      await createDailyVerse({
        reference: 'John 3:16',
        text: 'Text',
        imageUrl: null,
        date: '2026-09-07',
      });
      const writtenData = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(writtenData).not.toHaveProperty('published');
    });
  });

  describe('updateDailyVerse', () => {
    it('updates the trimmed fields and logs the action', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await updateDailyVerse('v1', {
        reference: 'New reference',
        text: 'New text',
        imageUrl: 'https://example.com/img.jpg',
        date: '2026-09-08',
      });
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 'v1' },
        expect.objectContaining({
          reference: 'New reference',
          text: 'New text',
          date: '2026-09-08',
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', documentId: 'v1' })
      );
    });
  });

  describe('deleteDailyVerse', () => {
    it('deletes the document and logs the action with the given reference', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);
      await deleteDailyVerse('v1', 'John 3:16');
      expect(deleteDoc).toHaveBeenCalledWith({ id: 'v1' });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          documentId: 'v1',
          changeSummary: expect.stringContaining('John 3:16'),
        })
      );
    });
  });

  describe('subscribeToDailyVerses', () => {
    it('maps snapshot docs into DailyVerse objects, converting Timestamps to Dates', () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'v1',
              data: () => ({
                reference: 'John 3:16',
                text: 'For God so loved the world...',
                imageUrl: null,
                date: '2026-09-07',
                createdAt: new MockTimestamp(1000),
                updatedAt: new MockTimestamp(2000),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToDailyVerses(onNext, onError);

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'v1',
          reference: 'John 3:16',
          text: 'For God so loved the world...',
          date: '2026-09-07',
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

      subscribeToDailyVerses(onNext, onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('uploadDailyVerseImage', () => {
    it('uploads the file and returns its download URL', async () => {
      vi.mocked(uploadBytes).mockResolvedValue(undefined as never);
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/uploaded.jpg');
      const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });

      const url = await uploadDailyVerseImage(file);

      expect(uploadBytes).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('photo.jpg') }),
        file,
        { contentType: 'image/jpeg' }
      );
      expect(url).toBe('https://example.com/uploaded.jpg');
    });
  });
});
