import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EventsListPage } from '../EventsListPage';
import { useAuthStore } from '../../../store/authStore';
import * as eventsService from '../../../services/firebase/events';
import type { Event } from '../../../types';

vi.mock('../../../services/firebase/events');

function renderPage() {
  return render(
    <MemoryRouter>
      <EventsListPage />
    </MemoryRouter>
  );
}

const SAMPLE: Event = {
  id: 'e1',
  title: 'Sunday Service',
  location: '123 Main St',
  description: 'Weekly gathering',
  startsAt: new Date('2026-09-20T18:30:00'),
  published: false,
  isLive: false,
  youtubeUrl: '',
  createdAt: null,
  updatedAt: null,
};

describe('EventsListPage', () => {
  afterEach(() => {
    vi.mocked(eventsService.subscribeToEvents).mockReset();
  });

  it('shows a loading state before the first snapshot arrives', () => {
    vi.mocked(eventsService.subscribeToEvents).mockImplementation(() => vi.fn());
    renderPage();
    expect(screen.getByTestId('events-loading')).toBeInTheDocument();
  });

  it('shows an empty state when there are no events', async () => {
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('events-empty')).toBeInTheDocument());
  });

  it('shows an error state when the subscription fails', async () => {
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((_onNext, onError) => {
      onError({ code: 'permission-denied' } as never);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('events-error')).toBeInTheDocument());
  });

  it('shows the LIVE chip when isLive is true', async () => {
    useAuthStore.setState({ role: 'member' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([{ ...SAMPLE, isLive: true }]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('live-chip-e1')).toBeInTheDocument());
  });

  it('hides all management/live-stream actions for a Member', async () => {
    useAuthStore.setState({ role: 'member' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Sunday Service')).toBeInTheDocument());
    expect(screen.queryByTestId('new-event-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-event-e1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('live-stream-e1')).not.toBeInTheDocument();
  });

  it('gives a Host ONLY the Live Stream action, never CRUD/publish controls', async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('live-stream-e1')).toBeInTheDocument());
    expect(screen.queryByTestId('new-event-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-event-e1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-event-e1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toggle-published-e1')).not.toBeInTheDocument();
  });

  it('gives a Content Admin full CRUD/publish controls plus Live Stream', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('new-event-button')).toBeInTheDocument()
    );
    expect(screen.getByTestId('delete-event-e1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-event-e1')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-published-e1')).toHaveTextContent('Publish');
    expect(screen.getByTestId('live-stream-e1')).toBeInTheDocument();
  });

  it('toggles publish state when the publish button is clicked', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    vi.mocked(eventsService.setEventPublished).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId('toggle-published-e1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('toggle-published-e1'));
    await waitFor(() =>
      expect(eventsService.setEventPublished).toHaveBeenCalledWith(
        'e1',
        'Sunday Service',
        true
      )
    );
  });

  it('deletes an event only after confirming the dialog', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    vi.mocked(eventsService.deleteEvent).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId('delete-event-e1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('delete-event-e1'));
    expect(eventsService.deleteEvent).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() =>
      expect(eventsService.deleteEvent).toHaveBeenCalledWith('e1', 'Sunday Service')
    );
  });

  it('a Host can save a live stream URL and go live, sending ONLY isLive/youtubeUrl', async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    vi.mocked(eventsService.setEventLiveStream).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId('live-stream-e1')).toBeInTheDocument());
    await user.click(screen.getByTestId('live-stream-e1'));

    await user.type(
      screen.getByTestId('stream-url-input'),
      'https://youtu.be/dQw4w9WgXcQ'
    );
    await user.click(screen.getByTestId('toggle-live-button'));

    await waitFor(() =>
      expect(eventsService.setEventLiveStream).toHaveBeenCalledWith(
        'e1',
        'Sunday Service',
        {
          isLive: true,
          youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
        }
      )
    );
  });

  it('rejects a non-YouTube URL in the live stream dialog without calling the service', async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(eventsService.subscribeToEvents).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId('live-stream-e1')).toBeInTheDocument());
    await user.click(screen.getByTestId('live-stream-e1'));

    await user.type(
      screen.getByTestId('stream-url-input'),
      'https://example.com/not-youtube'
    );
    await user.click(screen.getByTestId('save-stream-url-button'));

    expect(eventsService.setEventLiveStream).not.toHaveBeenCalled();
  });
});
