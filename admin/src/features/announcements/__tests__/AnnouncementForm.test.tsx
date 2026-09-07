import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnnouncementForm } from '../AnnouncementForm';
import * as announcementsService from '../../../services/firebase/announcements';
import type { Announcement } from '../../../types';

vi.mock('../../../services/firebase/announcements');

function renderForm(props: Parameters<typeof AnnouncementForm>[0]) {
  return render(
    <MemoryRouter>
      <AnnouncementForm {...props} />
    </MemoryRouter>
  );
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
    const existing: Announcement = {
      id: 'a1',
      title: 'Old title',
      content: 'Old content',
      imageUrl: null,
      published: true,
      createdAt: null,
      updatedAt: null,
    };
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

  it('uploads the selected image before creating the announcement', async () => {
    vi.mocked(announcementsService.uploadAnnouncementImage).mockResolvedValue(
      'https://example.com/uploaded.jpg'
    );
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-content-input'), 'Content');
    const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('announcement-image-input'), file);
    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.uploadAnnouncementImage).toHaveBeenCalledWith(file)
    );
    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://example.com/uploaded.jpg' })
      )
    );
  });

  it('shows an error and blocks upload for an oversized image, without calling createAnnouncement', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-content-input'), 'Content');
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByTestId('announcement-image-input'), bigFile);

    expect(await screen.findByTestId('announcement-image-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );

    await user.click(screen.getByTestId('announcement-form-submit'));
    expect(announcementsService.uploadAnnouncementImage).not.toHaveBeenCalled();
    expect(announcementsService.createAnnouncement).not.toHaveBeenCalled();
  });

  it('shows a submit error and does not navigate away when the write fails', async () => {
    vi.mocked(announcementsService.createAnnouncement).mockRejectedValue(
      new Error('offline')
    );
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Title');
    await user.type(screen.getByTestId('announcement-content-input'), 'Content');
    await user.click(screen.getByTestId('announcement-form-submit'));

    expect(await screen.findByTestId('announcement-form-error')).toBeInTheDocument();
  });
});
