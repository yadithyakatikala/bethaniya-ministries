import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

vi.mock('../../../services/media/cloudinaryConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryConfig')>()),
  getCloudinaryConfig: vi.fn(),
}));
vi.mock('../../../services/media/cloudinaryUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryUpload')>()),
  uploadToCloudinary: vi.fn(),
}));
vi.mock('../../../services/firebase/mediaAssets', () => ({
  createMediaAsset: vi.fn(),
  assetFromUpload: vi.fn((uploaded, details) => ({ uploaded, details })),
  subscribeToMediaAssets: vi.fn(() => vi.fn()),
}));

import { getCloudinaryConfig } from '../../../services/media/cloudinaryConfig';
import { uploadToCloudinary } from '../../../services/media/cloudinaryUpload';
import {
  createMediaAsset,
  subscribeToMediaAssets,
} from '../../../services/firebase/mediaAssets';
import { useAuthStore } from '../../../store/authStore';
import type { UploadedAsset } from '../../../services/media/types';
import { AudioField } from '../AudioField';
import { MISSING, READY, fileOf, renderThemed } from './helpers';

const UPLOADED: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/video/upload/v1/hymn.mp3',
  publicId: 'maranatha/hymn',
  resourceType: 'video',
  kind: 'audio',
  format: 'mp3',
  bytes: 4194304,
  width: null,
  height: null,
  durationSeconds: 187,
  originalFilename: 'hymn',
};

function Harness({ initial = '', error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AudioField
        value={value}
        onChange={setValue}
        label="Song audio"
        category="song"
        testIdPrefix="song-audio"
        error={error}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: '', email: 'a@x.org' } as never,
  });
});

const picker = () => userEvent.setup({ applyAccept: false });

describe('the address box', () => {
  it('is always there, so an existing link can be seen and changed', () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderThemed(<Harness initial="https://example.org/stream.m3u8" />);
    expect(screen.getByTestId('song-audio-url-input')).toHaveValue(
      'https://example.org/stream.m3u8'
    );
  });

  it('reports typing straight to the form', async () => {
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.type(screen.getByTestId('song-audio-url-input'), 'https://a.test/x.mp3');
    expect(screen.getByTestId('value')).toHaveTextContent('https://a.test/x.mp3');
  });

  it("shows the form's own validation message beneath it", () => {
    renderThemed(<Harness error="Audio URL is required." />);
    expect(screen.getByText('Audio URL is required.')).toBeInTheDocument();
  });
});

describe('the preview', () => {
  it('plays a valid address in a player that fetches only metadata', () => {
    renderThemed(<Harness initial="https://a.test/x.mp3" />);
    const player = screen.getByTestId('song-audio-player') as HTMLAudioElement;
    expect(player).toHaveAttribute('src', 'https://a.test/x.mp3');
    expect(player).toHaveAttribute('preload', 'metadata');
    expect(player).toHaveAttribute('controls');
  });

  it('shows no player for something that is not an address', () => {
    renderThemed(<Harness initial="not a url" />);
    expect(screen.queryByTestId('song-audio-player')).toBeNull();
  });

  it('reads the duration from the player for a pasted link', () => {
    renderThemed(<Harness initial="https://a.test/x.mp3" />);
    const player = screen.getByTestId('song-audio-player');
    Object.defineProperty(player, 'duration', { value: 187, configurable: true });
    fireEvent.loadedMetadata(player);
    expect(screen.getByTestId('song-audio-facts')).toHaveTextContent('3:07');
  });

  it('warns when the address cannot be played as audio', () => {
    renderThemed(<Harness initial="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />);
    fireEvent.error(screen.getByTestId('song-audio-player'));
    expect(screen.getByTestId('song-audio-play-failed')).toHaveTextContent(
      'could not be played as audio'
    );
  });
});

describe('uploading', () => {
  it('is offered when set up, and replaced by a notice when not', () => {
    renderThemed(<Harness />);
    expect(screen.getByTestId('song-audio-upload-button')).toHaveTextContent(
      'Upload audio'
    );
    expect(screen.getByTestId('song-audio-input')).toHaveAttribute(
      'accept',
      expect.stringContaining('audio/mpeg')
    );
  });

  it('shows the setup notice instead of a dead button when not set up', () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderThemed(<Harness />);
    expect(screen.getByTestId('song-audio-setup')).toHaveTextContent(
      'Audio upload is not set up yet'
    );
    expect(screen.queryByTestId('song-audio-upload-button')).toBeNull();
    expect(screen.queryByTestId('song-audio-input')).toBeNull();
  });

  it('uploads a song, fills the address, and shows its format, size and length', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED);
    vi.mocked(createMediaAsset).mockResolvedValue('lib-1');
    const user = picker();
    renderThemed(<Harness />);
    const file = fileOf('hymn.mp3', 'audio/mpeg');
    await user.upload(screen.getByTestId('song-audio-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(UPLOADED.url)
    );
    expect(uploadToCloudinary).toHaveBeenCalledWith(file, 'audio', expect.any(Object));
    expect(screen.getByTestId('song-audio-facts')).toHaveTextContent(
      'hymn · MP3 · 4.0 MB · 3:07'
    );
    expect(screen.getByTestId('song-audio-player')).toHaveAttribute('src', UPLOADED.url);
  });

  it('files the upload under the song category', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED);
    vi.mocked(createMediaAsset).mockResolvedValue('lib-1');
    const { assetFromUpload } = await import('../../../services/firebase/mediaAssets');
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('song-audio-input'),
      fileOf('hymn.mp3', 'audio/mpeg')
    );
    await waitFor(() => expect(createMediaAsset).toHaveBeenCalled());
    expect(assetFromUpload).toHaveBeenCalledWith(UPLOADED, {
      title: '',
      altText: '',
      category: 'song',
    });
  });

  it.each([
    ['hymn.ogg', 'audio/ogg', /MP3, M4A, AAC or WAV/],
    ['movie.mp4', 'video/mp4', /MP3, M4A, AAC or WAV/],
  ])('refuses %s before sending anything', async (name, type, message) => {
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(screen.getByTestId('song-audio-input'), fileOf(name, type));
    expect(await screen.findByTestId('song-audio-error')).toHaveTextContent(message);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('refuses a file over the size cap and suggests the fix', async () => {
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('song-audio-input'),
      fileOf('hymn.wav', 'audio/wav', 30 * 1024 * 1024)
    );
    expect(await screen.findByTestId('song-audio-error')).toHaveTextContent(
      'Audio must be smaller than 25 MB. Try saving it as an MP3.'
    );
  });

  it('keeps the library failure separate from the upload', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED);
    vi.mocked(createMediaAsset).mockRejectedValue({ code: 'permission-denied' });
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('song-audio-input'),
      fileOf('hymn.mp3', 'audio/mpeg')
    );
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(UPLOADED.url)
    );
    expect(screen.getByTestId('song-audio-library-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('song-audio-error')).toBeNull();
  });

  it('chooses audio from the library and shows what it knows about it', async () => {
    vi.mocked(subscribeToMediaAssets).mockImplementation(((
      next: (a: unknown[]) => void
    ) => {
      next([
        {
          id: 's1',
          kind: 'audio',
          source: 'cloudinary',
          category: 'song',
          title: 'Amazing Grace',
          altText: '',
          url: 'https://res.cloudinary.com/my-church/video/upload/v1/ag.mp3',
          thumbnailUrl: null,
          publicId: 'p',
          format: 'mp3',
          bytes: 2097152,
          width: null,
          height: null,
          durationSeconds: 125,
          originalFilename: 'ag',
          youtubeId: null,
          createdBy: 'u',
          createdByName: 'U',
          createdAt: null,
          updatedAt: null,
        },
      ]);
      return vi.fn();
    }) as never);
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.click(screen.getByTestId('song-audio-library-button'));
    await user.click(await screen.findByTestId('song-audio-picker-item-s1'));
    expect(screen.getByTestId('value')).toHaveTextContent('ag.mp3');
    expect(screen.getByTestId('song-audio-facts')).toHaveTextContent(
      'ag · MP3 · 2.0 MB · 2:05'
    );
  });
});
