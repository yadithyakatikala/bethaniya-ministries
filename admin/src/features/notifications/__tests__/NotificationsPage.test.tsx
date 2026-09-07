import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsPage } from '../NotificationsPage';
import { useAuthStore } from '../../../store/authStore';
import * as notificationsService from '../../../services/firebase/notifications';
import type { NotificationLogEntry } from '../../../types';

vi.mock('../../../services/firebase/notifications');

function renderPage() {
  return render(<NotificationsPage />);
}

const SAMPLE_ENTRY: NotificationLogEntry = {
  id: 'n1',
  title: 'Sunday Service Reminder',
  message: 'Join us at 10am.',
  imageUrl: null,
  recipientGroup: 'all_members',
  recipientCount: 42,
  sentBy: 'uid-1',
  sentByEmail: 'admin@example.com',
  sentAt: new Date('2026-01-01T00:00:00Z'),
};

describe('NotificationsPage', () => {
  afterEach(() => {
    vi.mocked(notificationsService.subscribeToNotificationLog).mockReset();
    vi.mocked(notificationsService.estimateRecipientCount).mockReset();
    vi.mocked(notificationsService.sendNotification).mockReset();
  });

  it('shows an unauthorized message for a member', () => {
    useAuthStore.setState({ role: 'member' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('notifications-unauthorized')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-form-submit')).not.toBeInTheDocument();
  });

  it('shows the composer for a host, without the image field', () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('notification-form-submit')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-image-input')).not.toBeInTheDocument();
  });

  it('shows the composer with the image field for a content_admin', () => {
    useAuthStore.setState({ role: 'content_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('notification-form-submit')).toBeInTheDocument();
    expect(screen.getByTestId('notification-image-input')).toBeInTheDocument();
  });

  it('shows validation errors and does not open the confirmation dialog when title/message are empty', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('notification-form-submit'));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Message is required.')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-send-button')).not.toBeInTheDocument();
  });

  it('opens the confirmation dialog with a recipient count preview when available', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    vi.mocked(notificationsService.estimateRecipientCount).mockResolvedValue(10);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('notification-title-input'), 'Title');
    await user.type(screen.getByTestId('notification-message-input'), 'Message');
    await user.click(screen.getByTestId('notification-form-submit'));

    expect(await screen.findByTestId('recipient-count-preview')).toHaveTextContent(
      '10 recipients'
    );
    expect(notificationsService.estimateRecipientCount).toHaveBeenCalledWith(
      'all_members'
    );
  });

  it("shows a 'not available' message in the dialog when the count preview is null (e.g. a Host caller)", async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    vi.mocked(notificationsService.estimateRecipientCount).mockResolvedValue(null);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('notification-title-input'), 'Title');
    await user.type(screen.getByTestId('notification-message-input'), 'Message');
    await user.click(screen.getByTestId('notification-form-submit'));

    expect(await screen.findByTestId('recipient-count-unavailable')).toBeInTheDocument();
  });

  it('sends the notification and shows a success message on confirm', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    vi.mocked(notificationsService.estimateRecipientCount).mockResolvedValue(5);
    vi.mocked(notificationsService.sendNotification).mockResolvedValue({
      recipientCount: 5,
    });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('notification-title-input'), 'Sunday Reminder');
    await user.type(screen.getByTestId('notification-message-input'), 'See you Sunday.');
    await user.click(screen.getByTestId('notification-form-submit'));
    await screen.findByTestId('confirm-send-button');
    await user.click(screen.getByTestId('confirm-send-button'));

    await waitFor(() =>
      expect(notificationsService.sendNotification).toHaveBeenCalledWith({
        title: 'Sunday Reminder',
        message: 'See you Sunday.',
        imageUrl: null,
        recipientGroup: 'all_members',
      })
    );
    expect(await screen.findByTestId('notification-form-success')).toHaveTextContent(
      '5 recipients'
    );
  });

  it('shows an error alert when sendNotification fails', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    vi.mocked(notificationsService.estimateRecipientCount).mockResolvedValue(5);
    vi.mocked(notificationsService.sendNotification).mockRejectedValue(
      new Error('functions emulator unreachable')
    );
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('notification-title-input'), 'Title');
    await user.type(screen.getByTestId('notification-message-input'), 'Message');
    await user.click(screen.getByTestId('notification-form-submit'));
    await screen.findByTestId('confirm-send-button');
    await user.click(screen.getByTestId('confirm-send-button'));

    expect(await screen.findByTestId('notification-form-error')).toBeInTheDocument();
  });

  it('shows a loading state before the first log snapshot arrives', () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('notification-log-loading')).toBeInTheDocument();
  });

  it('shows an empty state when no notifications have been sent', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(
      (onNext) => {
        onNext([]);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('notification-log-empty')).toBeInTheDocument()
    );
  });

  it('renders past notifications in the log', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(
      (onNext) => {
        onNext([SAMPLE_ENTRY]);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('notification-log-row-n1')).toBeInTheDocument()
    );
    expect(screen.getByText('Sunday Service Reminder')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows an error state when the log subscription fails', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'permission-denied' } as never);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('notification-log-error')).toBeInTheDocument()
    );
  });
});
