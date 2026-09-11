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
  collection: vi.fn(() => 'community-collection'),
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

import { addDoc, deleteDoc, onSnapshot, updateDoc, type FirestoreError } from 'firebase/firestore';
import {
  createCommunityPost,
  deleteCommunityPost,
  setCommunityPostPublished,
  subscribeToCommunityPosts,
  updateCommunityPost,
} from '../communityPosts';

describe('communityPosts service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(addDoc).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(deleteDoc).mockReset();
  });

  describe('createCommunityPost', () => {
    it('writes a trimmed, unpublished post and logs the action', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
      const id = await createCommunityPost({
        title: '  Baptism Testimony  ',
        content: '  God is good.  ',
        imageUrl: null,
      });
      expect(id).toBe('new-id');
      expect(addDoc).toHaveBeenCalledWith(
        'community-collection',
        expect.objectContaining({
          title: 'Baptism Testimony',
          content: 'God is good.',
          published: false,
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', collection: 'community', documentId: 'new-id' })
      );
    });
  });

  describe('updateCommunityPost', () => {
    it('updates the trimmed fields and logs the action', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await updateCommunityPost('c1', { title: 'New title', content: 'New content', imageUrl: null });
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 'c1' },
        expect.objectContaining({ title: 'New title', content: 'New content' })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', documentId: 'c1' })
      );
    });
  });

  describe('deleteCommunityPost', () => {
    it('deletes the document and logs the action with the given title', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);
      await deleteCommunityPost('c1', 'Baptism Testimony');
      expect(deleteDoc).toHaveBeenCalledWith({ id: 'c1' });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          changeSummary: expect.stringContaining('Baptism Testimony'),
        })
      );
    });
  });

  describe('setCommunityPostPublished', () => {
    it('logs a "publish" action when publishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setCommunityPostPublished('c1', 'Baptism Testimony', true);
      expect(updateDoc).toHaveBeenCalledWith({ id: 'c1' }, expect.objectContaining({ published: true }));
      expect(mockLogAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish' }));
    });
  });

  describe('subscribeToCommunityPosts', () => {
    it('maps snapshot docs into CommunityPost objects', () => {
      const onNext = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'c1',
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

      subscribeToCommunityPosts(onNext, vi.fn());

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'c1', title: 'Title', published: true }),
      ]);
    });

    it('forwards Firestore errors to onError', () => {
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

      subscribeToCommunityPosts(vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
