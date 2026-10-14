import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '../../../services/firebase/mediaAssets';
import {
  INITIAL_FILTERS,
  KIND_TABS,
  countByKind,
  filterAssets,
  hasActiveFilters,
} from '../filters';
import {
  ASSET_ALT_MAX_LENGTH,
  ASSET_TITLE_MAX_LENGTH,
  checkLink,
  validateAssetDetails,
} from '../validation';

function asset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'a',
    kind: 'image',
    source: 'cloudinary',
    category: 'poster',
    title: 'Poster',
    altText: '',
    url: 'https://res.cloudinary.com/x/image/upload/p.jpg',
    thumbnailUrl: null,
    publicId: null,
    format: null,
    bytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    originalFilename: null,
    youtubeId: null,
    createdBy: 'u',
    createdByName: 'U',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const LIBRARY = [
  asset({ id: '1', title: 'Easter poster', category: 'poster' }),
  asset({ id: '2', title: 'Advent cover', category: 'cover', altText: 'Candles' }),
  asset({ id: '3', kind: 'audio', title: 'Amazing Grace', category: 'song' }),
  asset({
    id: '4',
    kind: 'video',
    source: 'youtube',
    title: 'Sunday sermon',
    category: 'video',
  }),
];

describe('filterAssets', () => {
  it('shows everything with no filters', () => {
    expect(filterAssets(LIBRARY, INITIAL_FILTERS)).toHaveLength(4);
  });
  it('filters by kind', () => {
    expect(
      filterAssets(LIBRARY, { ...INITIAL_FILTERS, kind: 'image' }).map((a) => a.id)
    ).toEqual(['1', '2']);
    expect(
      filterAssets(LIBRARY, { ...INITIAL_FILTERS, kind: 'audio' }).map((a) => a.id)
    ).toEqual(['3']);
    expect(
      filterAssets(LIBRARY, { ...INITIAL_FILTERS, kind: 'video' }).map((a) => a.id)
    ).toEqual(['4']);
  });
  it('filters by category', () => {
    expect(
      filterAssets(LIBRARY, { ...INITIAL_FILTERS, category: 'cover' }).map((a) => a.id)
    ).toEqual(['2']);
  });
  it('filters by search text, ignoring case, over name and description', () => {
    expect(
      filterAssets(LIBRARY, { ...INITIAL_FILTERS, search: 'GRACE' }).map((a) => a.id)
    ).toEqual(['3']);
    expect(
      filterAssets(LIBRARY, { ...INITIAL_FILTERS, search: 'candles' }).map((a) => a.id)
    ).toEqual(['2']);
  });
  it('combines the filters (all must hold)', () => {
    expect(
      filterAssets(LIBRARY, { search: 'poster', kind: 'image', category: 'cover' })
    ).toEqual([]);
    expect(
      filterAssets(LIBRARY, { search: 'poster', kind: 'image', category: 'poster' }).map(
        (a) => a.id
      )
    ).toEqual(['1']);
  });
  it('does not change the order or mutate its input', () => {
    const copy = [...LIBRARY];
    filterAssets(LIBRARY, INITIAL_FILTERS);
    expect(LIBRARY).toEqual(copy);
  });
});

describe('counts and tabs', () => {
  it('counts each kind, and the total, before any search', () => {
    expect(countByKind(LIBRARY)).toEqual({ all: 4, image: 2, audio: 1, video: 1 });
    expect(countByKind([])).toEqual({ all: 0, image: 0, audio: 0, video: 0 });
  });
  it('offers a tab for every kind, with All first', () => {
    expect(KIND_TABS.map((t) => t.value)).toEqual(['all', 'image', 'audio', 'video']);
  });
  it('knows when a filter is in force', () => {
    expect(hasActiveFilters(INITIAL_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...INITIAL_FILTERS, search: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...INITIAL_FILTERS, search: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...INITIAL_FILTERS, kind: 'audio' })).toBe(true);
    expect(hasActiveFilters({ ...INITIAL_FILTERS, category: 'song' })).toBe(true);
  });
});

describe('validateAssetDetails', () => {
  it('needs a name when editing, not when uploading', () => {
    expect(validateAssetDetails({ title: ' ', altText: '' }).title).toBe(
      'A name is required.'
    );
    expect(validateAssetDetails({ title: ' ', altText: '' }, false)).toEqual({});
  });
  it('holds names and descriptions to the same lengths as the rules', () => {
    expect(
      validateAssetDetails({ title: 'x'.repeat(ASSET_TITLE_MAX_LENGTH), altText: '' })
    ).toEqual({});
    expect(
      validateAssetDetails({ title: 'x'.repeat(ASSET_TITLE_MAX_LENGTH + 1), altText: '' })
        .title
    ).toMatch(/200/);
    expect(
      validateAssetDetails({ title: 'ok', altText: 'x'.repeat(ASSET_ALT_MAX_LENGTH + 1) })
        .altText
    ).toMatch(/500/);
  });
});

describe('checkLink', () => {
  it('tidies a YouTube address and keeps its id', () => {
    const result = checkLink('video', ' https://youtu.be/dQw4w9WgXcQ ');
    expect(result).toEqual({
      ok: true,
      address: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtube: {
        videoId: 'dQw4w9WgXcQ',
        canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    });
  });
  it('accepts another https video link as a plain link', () => {
    expect(checkLink('video', 'https://example.org/clip.mp4')).toEqual({
      ok: true,
      address: 'https://example.org/clip.mp4',
      youtube: null,
    });
  });
  it('explains a YouTube address that is not one video', () => {
    const result = checkLink(
      'video',
      'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/single video/);
  });
  it('asks for an address when empty', () => {
    expect(checkLink('video', ' ')).toEqual({
      ok: false,
      message: 'Paste the video address.',
    });
    const image = checkLink('image', '');
    expect(image.ok).toBe(false);
  });
  it.each([
    ['image', 'http://example.org/a.png', /https/],
    ['audio', 'javascript:alert(1)', /https/],
    ['image', 'https://u:p@example.org/a.png', /username or password/],
    ['image', 'https://example.org/a.svg', /will not open/],
    ['audio', 'https://example.org/run.exe', /will not open/],
  ] as const)('refuses %s link %s', (kind, address, message) => {
    const result = checkLink(kind, address);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(message);
  });
  it('accepts an https image or audio link', () => {
    expect(checkLink('image', 'https://example.org/a.png')).toMatchObject({ ok: true });
    expect(checkLink('audio', 'https://example.org/a.mp3')).toMatchObject({
      ok: true,
      youtube: null,
    });
  });
});
