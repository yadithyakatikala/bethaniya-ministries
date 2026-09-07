import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnnouncementsListPage } from '../AnnouncementsListPage';
import { useAuthStore } from '../../../store/authStore';
import * as announcementsService from '../../../services/firebase/announcements';
import type { Announcement } from '../../../types';

vi.mock('../../../services/firebase/announcements');

function renderPage() {
  return render(
    <MemoryRouter>
      <AnnouncementsListPage />
    </MemoryRouter>
  );
}

const SAMPLE: Announcement = {
  id: 'a1',
  title: 'Sunday Service',
  content: 'Join us at 10am.',
  imageUrl: null,
  published: false,
  createdAt: null,
  updatedAt: null,
};

describe('AnnouncementsListPage', () => {
  afterEach(() => {
    vi.mocked(announcementsService.subscribeToAnnouncements).mockReset();
  });

  it('shows a loading state before the first snapshot arrives', () => {
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('announcements-loading')).toBeInTheDocument();
  });

  it('shows an empty state when there are no announcements', async () => {
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(
      (onNext) => {
        onNext([]);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('announcements-empty')).toBeInTheDocument()
    );
  });

  it('shows an error state when the subscription fails', async () => {
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'permission-denied' } as never);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('announcements-error')).toBeInTheDocument()
    );
  });

  it('renders announcements and hides management actions for a Host', async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(
      (onNext) => {
        onNext([SAMPLE]);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Sunday Service')).toBeInTheDocument());
    expect(screen.queryByTestId('new-announcement-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-announcement-a1')).not.toBeInTheDocument();
  });

  it('shows management actions for a Content Admin', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(
      (onNext) => {
        onNext([SAMPLE]);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('new-announcement-button')).toBeInTheDocument()
    );
    expect(screen.getByTestId('delete-announcement-a1')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-published-a1')).toHaveTextContent('Publish');
  });

  it('toggles publish state when the publish button is clicked', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(
      (onNext) => {
        onNext([SAMPLE]);
        return vi.fn();
      }
    );
    vi.mocked(announcementsService.setAnnouncementPublished).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId('toggle-published-a1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('toggle-published-a1'));
    await waitFor(() =>
      expect(announcementsService.setAnnouncementPublished).toHaveBeenCalledWith(
        'a1',
        'Sunday Service',
        true
      )
    );
  });

  it('deletes an announcement only after confirming the dialog', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(announcementsService.subscribeToAnnouncements).mockImplementation(
      (onNext) => {
        onNext([SAMPLE]);
        return vi.fn();
      }
    );
    vi.mocked(announcementsService.deleteAnnouncement).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId('delete-announcement-a1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('delete-announcement-a1'));
    expect(announcementsService.deleteAnnouncement).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() =>
      expect(announcementsService.deleteAnnouncement).toHaveBeenCalledWith(
        'a1',
        'Sunday Service'
      )
    );
  });
});
