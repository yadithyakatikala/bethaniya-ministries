import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MediaListPage } from '../MediaListPage';
import { useAuthStore } from '../../../store/authStore';
import * as service from '../../../services/firebase/media';
import type { MediaRecord } from '../../../services/firebase/media';

vi.mock('../../../services/firebase/media');

/**
 * The media list: its states, its RBAC, and the two things it exists to
 * make visible -- whether a post is actually reaching the congregation,
 * and whether its link will work when it does.
 */
function renderPage() {
  return render(
    <MemoryRouter>
      <MediaListPage />
    </MemoryRouter>
  );
}

function record(partial: Partial<MediaRecord> = {}): MediaRecord {
  return {
    id: 'm1',
    type: 'image',
    mediaUrl: 'https://example.org/photo.jpg',
    caption: 'Sunday worship',
    verseReference: null,
    verseText: null,
    published: true,
    publishAt: new Date('2020-01-01T06:00:00.000Z'),
    authorName: 'Pastor',
    authorUid: 'admin-1',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

function withRecords(records: MediaRecord[]) {
  vi.mocked(service.subscribeToMedia).mockImplementation((onNext) => {
    onNext(records);
    return vi.fn();
  });
}

afterEach(() => {
  vi.mocked(service.subscribeToMedia).mockReset();
  vi.mocked(service.setMediaPublished).mockReset();
  vi.mocked(service.deleteMediaPost).mockReset();
  useAuthStore.setState({ role: 'super_admin' });
});

describe('the states an administrator can see', () => {
  it('shows a loading state before the first snapshot', () => {
    vi.mocked(service.subscribeToMedia).mockImplementation(() => vi.fn());
    renderPage();
    expect(screen.getByTestId('media-loading')).toBeInTheDocument();
  });

  it('says so when nothing has been posted', () => {
    withRecords([]);
    renderPage();
    expect(screen.getByTestId('media-empty')).toBeInTheDocument();
  });

  it('shows an error when the list could not be read', () => {
    vi.mocked(service.subscribeToMedia).mockImplementation((_onNext, onError) => {
      onError({ code: 'unavailable' } as never);
      return vi.fn();
    });
    renderPage();
    expect(screen.getByTestId('media-error')).toBeInTheDocument();
  });

  it('NAMES draft, scheduled and published, because two of them look the same to a member', () => {
    withRecords([
      record({ id: 'draft', published: false }),
      record({
        id: 'later',
        published: true,
        publishAt: new Date('2099-01-01T00:00:00.000Z'),
      }),
      record({ id: 'live', published: true }),
    ]);
    renderPage();

    expect(screen.getByTestId('media-state-draft')).toHaveTextContent('Draft');
    expect(screen.getByTestId('media-state-later')).toHaveTextContent('Scheduled');
    expect(screen.getByTestId('media-state-live')).toHaveTextContent('Published');
  });

  it('flags a link the app will not load, even on a published post', () => {
    // A rotted or http link is a post that looks fine here and shows a
    // broken image to the whole congregation.
    withRecords([
      record({ id: 'bad', mediaUrl: 'http://example.org/photo.jpg' }),
      record({ id: 'good' }),
    ]);
    renderPage();

    expect(screen.getByTestId('media-url-problem-bad')).toBeInTheDocument();
    expect(screen.queryByTestId('media-url-problem-good')).not.toBeInTheDocument();
  });
});

describe('managing posts', () => {
  it('publishes an unpublished post', async () => {
    vi.mocked(service.setMediaPublished).mockResolvedValue(undefined);
    withRecords([record({ id: 'draft', published: false })]);
    renderPage();

    await userEvent.click(screen.getByTestId('media-toggle-draft'));

    await waitFor(() =>
      expect(service.setMediaPublished).toHaveBeenCalledWith(
        'draft',
        'Sunday worship',
        true
      )
    );
  });

  it('unpublishes a published one', async () => {
    vi.mocked(service.setMediaPublished).mockResolvedValue(undefined);
    withRecords([record({ id: 'live', published: true })]);
    renderPage();

    await userEvent.click(screen.getByTestId('media-toggle-live'));

    await waitFor(() =>
      expect(service.setMediaPublished).toHaveBeenCalledWith(
        'live',
        'Sunday worship',
        false
      )
    );
  });

  it('asks before deleting, and says that comments go with it', async () => {
    vi.mocked(service.deleteMediaPost).mockResolvedValue(undefined);
    withRecords([record()]);
    renderPage();

    await userEvent.click(screen.getByTestId('delete-media-m1'));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByText(/Comments on it are deleted with it/i)).toBeInTheDocument();
    // Not deleted until confirmed.
    expect(service.deleteMediaPost).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('media-confirm-delete'));
    await waitFor(() =>
      expect(service.deleteMediaPost).toHaveBeenCalledWith('m1', 'Sunday worship')
    );
  });

  it('says so when an action fails, rather than appearing to work', async () => {
    vi.mocked(service.setMediaPublished).mockRejectedValue(new Error('denied'));
    withRecords([record({ published: false })]);
    renderPage();

    await userEvent.click(screen.getByTestId('media-toggle-m1'));

    await waitFor(() =>
      expect(screen.getByTestId('media-action-error')).toBeInTheDocument()
    );
  });
});

describe('who may manage media', () => {
  it('lets a content admin create, publish, edit and delete', () => {
    useAuthStore.setState({ role: 'content_admin' });
    withRecords([record()]);
    renderPage();

    expect(screen.getByTestId('new-media-button')).toBeInTheDocument();
    expect(screen.getByTestId('media-toggle-m1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-media-m1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-media-m1')).toBeInTheDocument();
  });

  it('shows a host and a member the list WITHOUT the actions', () => {
    // Media is content, so it is a content admin's job -- the same split
    // announcements and community already use. The rules are the real
    // boundary; this is the part that stops an unusable button existing.
    for (const role of ['host', 'member'] as const) {
      useAuthStore.setState({ role });
      withRecords([record()]);
      const view = renderPage();

      expect(screen.getByTestId('media-row-m1')).toBeInTheDocument();
      expect(screen.queryByTestId('new-media-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('media-toggle-m1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-media-m1')).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
