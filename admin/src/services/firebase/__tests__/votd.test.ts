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
  collection: vi.fn((_db, name) => `${name}-collection`),
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import {
  DEFAULT_VOTD_CONFIG_DOCUMENT,
  VOTD_TIMEZONE,
  bumpVotdPoolVersion,
  deleteVersePoolEntry,
  saveVersePoolEntry,
  saveVotdConfig,
  setVersePoolEntryActive,
  subscribeToVersePool,
  subscribeToVotdConfig,
  toVersePoolEntryDocument,
  toVotdConfigDocument,
  versePoolEntryId,
} from '../votd';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the configuration document', () => {
  it('lives beside settings/church, not inside it', () => {
    vi.mocked(onSnapshot).mockImplementation(() => vi.fn());
    subscribeToVotdConfig(
      () => {},
      () => {}
    );
    expect(doc).toHaveBeenCalledWith({}, 'settings', 'dailyVerse');
  });

  it('reports the defaults when no administrator has ever configured it', () => {
    // A missing document means automation is ON with the defaults, which
    // is what the app does -- so the page must show that, not an empty
    // form that misrepresents what members are getting.
    vi.mocked(onSnapshot).mockImplementation((_ref, onNext) => {
      (onNext as (snapshot: unknown) => void)({ exists: () => false });
      return vi.fn();
    });
    const seen: unknown[] = [];
    subscribeToVotdConfig(
      (config) => seen.push(config),
      () => {}
    );
    expect(seen[0]).toEqual(DEFAULT_VOTD_CONFIG_DOCUMENT);
    expect(DEFAULT_VOTD_CONFIG_DOCUMENT.enabled).toBe(true);
  });

  it('defaults each field independently, so a half-written document still loads', () => {
    expect(toVotdConfigDocument({ seed: 'lent' })).toEqual({
      enabled: true,
      seed: 'lent',
      poolVersion: 1,
      timezone: VOTD_TIMEZONE,
      updatedAt: null,
    });
    expect(toVotdConfigDocument({ poolVersion: 0 }).poolVersion).toBe(1);
    expect(toVotdConfigDocument({ seed: '' }).seed).toBe('maranatha');
  });

  it('writes with merge, because the document may not exist yet', async () => {
    await saveVotdConfig({ enabled: false, seed: '  advent  ', poolVersion: 3 });
    const [ref, payload, options] = vi.mocked(setDoc).mock.calls[0]!;
    expect(ref).toMatchObject({ collectionName: 'settings', id: 'dailyVerse' });
    expect(payload).toMatchObject({
      enabled: false,
      seed: 'advent',
      poolVersion: 3,
      // Written every time, so the stored value can never drift from the
      // one the app actually honours.
      timezone: VOTD_TIMEZONE,
    });
    expect(options).toEqual({ merge: true });
  });

  it('records the change in the audit log, under settings', async () => {
    await saveVotdConfig({ enabled: true, seed: 'maranatha', poolVersion: 1 });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'settings', documentId: 'dailyVerse' })
    );
  });

  it('bumps the version to the next whole number, and reports it', async () => {
    await expect(bumpVotdPoolVersion(4)).resolves.toBe(5);
    expect(vi.mocked(setDoc).mock.calls[0]![1]).toMatchObject({ poolVersion: 5 });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ changeSummary: expect.stringContaining('5') })
    );
  });
});

describe('the pool', () => {
  it('subscribes to the WHOLE collection, deactivated entries included', () => {
    // The admin page has to show what it has switched off; the app's own
    // query filters those out server-side.
    vi.mocked(onSnapshot).mockImplementation(() => vi.fn());
    subscribeToVersePool(
      () => {},
      () => {}
    );
    expect(vi.mocked(onSnapshot).mock.calls[0]![0]).toBe('verse_pool-collection');
  });

  it('reads a document defensively', () => {
    expect(
      toVersePoolEntryDocument('id1', {
        reference: 'John 3:16',
        bookId: 'john',
        chapter: 3,
        verse: 16,
        order: 2,
        active: true,
      })
    ).toEqual({
      id: 'id1',
      reference: 'John 3:16',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      order: 2,
      active: true,
      createdAt: null,
      updatedAt: null,
    });
    // A document written before `active` existed must not vanish.
    expect(toVersePoolEntryDocument('id1', {}).active).toBe(true);
  });

  it('gives an entry a document id that says what it is', async () => {
    // Deliberately not addDoc(): adding the same verse twice then
    // overwrites rather than creating a duplicate, and a duplicate would
    // be twice as likely to come up.
    expect(versePoolEntryId('john', 3, 16)).toBe('john-3-16');
    await saveVersePoolEntry({
      reference: 'John 3:16',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      order: 0,
      active: true,
    });
    const [ref, , options] = vi.mocked(setDoc).mock.calls[0]!;
    expect(ref).toMatchObject({ collectionName: 'verse_pool', id: 'john-3-16' });
    expect(options).toEqual({ merge: true });
  });

  it('stores a REFERENCE and never verse text', async () => {
    await saveVersePoolEntry({
      reference: 'John 3:16',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      order: 0,
      active: true,
    });
    const payload = vi.mocked(setDoc).mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'active',
      'bookId',
      'chapter',
      'createdAt',
      'order',
      'reference',
      'updatedAt',
      'verse',
    ]);
    expect(payload).not.toHaveProperty('text');
  });

  it('activates and deactivates without deleting', async () => {
    await setVersePoolEntryActive('john-3-16', 'John 3:16', false);
    expect(vi.mocked(updateDoc).mock.calls[0]![1]).toMatchObject({ active: false });
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'verse_pool',
        changeSummary: expect.stringContaining('Deactivated'),
      })
    );
  });

  it('deletes with the reference in hand, since it is gone afterwards', async () => {
    await deleteVersePoolEntry('john-3-16', 'John 3:16');
    expect(deleteDoc).toHaveBeenCalled();
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ changeSummary: expect.stringContaining('John 3:16') })
    );
  });
});
