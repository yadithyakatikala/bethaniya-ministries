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
    static fromDate(date: Date) {
      return new MockTimestamp(Math.floor(date.getTime() / 1000));
    }
  }
  return { mockLogAdminAction: vi.fn(), MockTimestamp };
});

vi.mock('../app', () => ({ db: {} }));
vi.mock('../auditLog', () => ({ logAdminAction: mockLogAdminAction }));

vi.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  collection: vi.fn(() => 'events-collection'),
  doc: vi.fn((_db, _c, id) => ({ id })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((c) => c),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import {
  addDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  type FirestoreError,
} from 'firebase/firestore';
import {
  createEvent,
  deleteEvent,
  setEventLiveStream,
  setEventPublished,
  subscribeToEvents,
  updateEvent,
} from '../events';

const VALID_INPUT = {
  title: '  Sunday Service  ',
  location: '  123 Main St  ',
  description: '  Weekly gathering  ',
  startsAt: '2026-09-20T18:30',
};

describe('events service', () => {
  beforeEach(() => {
    mockLogAdminAction.mockReset();
    vi.mocked(addDoc).mockReset();
    vi.mocked(updateDoc).mockReset();
    vi.mocked(deleteDoc).mockReset();
  });

  describe('createEvent', () => {
    it('writes a trimmed, unpublished, non-live event with no stream URL and logs the action', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
      const id = await createEvent(VALID_INPUT);
      expect(id).toBe('new-id');
      expect(addDoc).toHaveBeenCalledWith(
        'events-collection',
        expect.objectContaining({
          title: 'Sunday Service',
          location: '123 Main St',
          description: 'Weekly gathering',
          published: false,
          isLive: false,
          youtubeUrl: '',
        })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          collection: 'events',
          documentId: 'new-id',
        })
      );
    });
  });

  describe('updateEvent', () => {
    it('updates only the content fields (never isLive/youtubeUrl) and logs the action', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await updateEvent('e1', VALID_INPUT);
      const payload = vi.mocked(updateDoc).mock.calls[0]?.[1];
      expect(payload).toMatchObject({ title: 'Sunday Service', location: '123 Main St' });
      expect(payload).not.toHaveProperty('isLive');
      expect(payload).not.toHaveProperty('youtubeUrl');
      expect(payload).not.toHaveProperty('published');
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', documentId: 'e1' })
      );
    });
  });

  describe('deleteEvent', () => {
    it('deletes the document and logs the action with the given title', async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined);
      await deleteEvent('e1', 'Sunday Service');
      expect(deleteDoc).toHaveBeenCalledWith({ id: 'e1' });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          documentId: 'e1',
          changeSummary: expect.stringContaining('Sunday Service'),
        })
      );
    });
  });

  describe('setEventPublished', () => {
    it('logs a "publish" action when publishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setEventPublished('e1', 'Sunday Service', true);
      expect(updateDoc).toHaveBeenCalledWith(
        { id: 'e1' },
        expect.objectContaining({ published: true })
      );
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'publish' })
      );
    });

    it('logs an "unpublish" action when unpublishing', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setEventPublished('e1', 'Sunday Service', false);
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unpublish' })
      );
    });
  });

  describe('setEventLiveStream', () => {
    it('updates ONLY isLive/youtubeUrl -- never updatedAt or any content field (title/location/description/published)', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setEventLiveStream('e1', 'Sunday Service', {
        isLive: true,
        youtubeUrl: '  https://youtu.be/dQw4w9WgXcQ  ',
      });
      const target = vi.mocked(updateDoc).mock.calls[0]?.[0];
      const payload = vi.mocked(updateDoc).mock.calls[0]?.[1];
      expect(target).toEqual({ id: 'e1' });
      // Exactly these two keys -- not a superset check -- because firestore.rules'
      // Host branch uses .diff().affectedKeys().hasOnly(['isLive', 'youtubeUrl']),
      // so a single extra key (e.g. updatedAt) here would make every real Host
      // live-stream write get rejected server-side even though it looks fine
      // against a mocked updateDoc. See events.ts's setEventLiveStream doc comment.
      expect(Object.keys(payload as object).sort()).toEqual(['isLive', 'youtubeUrl']);
      expect(payload).toMatchObject({
        isLive: true,
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', documentId: 'e1' })
      );
    });

    it('can end a stream by setting isLive false and clearing youtubeUrl, still touching only those two fields', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setEventLiveStream('e1', 'Sunday Service', { isLive: false, youtubeUrl: '' });
      const payload = vi.mocked(updateDoc).mock.calls[0]?.[1];
      expect(Object.keys(payload as object).sort()).toEqual(['isLive', 'youtubeUrl']);
      expect(payload).toMatchObject({ isLive: false, youtubeUrl: '' });
    });

    it('logs ending the stream distinctly from starting it', async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
      await setEventLiveStream('e1', 'Sunday Service', { isLive: false, youtubeUrl: '' });
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ changeSummary: expect.stringContaining('Ended') })
      );
    });
  });

  describe('subscribeToEvents', () => {
    it('maps snapshot docs into Event objects, converting Timestamps to Dates', () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q, next) => {
        (next as (snap: unknown) => void)({
          docs: [
            {
              id: 'e1',
              data: () => ({
                title: 'Sunday Service',
                location: '123 Main St',
                description: 'Weekly gathering',
                startsAt: new MockTimestamp(1000),
                published: true,
                isLive: false,
                youtubeUrl: '',
                createdAt: new MockTimestamp(500),
                updatedAt: new MockTimestamp(600),
              }),
            },
          ],
        });
        return vi.fn();
      });

      subscribeToEvents(onNext, onError);

      expect(onNext).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'e1',
          title: 'Sunday Service',
          published: true,
          isLive: false,
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

      subscribeToEvents(onNext, onError);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
