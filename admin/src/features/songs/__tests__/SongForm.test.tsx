import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SongForm } from '../SongForm';
import * as songsService from '../../../services/firebase/songs';
import { useAuthStore } from '../../../store/authStore';
import {
  READY,
  UPLOADED_AUDIO,
  UPLOADED_IMAGE,
} from '../../../components/media/__tests__/helpers';
import type { Song } from '../../../types';

vi.mock('../../../services/firebase/songs');
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

function renderForm(props: Parameters<typeof SongForm>[0]) {
  return render(
    <MemoryRouter>
      <SongForm {...props} />
    </MemoryRouter>
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('song-title-input'), 'Amazing Grace');
  await user.type(screen.getByTestId('song-artist-input'), 'Traditional');
  await user.type(screen.getByTestId('song-category-input'), 'Hymn');
  await user.type(screen.getByTestId('song-lyrics-input'), 'Amazing grace...');
  await user.type(
    screen.getByTestId('song-audio-url-input'),
    'https://example.com/song.mp3'
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
  vi.mocked(createMediaAsset).mockResolvedValue('asset-1');
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: 'Admin One', email: 'a@x.org' } as never,
  });
  URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  URL.revokeObjectURL = vi.fn();
});

describe('SongForm', () => {
  it('shows validation errors and does not submit when required fields are empty', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('song-form-submit'));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Artist is required.')).toBeInTheDocument();
    expect(screen.getByText('Category is required.')).toBeInTheDocument();
    expect(screen.getByText('Lyrics are required.')).toBeInTheDocument();
    expect(screen.getByText('Audio URL is required.')).toBeInTheDocument();
    expect(songsService.createSong).not.toHaveBeenCalled();
  });

  it('creates a song with the entered fields when valid', async () => {
    vi.mocked(songsService.createSong).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    await user.click(screen.getByTestId('song-form-submit'));

    await waitFor(() =>
      expect(songsService.createSong).toHaveBeenCalledWith({
        title: 'Amazing Grace',
        artist: 'Traditional',
        category: 'Hymn',
        lyrics: 'Amazing grace...',
        audioUrl: 'https://example.com/song.mp3',
        coverUrl: null,
      })
    );
  });

  it('pre-fills fields and calls updateSong in edit mode', async () => {
    vi.mocked(songsService.updateSong).mockResolvedValue(undefined);
    const existing: Song = {
      id: 's1',
      title: 'Old title',
      artist: 'Old artist',
      category: 'Old category',
      lyrics: 'Old lyrics',
      audioUrl: 'https://example.com/old.mp3',
      coverUrl: null,
      published: true,
      createdAt: null,
      updatedAt: null,
    };
    renderForm({ mode: 'edit', song: existing });

    expect(screen.getByTestId('song-title-input')).toHaveValue('Old title');

    const user = userEvent.setup();
    await user.clear(screen.getByTestId('song-title-input'));
    await user.type(screen.getByTestId('song-title-input'), 'New title');
    await user.click(screen.getByTestId('song-form-submit'));

    await waitFor(() =>
      expect(songsService.updateSong).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ title: 'New title' })
      )
    );
  });

  it('rejects a non-http(s) audio URL', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('song-title-input'), 'Title');
    await user.type(screen.getByTestId('song-artist-input'), 'Artist');
    await user.type(screen.getByTestId('song-category-input'), 'Category');
    await user.type(screen.getByTestId('song-lyrics-input'), 'Lyrics');
    await user.type(screen.getByTestId('song-audio-url-input'), 'not-a-url');
    await user.click(screen.getByTestId('song-form-submit'));

    expect(
      await screen.findByText('Audio URL must be a valid http(s) URL.')
    ).toBeInTheDocument();
    expect(songsService.createSong).not.toHaveBeenCalled();
  });

  it('uploads the selected cover image and saves its address with the song', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    vi.mocked(songsService.createSong).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    const file = new File(['a'], 'cover.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('song-cover-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('song-cover-preview')).toHaveAttribute(
        'src',
        UPLOADED_IMAGE.url
      )
    );
    await user.click(screen.getByTestId('song-form-submit'));

    await waitFor(() =>
      expect(songsService.createSong).toHaveBeenCalledWith(
        expect.objectContaining({ coverUrl: UPLOADED_IMAGE.url })
      )
    );
  });

  it('shows an error for an oversized cover image and uploads nothing', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByTestId('song-cover-input'), bigFile);

    expect(await screen.findByTestId('song-cover-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(songsService.createSong).not.toHaveBeenCalled();
  });

  it('refuses audio that is too large before sending it, and names the limit', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    const hugeAudio = new File(['x'], 'sermon.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(hugeAudio, 'size', { value: 40 * 1024 * 1024 });
    await user.upload(screen.getByTestId('song-audio-input'), hugeAudio);

    expect(await screen.findByTestId('song-audio-error')).toHaveTextContent(
      'Audio must be smaller than 25 MB.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('refuses a file that is not audio, and names the formats that are', async () => {
    renderForm({ mode: 'create' });
    // The browser's own file filter would stop this in a real picker; the
    // check exists for drag-and-drop and for a browser that ignores it.
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(
      screen.getByTestId('song-audio-input'),
      new File(['x'], 'notes.pdf', { type: 'application/pdf' })
    );

    expect(await screen.findByTestId('song-audio-error')).toHaveTextContent(
      'MP3, M4A, AAC or WAV'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('uploads audio, shows what was uploaded, and saves the audio address', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_AUDIO);
    vi.mocked(songsService.createSong).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('song-title-input'), 'Amazing Grace');
    await user.type(screen.getByTestId('song-artist-input'), 'Traditional');
    await user.type(screen.getByTestId('song-category-input'), 'Hymn');
    await user.type(screen.getByTestId('song-lyrics-input'), 'Amazing grace...');
    await user.upload(
      screen.getByTestId('song-audio-input'),
      new File(['x'], 'hymn.mp3', { type: 'audio/mpeg' })
    );

    expect(await screen.findByTestId('song-audio-player')).toHaveAttribute(
      'src',
      UPLOADED_AUDIO.url
    );
    await user.click(screen.getByTestId('song-form-submit'));

    await waitFor(() =>
      expect(songsService.createSong).toHaveBeenCalledWith(
        expect.objectContaining({ audioUrl: UPLOADED_AUDIO.url })
      )
    );
  });

  it('shows a submit error and does not navigate away when the write fails', async () => {
    vi.mocked(songsService.createSong).mockRejectedValue(new Error('offline'));
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    await user.click(screen.getByTestId('song-form-submit'));

    expect(await screen.findByTestId('song-form-error')).toBeInTheDocument();
  });
});
