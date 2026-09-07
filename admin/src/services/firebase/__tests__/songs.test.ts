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
  collection: vi.fn(() => 'songs-collection'),
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
  createSong,
  deleteSong,
  setSongPublished,
  subscribeToSongs,
  updateSong,
  uploadSongCoverImage,
} from '../songs';

const VALID_INPUT = {
  title: '  Amazing Grace  ',
  artist: '  John Newton  ',
  category: '  Hymn  ',
  lyrics: '  Amazing grace, how sweet the sound...  ',
  audioUrl: '  https://example.com/amazing-grace.mp3  ',
  coverUrl: null,
};

describe('songs service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(addDoc).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(deleteDoc).mockReset();
  });

  describe('createSong', () => {
    it('writes a trimmed, unpublished song and logs the action', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
      const id = await createSong(VALID_INPUT);
      expect(id).toBe('new-id');
      expect(addDoc).toHaveBeenCalledWith(
        'songs-collection',
        expect.objectContaining({
          title: 'Amazing Grace',
          artist: 'John Newton',
          category: 'Hymn',
          lyrics: 'Amazing grace, how sweet the sound...',
          audioUrl: 'https://example.com/amazing-grace.mp3',
          coverUrl: null,
          published: false,
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          collection: 'songs',
          documentId: 'new-id',
        })
      );
    });
  });

  describe('updateSong', () => {
    it('updates the trimmed fields and logs the action', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await updateSong('s1', VALID_INPUT);
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 's1' },
        expect.objectContaining({ title: 'Amazing Grace', artist: 'John Newton' })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', documentId: 's1' })
      );
    });
  });

  describe('deleteSong', () => {
    it('deletes the document and logs the action with the given title', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);
      await deleteSong('s1', 'Amazing Grace');
      expect(deleteDoc).toHaveBeenCalledWith({ id: 's1' });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          documentId: 's1',
          changeSummary: expect.stringContaining('Amazing Grace'),
        })
      );
    });
  });

  describe('setSongPublished', () => {
    it('logs a "publish" action when publishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setSongPublished('s1', 'Amazing Grace', true);
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 's1' },
        expect.objectContaining({ published: true })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'publish' })
      );
    });

    it('logs an "unpublish" action when unpublishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setSongPublished('s1', 'Amazing Grace', false);
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unpublish' })
      );
    });
  });

  describe('subscribeToSongs', () => {
    it('maps snapshot docs into Song objects, converting Timestamps to Dates', () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 's1',
              data: () => ({
                title: 'Amazing Grace',
                artist: 'John Newton',
                category: 'Hymn',
                lyrics: 'Lyrics',
                audioUrl: 'https://example.com/song.mp3',
                coverUrl: null,
                published: true,
                createdAt: new MockTimestamp(1000),
                updatedAt: new MockTimestamp(2000),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToSongs(onNext, onError);

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 's1',
          title: 'Amazing Grace',
          artist: 'John Newton',
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

      subscribeToSongs(onNext, onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('uploadSongCoverImage', () => {
    it('uploads the file and returns its download URL', async () => {
      vi.mocked(uploadBytes).mockResolvedValue(undefined as never);
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/uploaded.jpg');
      const file = new File(['a'], 'cover.jpg', { type: 'image/jpeg' });

      const url = await uploadSongCoverImage(file);

      expect(uploadBytes).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('cover.jpg') }),
        file,
        { contentType: 'image/jpeg' }
      );
      expect(url).toBe('https://example.com/uploaded.jpg');
    });
  });
});
