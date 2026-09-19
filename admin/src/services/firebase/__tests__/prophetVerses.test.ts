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

vi.mock('../app', () => ({ db: {}, storage: {} }));
vi.mock('../auditLog', () => ({ logAdminAction: mockLogAdminAction }));

vi.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  collection: vi.fn((_db, name) => `${name}-collection`),
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id })),
  addDoc: vi.fn(async () => ({ id: 'new-id' })),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, direction) => `orderBy:${field}:${direction}`),
  query: vi.fn((collectionRef, ...rest) => ({ collectionRef, rest })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { addDoc, deleteDoc, onSnapshot, orderBy, updateDoc } from 'firebase/firestore';
import {
  createProphetVerse,
  deleteProphetVerse,
  setProphetVersePublished,
  subscribeToProphetVerses,
  toProphetVerseRecord,
  updateProphetVerse,
} from '../prophetVerses';

const PUBLISH_AT = new Date('2026-04-05T06:00:00.000Z');

function input(partial: Partial<Parameters<typeof createProphetVerse>[0]> = {}) {
  return {
    title: '  A word for the church  ',
    reference: 'Isaiah 43:19',
    text: 'Behold, I will do a new thing.',
    attribution: null,
    imageUrl: null,
    published: false,
    publishAt: PUBLISH_AT,
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listing', () => {
  it('lists everything, newest scheduled first -- drafts and future dates included', () => {
    // Managing drafts and schedules is what this page exists for; the
    // app's own query is the one that filters.
    vi.mocked(onSnapshot).mockImplementation(() => vi.fn());
    subscribeToProphetVerses(
      () => {},
      () => {}
    );
    expect(orderBy).toHaveBeenCalledWith('publishAt', 'desc');
  });

  it('reads a document defensively', () => {
    expect(
      toProphetVerseRecord('p1', {
        title: 'A word',
        reference: 'Isaiah 43:19',
        text: 'Behold.',
        published: true,
        publishAt: MockTimestamp.fromDate(PUBLISH_AT),
      })
    ).toMatchObject({
      id: 'p1',
      title: 'A word',
      published: true,
      publishAt: PUBLISH_AT,
      attribution: null,
      imageUrl: null,
    });
  });

  it('treats a missing published flag as NOT published', () => {
    // Defaulting the other way would make a draft visible.
    expect(toProphetVerseRecord('p1', { title: 'A', text: 'B' }).published).toBe(false);
  });
});

describe('writing', () => {
  it('trims the words and stores publishAt as a Timestamp', async () => {
    await createProphetVerse(input());
    const payload = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.title).toBe('A word for the church');
    // An INSTANT, not a "YYYY-MM-DD" calendar key: the app compares it
    // with <= against the server clock.
    expect(payload.publishAt).toBeInstanceOf(MockTimestamp);
  });

  it('creates unpublished, so nothing reaches the congregation by accident', async () => {
    await createProphetVerse(input());
    expect(vi.mocked(addDoc).mock.calls[0]![1]).toMatchObject({ published: false });
  });

  it('writes an absent attribution and image as null, not as an empty string', async () => {
    // So "never set" and "cleared" read identically to every consumer.
    await createProphetVerse(input({ attribution: '   ', imageUrl: '' }));
    expect(vi.mocked(addDoc).mock.calls[0]![1]).toMatchObject({
      attribution: null,
      imageUrl: null,
    });
  });

  it('stores only the fields the rules allow', async () => {
    await createProphetVerse(input());
    const payload = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'attribution',
      'createdAt',
      'imageUrl',
      'publishAt',
      'published',
      'reference',
      'text',
      'title',
      'updatedAt',
    ]);
  });

  it('logs a create and an update separately', async () => {
    await createProphetVerse(input());
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', collection: 'prophet_verses' })
    );
    mockLogAdminAction.mockClear();
    await updateProphetVerse('p1', input());
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', collection: 'prophet_verses' })
    );
  });
});

describe('publishing', () => {
  it('is its own action, with its own audit entry', async () => {
    // "Who made this visible to the congregation" is a different question
    // from "who edited the wording".
    await setProphetVersePublished('p1', 'A word', true);
    expect(vi.mocked(updateDoc).mock.calls[0]![1]).toMatchObject({ published: true });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'publish' })
    );

    mockLogAdminAction.mockClear();
    await setProphetVersePublished('p1', 'A word', false);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unpublish' })
    );
  });

  it('touches nothing but the flag and the timestamp', async () => {
    await setProphetVersePublished('p1', 'A word', true);
    const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload).sort()).toEqual(['published', 'updatedAt']);
  });
});

describe('deleting', () => {
  it('takes the title in hand, since it is gone afterwards', async () => {
    await deleteProphetVerse('p1', 'A word');
    expect(deleteDoc).toHaveBeenCalled();
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        changeSummary: expect.stringContaining('A word'),
      })
    );
  });
});

describe('what is deliberately absent', () => {
  it('exports no image-upload function -- there is no Storage bucket on this plan', async () => {
    const module_ = await import('../prophetVerses');
    expect(Object.keys(module_).some((name) => /upload/i.test(name))).toBe(false);
  });
});
