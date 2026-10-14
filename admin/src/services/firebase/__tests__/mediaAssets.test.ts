import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  collection: vi.fn((_db, name) => `${name}-collection`),
  doc: vi.fn((_db, _c, id) => ({ id })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  query: vi.fn((c, ...rest) => ({ c, rest })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { addDoc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  assetFromLink,
  assetFromUpload,
  assetFromYouTube,
  createMediaAsset,
  deleteMediaAsset,
  subscribeToMediaAssets,
  titleFromFilename,
  toMediaAsset,
  updateMediaAsset,
} from '../mediaAssets';
import type { UploadedAsset } from '../../media/types';

const AUTHOR = { uid: 'admin-1', name: 'Admin One' };
const DETAILS = {
  title: '  Easter poster  ',
  altText: '  A cross  ',
  category: 'poster' as const,
};

const UPLOADED_IMAGE: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/image/upload/v1/easter.jpg',
  publicId: 'maranatha/easter',
  resourceType: 'image',
  kind: 'image',
  format: 'jpg',
  bytes: 123456,
  width: 1600,
  height: 900,
  durationSeconds: null,
  originalFilename: 'Easter-Poster_final',
};

beforeEach(() => {
  mockLogAdminAction.mockReset();
  vi.mocked(addDoc).mockReset();
  vi.mocked(updateDoc).mockReset();
  vi.mocked(deleteDoc).mockReset();
  vi.mocked(onSnapshot).mockReset();
});

describe('reading a record', () => {
  it('maps every field and converts timestamps', () => {
    const asset = toMediaAsset('a1', {
      kind: 'audio',
      source: 'cloudinary',
      category: 'song',
      title: 'Amazing Grace',
      altText: '',
      url: 'https://res.cloudinary.com/x/video/upload/a.mp3',
      thumbnailUrl: null,
      publicId: 'maranatha/a',
      format: 'mp3',
      bytes: 4200000,
      width: null,
      height: null,
      durationSeconds: 187.4,
      originalFilename: 'a',
      youtubeId: null,
      createdBy: 'admin-1',
      createdByName: 'Admin One',
      createdAt: new MockTimestamp(1700000000),
      updatedAt: new MockTimestamp(1700000100),
    });
    expect(asset).toMatchObject({
      id: 'a1',
      kind: 'audio',
      source: 'cloudinary',
      category: 'song',
      durationSeconds: 187.4,
      bytes: 4200000,
      createdByName: 'Admin One',
    });
    expect(asset.createdAt).toEqual(new Date(1700000000 * 1000));
    expect(asset.updatedAt).toEqual(new Date(1700000100 * 1000));
  });

  it('survives a malformed document without throwing', () => {
    const asset = toMediaAsset('bad', {
      kind: 'banana',
      source: 42,
      category: null,
      title: undefined,
      url: { not: 'a string' },
      bytes: 'big',
    });
    expect(asset).toMatchObject({
      id: 'bad',
      kind: 'image',
      source: 'link',
      category: 'general',
      title: '',
      url: '',
      bytes: null,
      createdAt: null,
    });
  });

  it('subscribes newest first and hands over mapped records', () => {
    const onNext = vi.fn();
    const onError = vi.fn();
    vi.mocked(onSnapshot).mockImplementation(((
      q: unknown,
      next: (s: unknown) => void
    ) => {
      expect(q).toMatchObject({ rest: [{ field: 'createdAt', dir: 'desc' }] });
      next({
        docs: [
          {
            id: 'a1',
            data: () => ({ kind: 'image', title: 'One', url: 'https://x.test/1.jpg' }),
          },
        ],
      });
      return vi.fn();
    }) as never);
    subscribeToMediaAssets(onNext, onError);
    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a1', title: 'One' }),
    ]);
  });

  it('passes a read error on to the caller', () => {
    const onError = vi.fn();
    const error = { code: 'permission-denied' };
    vi.mocked(onSnapshot).mockImplementation(((
      _q: unknown,
      _n: unknown,
      err: (e: unknown) => void
    ) => {
      err(error);
      return vi.fn();
    }) as never);
    subscribeToMediaAssets(vi.fn(), onError);
    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('building a record', () => {
  it('turns a Cloudinary upload into an image record with the details given', () => {
    expect(assetFromUpload(UPLOADED_IMAGE, DETAILS)).toEqual({
      kind: 'image',
      source: 'cloudinary',
      category: 'poster',
      title: 'Easter poster',
      altText: 'A cross',
      url: UPLOADED_IMAGE.url,
      thumbnailUrl: null,
      publicId: 'maranatha/easter',
      format: 'jpg',
      bytes: 123456,
      width: 1600,
      height: 900,
      durationSeconds: null,
      originalFilename: 'Easter-Poster_final',
      youtubeId: null,
    });
  });

  it('titles an untitled upload from its file name', () => {
    const record = assetFromUpload(UPLOADED_IMAGE, { ...DETAILS, title: '   ' });
    expect(record.title).toBe('Easter Poster final');
  });

  it('keeps no alt text for audio', () => {
    const record = assetFromUpload(
      { ...UPLOADED_IMAGE, kind: 'audio', resourceType: 'video', durationSeconds: 187 },
      { ...DETAILS, category: 'song' }
    );
    expect(record.altText).toBe('');
    expect(record.kind).toBe('audio');
    expect(record.durationSeconds).toBe(187);
  });

  it('turns a YouTube video into a video record with its canonical address and thumbnail', () => {
    const record = assetFromYouTube(
      {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      { title: '', altText: 'ignored', category: 'video' }
    );
    expect(record).toMatchObject({
      kind: 'video',
      source: 'youtube',
      title: 'YouTube video',
      altText: '',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      youtubeId: 'dQw4w9WgXcQ',
      publicId: null,
    });
  });

  it('turns a pasted link into a link record', () => {
    const record = assetFromLink('  https://example.org/p.png ', 'image', DETAILS);
    expect(record).toMatchObject({
      kind: 'image',
      source: 'link',
      url: 'https://example.org/p.png',
      altText: 'A cross',
      publicId: null,
    });
  });

  it('derives a readable title from a file name', () => {
    expect(titleFromFilename('Sunday-Poster_final.png')).toBe('Sunday Poster final');
    expect(titleFromFilename(null)).toBe('Untitled');
    expect(titleFromFilename('.png')).toBe('Untitled');
    expect(titleFromFilename('x'.repeat(500)).length).toBe(200);
  });
});

/**
 * firestore.rules' isValidMediaAsset() fixes what a record may hold. The
 * numbers and names in an upload record come straight from Cloudinary's reply,
 * the one input here that is not ours, and a value outside those limits would
 * have the WHOLE record refused after the file was already stored -- the
 * administrator would be told the library "could not be updated" for a file
 * that was fine. So a value that cannot be recorded is left out (null); the
 * file, its address and everything else are recorded as usual.
 */
describe('a record the rules will accept, whatever the upload reply said', () => {
  const record = (overrides: Partial<UploadedAsset>) =>
    assetFromUpload({ ...UPLOADED_IMAGE, ...overrides }, DETAILS);

  it('keeps every value that is within the limits, right up to the edge', () => {
    const edge = record({
      publicId: 'p'.repeat(300),
      format: 'f'.repeat(20),
      bytes: 104_857_600,
      width: 30_000,
      height: 30_000,
      durationSeconds: 86_400,
      originalFilename: 'n'.repeat(300),
    });
    expect(edge).toMatchObject({
      publicId: 'p'.repeat(300),
      format: 'f'.repeat(20),
      bytes: 104_857_600,
      width: 30_000,
      height: 30_000,
      durationSeconds: 86_400,
      originalFilename: 'n'.repeat(300),
    });
    expect(record({ bytes: 0, durationSeconds: 0 })).toMatchObject({
      bytes: 0,
      durationSeconds: 0,
    });
    expect(record({ durationSeconds: 187.4 }).durationSeconds).toBe(187.4);
  });

  it('leaves out a size that is not a whole number of bytes in range', () => {
    for (const bytes of [-1, 1.5, 104_857_601, Number.MAX_SAFE_INTEGER]) {
      expect(record({ bytes }).bytes).toBeNull();
    }
  });

  it('leaves out dimensions that are not whole pixels from 1 to 30,000', () => {
    // Audio is a "video" to Cloudinary and may be described as 0 x 0 pixels.
    for (const side of [0, -5, 1.5, 30_001]) {
      const made = record({ width: side, height: side });
      expect(made.width).toBeNull();
      expect(made.height).toBeNull();
    }
  });

  it('leaves out a duration outside zero to a day', () => {
    for (const durationSeconds of [-1, 86_401]) {
      expect(record({ durationSeconds }).durationSeconds).toBeNull();
    }
  });

  it('leaves out text longer than the record can hold, but not the file', () => {
    const made = record({
      publicId: 'p'.repeat(301),
      format: 'f'.repeat(21),
      originalFilename: 'n'.repeat(301),
    });
    expect(made).toMatchObject({
      publicId: null,
      format: null,
      originalFilename: null,
      url: UPLOADED_IMAGE.url,
      kind: 'image',
      width: 1600,
    });
  });

  it('still titles an upload from a file name that is too long to record', () => {
    const made = record({ originalFilename: 'n'.repeat(301) });
    expect(made.originalFilename).toBeNull();
    expect(made.title).toBe('Easter poster');
    const untitled = assetFromUpload(
      { ...UPLOADED_IMAGE, originalFilename: 'n'.repeat(301) },
      { ...DETAILS, title: '' }
    );
    expect(untitled.title).toBe('n'.repeat(200));
  });
});

describe('writing', () => {
  it('creates a record stamped with its author and the server clock, and logs it', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-id' } as never);
    const record = assetFromUpload(UPLOADED_IMAGE, DETAILS);
    const id = await createMediaAsset(record, AUTHOR);
    expect(id).toBe('new-id');
    expect(addDoc).toHaveBeenCalledWith(
      'media_assets-collection',
      expect.objectContaining({
        ...record,
        createdBy: 'admin-1',
        createdByName: 'Admin One',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      })
    );
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        collection: 'media_assets',
        documentId: 'new-id',
      })
    );
  });

  it('does not log an audit entry for a write that failed', async () => {
    vi.mocked(addDoc).mockRejectedValue({ code: 'permission-denied' });
    await expect(
      createMediaAsset(assetFromUpload(UPLOADED_IMAGE, DETAILS), AUTHOR)
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });

  it('updates only the label, description and category', async () => {
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    await updateMediaAsset('a1', DETAILS);
    expect(updateDoc).toHaveBeenCalledWith(
      { id: 'a1' },
      {
        title: 'Easter poster',
        altText: 'A cross',
        category: 'poster',
        updatedAt: 'SERVER_TIMESTAMP',
      }
    );
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        collection: 'media_assets',
        documentId: 'a1',
      })
    );
  });

  it('removes the record and says plainly that the file was NOT deleted', async () => {
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
    await deleteMediaAsset('a1', 'Easter poster');
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'a1' });
    const entry = mockLogAdminAction.mock.calls[0]![0] as {
      changeSummary: string;
      action: string;
    };
    expect(entry.action).toBe('delete');
    expect(entry.changeSummary).toContain('the file itself was not deleted');
  });
});
