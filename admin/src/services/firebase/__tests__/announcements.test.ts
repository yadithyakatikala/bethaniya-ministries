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
  collection: vi.fn(() => 'announcements-collection'),
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
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementPublished,
  subscribeToAnnouncements,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '../announcements';

describe('announcements service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(addDoc).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(deleteDoc).mockReset();
  });

  describe('createAnnouncement', () => {
    it('writes a trimmed, unpublished announcement and logs the action', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
      const id = await createAnnouncement({
        title: '  Sunday Service  ',
        content: '  Join us at 10am.  ',
        imageUrl: null,
      });
      expect(id).toBe('new-id');
      expect(addDoc).toHaveBeenCalledWith(
        'announcements-collection',
        expect.objectContaining({
          title: 'Sunday Service',
          content: 'Join us at 10am.',
          imageUrl: null,
          published: false,
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          collection: 'announcements',
          documentId: 'new-id',
        })
      );
    });
  });

  describe('updateAnnouncement', () => {
    it('updates the trimmed fields and logs the action', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await updateAnnouncement('a1', {
        title: 'New title',
        content: 'New content',
        imageUrl: 'https://example.com/img.jpg',
      });
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 'a1' },
        expect.objectContaining({ title: 'New title', content: 'New content' })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', documentId: 'a1' })
      );
    });
  });

  describe('deleteAnnouncement', () => {
    it('deletes the document and logs the action with the given title', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);
      await deleteAnnouncement('a1', 'Sunday Service');
      expect(deleteDoc).toHaveBeenCalledWith({ id: 'a1' });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          documentId: 'a1',
          changeSummary: expect.stringContaining('Sunday Service'),
        })
      );
    });
  });

  describe('setAnnouncementPublished', () => {
    it('logs a "publish" action when publishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setAnnouncementPublished('a1', 'Sunday Service', true);
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 'a1' },
        expect.objectContaining({ published: true })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'publish' })
      );
    });

    it('logs an "unpublish" action when unpublishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setAnnouncementPublished('a1', 'Sunday Service', false);
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unpublish' })
      );
    });
  });

  describe('subscribeToAnnouncements', () => {
    it('maps snapshot docs into Announcement objects, converting Timestamps to Dates', () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'a1',
              data: () => ({
                title: 'Title',
                content: 'Content',
                imageUrl: null,
                published: true,
                createdAt: new MockTimestamp(1000),
                updatedAt: new MockTimestamp(2000),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToAnnouncements(onNext, onError);

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'a1',
          title: 'Title',
          content: 'Content',
          published: true,
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

      subscribeToAnnouncements(onNext, onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('uploadAnnouncementImage', () => {
    it('uploads the file and returns its download URL', async () => {
      vi.mocked(uploadBytes).mockResolvedValue(undefined as never);
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/uploaded.jpg');
      const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });

      const url = await uploadAnnouncementImage(file);

      expect(uploadBytes).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('photo.jpg') }),
        file,
        { contentType: 'image/jpeg' }
      );
      expect(url).toBe('https://example.com/uploaded.jpg');
    });
  });
});
