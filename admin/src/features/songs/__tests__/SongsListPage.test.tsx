import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SongsListPage } from '../SongsListPage';
import { useAuthStore } from '../../../store/authStore';
import * as songsService from '../../../services/firebase/songs';
import type { Song } from '../../../types';

vi.mock('../../../services/firebase/songs');

function renderPage() {
  return render(
    <MemoryRouter>
      <SongsListPage />
    </MemoryRouter>
  );
}

const SAMPLE: Song = {
  id: 's1',
  title: 'Amazing Grace',
  artist: 'Traditional',
  category: 'Hymn',
  lyrics: 'Amazing grace, how sweet the sound',
  audioUrl: 'https://example.com/amazing-grace.mp3',
  coverUrl: null,
  published: false,
  createdAt: null,
  updatedAt: null,
};

describe('SongsListPage', () => {
  afterEach(() => {
    vi.mocked(songsService.subscribeToSongs).mockReset();
  });

  it('shows a loading state before the first snapshot arrives', () => {
    vi.mocked(songsService.subscribeToSongs).mockImplementation(() => vi.fn());
    renderPage();
    expect(screen.getByTestId('songs-loading')).toBeInTheDocument();
  });

  it('shows an empty state when there are no songs', async () => {
    vi.mocked(songsService.subscribeToSongs).mockImplementation((onNext) => {
      onNext([]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('songs-empty')).toBeInTheDocument());
  });

  it('shows an error state when the subscription fails', async () => {
    vi.mocked(songsService.subscribeToSongs).mockImplementation((_onNext, onError) => {
      onError({ code: 'permission-denied' } as never);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('songs-error')).toBeInTheDocument());
  });

  it('renders songs and hides management actions for a Host', async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(songsService.subscribeToSongs).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Amazing Grace')).toBeInTheDocument());
    expect(screen.queryByTestId('new-song-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-song-s1')).not.toBeInTheDocument();
  });

  it('shows management actions for a Content Admin', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    vi.mocked(songsService.subscribeToSongs).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('new-song-button')).toBeInTheDocument()
    );
    expect(screen.getByTestId('delete-song-s1')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-published-s1')).toHaveTextContent('Publish');
  });

  it('toggles publish state when the publish button is clicked', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(songsService.subscribeToSongs).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    vi.mocked(songsService.setSongPublished).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId('toggle-published-s1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('toggle-published-s1'));
    await waitFor(() =>
      expect(songsService.setSongPublished).toHaveBeenCalledWith(
        's1',
        'Amazing Grace',
        true
      )
    );
  });

  it('deletes a song only after confirming the dialog', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(songsService.subscribeToSongs).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    vi.mocked(songsService.deleteSong).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId('delete-song-s1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-song-s1'));
    expect(songsService.deleteSong).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() =>
      expect(songsService.deleteSong).toHaveBeenCalledWith('s1', 'Amazing Grace')
    );
  });
});
