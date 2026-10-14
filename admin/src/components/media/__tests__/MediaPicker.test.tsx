import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/firebase/mediaAssets', () => ({
  subscribeToMediaAssets: vi.fn(),
}));

import {
  subscribeToMediaAssets,
  type MediaAsset,
} from '../../../services/firebase/mediaAssets';
import { MediaPicker } from '../MediaPicker';
import { renderThemed } from './helpers';

function asset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'a',
    kind: 'image',
    source: 'cloudinary',
    category: 'poster',
    title: 'Poster',
    altText: '',
    url: 'https://res.cloudinary.com/my-church/image/upload/v1/p.jpg',
    thumbnailUrl: null,
    publicId: 'p',
    format: 'jpg',
    bytes: 2097152,
    width: 1600,
    height: 900,
    durationSeconds: null,
    originalFilename: 'p',
    youtubeId: null,
    createdBy: 'u',
    createdByName: 'U',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const LIBRARY: MediaAsset[] = [
  asset({
    id: 'e',
    title: 'Easter poster',
    category: 'poster',
    originalFilename: 'easter-final',
  }),
  asset({
    id: 'c',
    title: 'Advent cover',
    category: 'cover',
    altText: 'Candles burning',
  }),
  asset({
    id: 's',
    kind: 'audio',
    category: 'song',
    title: 'Amazing Grace',
    format: 'mp3',
    width: null,
    height: null,
    durationSeconds: 125,
    url: 'https://res.cloudinary.com/my-church/video/upload/v1/ag.mp3',
  }),
];

function publish(assets: MediaAsset[]) {
  const unsubscribe = vi.fn();
  vi.mocked(subscribeToMediaAssets).mockImplementation(((
    next: (a: MediaAsset[]) => void
  ) => {
    next(assets);
    return unsubscribe;
  }) as never);
  return unsubscribe;
}

function open(kinds: Array<'image' | 'audio' | 'video'> = ['image']) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  renderThemed(
    <MediaPicker
      open
      kinds={kinds}
      title="Choose"
      onSelect={onSelect}
      onClose={onClose}
    />
  );
  return { onSelect, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the picker', () => {
  it('lists only the kinds asked for', () => {
    publish(LIBRARY);
    open(['image']);
    expect(screen.getByTestId('media-picker-item-e')).toBeInTheDocument();
    expect(screen.getByTestId('media-picker-item-c')).toBeInTheDocument();
    expect(screen.queryByTestId('media-picker-item-s')).toBeNull();
  });

  it('lists audio when asked for audio, with its length', () => {
    publish(LIBRARY);
    open(['audio']);
    const item = screen.getByTestId('media-picker-item-s');
    expect(within(item).getByText('Amazing Grace')).toBeInTheDocument();
    expect(item).toHaveTextContent('MP3 · 2:05 · 2.0 MB');
  });

  it('hands the whole record to the caller when one is chosen', async () => {
    publish(LIBRARY);
    const { onSelect } = open();
    await userEvent.setup().click(screen.getByTestId('media-picker-item-e'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e', title: 'Easter poster' })
    );
  });

  it('searches the title, the file name and the description', async () => {
    publish(LIBRARY);
    open();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('media-picker-search'), 'easter-final');
    expect(screen.getByTestId('media-picker-item-e')).toBeInTheDocument();
    expect(screen.queryByTestId('media-picker-item-c')).toBeNull();

    await user.clear(screen.getByTestId('media-picker-search'));
    await user.type(screen.getByTestId('media-picker-search'), 'candles');
    expect(screen.getByTestId('media-picker-item-c')).toBeInTheDocument();
    expect(screen.queryByTestId('media-picker-item-e')).toBeNull();
  });

  it('says so when nothing matches the search', async () => {
    publish(LIBRARY);
    open();
    await userEvent.setup().type(screen.getByTestId('media-picker-search'), 'zzz');
    expect(screen.getByTestId('media-picker-no-match')).toBeInTheDocument();
  });

  it("shows the library's emptiness with a way to fill it", () => {
    publish([]);
    open();
    expect(screen.getByTestId('media-picker-empty')).toHaveTextContent(
      'Nothing here yet'
    );
    expect(screen.getByRole('link', { name: 'Open the Media Library' })).toHaveAttribute(
      'href',
      '/media-library'
    );
  });

  it('tells the person when only other kinds exist (a cover picker with only songs)', () => {
    publish([LIBRARY[2]!]);
    open(['image']);
    expect(screen.getByTestId('media-picker-empty')).toBeInTheDocument();
  });

  it('shows a loading state until the library arrives', () => {
    vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
    open();
    expect(screen.getByTestId('media-picker-loading')).toBeInTheDocument();
  });

  it('explains a refused read in terms of the rules, not as a mystery', () => {
    vi.mocked(subscribeToMediaAssets).mockImplementation(((
      _next: unknown,
      onError: (e: unknown) => void
    ) => {
      onError({ code: 'permission-denied' });
      return vi.fn();
    }) as never);
    open();
    expect(screen.getByTestId('media-picker-error')).toHaveTextContent(
      'needs the latest Firestore security rules'
    );
  });

  it('subscribes only while open, and lets go when closed', () => {
    const unsubscribe = publish(LIBRARY);
    const { unmount } = renderThemed(
      <MediaPicker
        open={false}
        kinds={['image']}
        title="Choose"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(subscribeToMediaAssets).not.toHaveBeenCalled();
    unmount();

    const second = renderThemed(
      <MediaPicker
        open
        kinds={['image']}
        title="Choose"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(subscribeToMediaAssets).toHaveBeenCalledTimes(1);
    second.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('closes from Cancel', async () => {
    publish(LIBRARY);
    const { onClose } = open();
    await userEvent.setup().click(screen.getByTestId('media-picker-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
