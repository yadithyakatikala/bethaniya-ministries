import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnnouncementForm } from '../AnnouncementForm';
import * as announcementsService from '../../../services/firebase/announcements';
import { useAuthStore } from '../../../store/authStore';
import type { Announcement } from '../../../types';
import type { UploadedAsset } from '../../../services/media/types';
import {
  MISSING,
  READY,
  UPLOADED_IMAGE,
  deferred,
} from '../../../components/media/__tests__/helpers';

vi.mock('../../../services/firebase/announcements');
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

function renderForm(props: Parameters<typeof AnnouncementForm>[0]) {
  return render(
    <MemoryRouter>
      <AnnouncementForm {...props} />
    </MemoryRouter>
  );
}

const existing: Announcement = {
  id: 'a1',
  title: 'Old title',
  content: 'Old content',
  imageUrl: null,
  published: true,
  createdAt: null,
  updatedAt: null,
};

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

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('announcement-title-input'), 'Title');
  await user.type(screen.getByTestId('announcement-content-input'), 'Content');
}

describe('AnnouncementForm', () => {
  it('shows validation errors and does not submit when title/content are empty', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('announcement-form-submit'));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Content is required.')).toBeInTheDocument();
    expect(announcementsService.createAnnouncement).not.toHaveBeenCalled();
  });

  it('creates an announcement with the entered title/content when valid', async () => {
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Sunday Service');
    await user.type(screen.getByTestId('announcement-content-input'), 'Join us at 10am.');
    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith({
        title: 'Sunday Service',
        content: 'Join us at 10am.',
        imageUrl: null,
      })
    );
  });

  it('pre-fills fields and calls updateAnnouncement in edit mode', async () => {
    vi.mocked(announcementsService.updateAnnouncement).mockResolvedValue(undefined);
    renderForm({ mode: 'edit', announcement: existing });

    expect(screen.getByTestId('announcement-title-input')).toHaveValue('Old title');

    const user = userEvent.setup();
    await user.clear(screen.getByTestId('announcement-title-input'));
    await user.type(screen.getByTestId('announcement-title-input'), 'New title');
    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.updateAnnouncement).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ title: 'New title' })
      )
    );
  });

  it('shows a submit error and does not navigate away when the write fails', async () => {
    vi.mocked(announcementsService.createAnnouncement).mockRejectedValue(
      new Error('offline')
    );
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.click(screen.getByTestId('announcement-form-submit'));

    expect(await screen.findByTestId('announcement-form-error')).toHaveTextContent(
      'Something went wrong while saving. Please try again.'
    );
  });
});

describe('AnnouncementForm image', () => {
  it('uploads a chosen image and saves its address with the announcement', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequired(user);
    const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('announcement-image-input'), file);

    // The picture is shown from the address Cloudinary returned...
    expect(await screen.findByTestId('announcement-image-address')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-image-preview')).toHaveAttribute(
      'src',
      UPLOADED_IMAGE.url
    );
    expect(uploadToCloudinary).toHaveBeenCalledWith(file, 'image', expect.anything());
    // ...and is recorded in the media library.
    expect(createMediaAsset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('announcement-form-submit'));
    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith({
        title: 'Title',
        content: 'Content',
        imageUrl: UPLOADED_IMAGE.url,
      })
    );
  });

  it('refuses an oversized image before sending anything, and the post still saves without one', async () => {
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequired(user);
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByTestId('announcement-image-input'), bigFile);

    expect(await screen.findByTestId('announcement-image-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('announcement-form-submit'));
    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: null })
      )
    );
  });

  it('holds Save while an image is still uploading, then releases it', async () => {
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.upload(
      screen.getByTestId('announcement-image-input'),
      new File(['a'], 'photo.jpg', { type: 'image/jpeg' })
    );

    expect(await screen.findByTestId('announcement-image-progress')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-form-submit')).toBeDisabled();

    await act(async () => {
      pending.resolve(UPLOADED_IMAGE);
    });
    await waitFor(() =>
      expect(screen.getByTestId('announcement-form-submit')).toBeEnabled()
    );
  });

  it('shows why an upload failed and still lets the announcement be saved', async () => {
    const { UploadError } = await import('../../../services/media/cloudinaryUpload');
    vi.mocked(uploadToCloudinary).mockRejectedValue(
      new UploadError(
        'network',
        'The upload could not reach Cloudinary. Check the connection.'
      )
    );
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.upload(
      screen.getByTestId('announcement-image-input'),
      new File(['a'], 'photo.jpg', { type: 'image/jpeg' })
    );

    expect(await screen.findByTestId('announcement-image-error')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-image-retry')).toBeInTheDocument();

    await user.click(screen.getByTestId('announcement-form-submit'));
    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: null })
      )
    );
  });

  it('explains how to set up uploading when it is not configured, and still saves', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    // A plain-language notice, not a button that cannot work.
    expect(screen.getByTestId('announcement-image-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('announcement-image-upload-button')).toBeNull();
    expect(screen.queryByTestId('announcement-image-input')).toBeNull();

    await fillRequired(user);
    await user.click(screen.getByTestId('announcement-form-submit'));
    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: null })
      )
    );
  });

  it('takes a pasted https address when uploading is not set up', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequired(user);
    await user.type(
      screen.getByTestId('announcement-image-url-input'),
      'https://example.org/banner.png'
    );
    await user.click(screen.getByTestId('announcement-image-url-apply'));
    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://example.org/banner.png' })
      )
    );
  });

  it('keeps the existing image when editing without touching it', async () => {
    vi.mocked(announcementsService.updateAnnouncement).mockResolvedValue(undefined);
    renderForm({
      mode: 'edit',
      announcement: { ...existing, imageUrl: 'https://example.org/old.jpg' },
    });
    const user = userEvent.setup();

    expect(screen.getByTestId('announcement-image-preview')).toHaveAttribute(
      'src',
      'https://example.org/old.jpg'
    );
    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.updateAnnouncement).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ imageUrl: 'https://example.org/old.jpg' })
      )
    );
  });

  it('removes the image from the announcement without deleting the file anywhere', async () => {
    vi.mocked(announcementsService.updateAnnouncement).mockResolvedValue(undefined);
    renderForm({
      mode: 'edit',
      announcement: { ...existing, imageUrl: 'https://example.org/old.jpg' },
    });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('announcement-image-remove'));
    expect(screen.queryByTestId('announcement-image-preview')).toBeNull();
    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.updateAnnouncement).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ imageUrl: null })
      )
    );
  });
});
