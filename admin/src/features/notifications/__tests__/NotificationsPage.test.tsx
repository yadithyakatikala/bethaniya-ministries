import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { NotificationsPage } from '../NotificationsPage';
import { useAuthStore } from '../../../store/authStore';
import * as notificationsService from '../../../services/firebase/notifications';
import type { NotificationLogEntry } from '../../../types';
import type { UploadedAsset } from '../../../services/media/types';
import {
  MISSING,
  READY,
  UPLOADED_IMAGE,
  deferred,
} from '../../../components/media/__tests__/helpers';

vi.mock('../../../services/firebase/notifications');
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
import {
  UploadError,
  uploadToCloudinary,
} from '../../../services/media/cloudinaryUpload';
import {
  createMediaAsset,
  subscribeToMediaAssets,
} from '../../../services/firebase/mediaAssets';

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
  beforeEach(() => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
    vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
    vi.mocked(createMediaAsset).mockResolvedValue('asset-1');
    vi.mocked(uploadToCloudinary).mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:local-preview');
    URL.revokeObjectURL = vi.fn();
  });

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

  // --- The optional image, and the failures a send can still have ------
  // The image is uploaded by <ImageField> as soon as it is chosen, so by
  // the time Send is pressed it is just an address. What can still go
  // wrong at Send is the callable, which is unavailable on the Spark plan.

  /** Chooses an image and waits for the upload to finish. */
  async function attachImage(user: ReturnType<typeof userEvent.setup>) {
    await user.upload(
      screen.getByTestId('notification-image-input'),
      new File(['x'], 'banner.png', { type: 'image/png' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('notification-image-preview')).toHaveAttribute(
        'src',
        UPLOADED_IMAGE.url
      )
    );
  }

  /** Drives the form through to the confirmation dialog's Send button. */
  async function submitWithImage(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByTestId('notification-title-input'), 'Title');
    await user.type(screen.getByTestId('notification-message-input'), 'Message');
    await attachImage(user);
    await user.click(screen.getByTestId('notification-form-submit'));
    await user.click(await screen.findByTestId('confirm-send-button'));
  }

  function asContentAdmin() {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(notificationsService.subscribeToNotificationLog).mockImplementation(() =>
      vi.fn()
    );
    vi.mocked(notificationsService.estimateRecipientCount).mockResolvedValue(5);
  }

  it('sends the address of the uploaded image with the notification', async () => {
    asContentAdmin();
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    vi.mocked(notificationsService.sendNotification).mockResolvedValue({
      recipientCount: 5,
    } as never);
    renderPage();

    await submitWithImage(userEvent.setup());

    await waitFor(() =>
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: UPLOADED_IMAGE.url })
      )
    );
    // And the composer is cleared for the next one, image included.
    await waitFor(() =>
      expect(screen.queryByTestId('notification-image-preview')).not.toBeInTheDocument()
    );
  });

  it('can still send when no image is attached', async () => {
    asContentAdmin();
    vi.mocked(notificationsService.sendNotification).mockResolvedValue({
      recipientCount: 5,
    } as never);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('notification-title-input'), 'Title');
    await user.type(screen.getByTestId('notification-message-input'), 'Message');
    await user.click(screen.getByTestId('notification-form-submit'));
    await user.click(await screen.findByTestId('confirm-send-button'));

    await waitFor(() =>
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: null })
      )
    );
  });

  it('shows why an image upload failed and does not block sending without it', async () => {
    asContentAdmin();
    vi.mocked(uploadToCloudinary).mockRejectedValue(
      new UploadError('network', 'The upload could not reach Cloudinary.')
    );
    renderPage();
    const user = userEvent.setup();

    await user.upload(
      screen.getByTestId('notification-image-input'),
      new File(['x'], 'banner.png', { type: 'image/png' })
    );

    expect(await screen.findByTestId('notification-image-error')).toHaveTextContent(
      'The upload could not reach Cloudinary.'
    );
    expect(screen.getByTestId('notification-form-submit')).toBeEnabled();
  });

  it('holds Send while the image is still uploading', async () => {
    asContentAdmin();
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    renderPage();
    const user = userEvent.setup();

    await user.upload(
      screen.getByTestId('notification-image-input'),
      new File(['x'], 'banner.png', { type: 'image/png' })
    );
    expect(await screen.findByTestId('notification-image-progress')).toBeInTheDocument();
    expect(screen.getByTestId('notification-form-submit')).toBeDisabled();

    await act(async () => {
      pending.resolve(UPLOADED_IMAGE);
    });
    await waitFor(() =>
      expect(screen.getByTestId('notification-form-submit')).toBeEnabled()
    );
  });

  it('explains that image uploading is not set up, without blocking the composer', () => {
    asContentAdmin();
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderPage();

    expect(screen.getByTestId('notification-image-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-image-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('notification-form-submit')).toBeEnabled();
  });

  it('still reports the Blaze-gated send limitation when an image was attached', async () => {
    // Regression guard: the send failure must be named for what it is,
    // retry advice included, whether or not a picture is attached.
    asContentAdmin();
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    vi.mocked(notificationsService.sendNotification).mockRejectedValue(
      new notificationsService.CloudFunctionsUnavailableError()
    );
    renderPage();

    await submitWithImage(userEvent.setup());

    const error = await screen.findByTestId('notification-form-error');
    expect(error).toHaveTextContent(/Sending is unavailable/);
    expect(error).toHaveTextContent(/retrying will not help/);
  });

  it('offers a retry for a send failure that is not the Blaze limitation', async () => {
    asContentAdmin();
    vi.mocked(notificationsService.sendNotification).mockRejectedValue(
      new Error('network')
    );
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('notification-title-input'), 'Title');
    await user.type(screen.getByTestId('notification-message-input'), 'Message');
    await user.click(screen.getByTestId('notification-form-submit'));
    await user.click(await screen.findByTestId('confirm-send-button'));

    const error = await screen.findByTestId('notification-form-error');
    expect(error).toHaveTextContent(/please try again/i);
    expect(error).not.toHaveTextContent(/Sending is unavailable/);
  });
});
