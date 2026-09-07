import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SongForm } from '../SongForm';
import * as songsService from '../../../services/firebase/songs';
import type { Song } from '../../../types';

vi.mock('../../../services/firebase/songs');

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

  it('uploads the selected cover image before creating the song', async () => {
    vi.mocked(songsService.uploadSongCoverImage).mockResolvedValue(
      'https://example.com/uploaded.jpg'
    );
    vi.mocked(songsService.createSong).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    const file = new File(['a'], 'cover.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('song-cover-input'), file);
    await user.click(screen.getByTestId('song-form-submit'));

    await waitFor(() =>
      expect(songsService.uploadSongCoverImage).toHaveBeenCalledWith(file)
    );
    await waitFor(() =>
      expect(songsService.createSong).toHaveBeenCalledWith(
        expect.objectContaining({ coverUrl: 'https://example.com/uploaded.jpg' })
      )
    );
  });

  it('shows an error and blocks upload for an oversized cover image, without calling createSong', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByTestId('song-cover-input'), bigFile);

    expect(await screen.findByTestId('song-cover-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );

    await user.click(screen.getByTestId('song-form-submit'));
    expect(songsService.uploadSongCoverImage).not.toHaveBeenCalled();
    expect(songsService.createSong).not.toHaveBeenCalled();
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
