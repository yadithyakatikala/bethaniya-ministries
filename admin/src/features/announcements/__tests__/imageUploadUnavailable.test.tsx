/**
 * Storage-unavailable handling for all six admin optional-image upload
 * paths, in one place.
 *
 * WHAT THIS PINS. Firebase projects created after October 2024 have no
 * default Cloud Storage bucket until the project is on the Blaze plan, and
 * this project deliberately stays on Spark -- so every image upload fails
 * permanently. Each of these six forms wraps the optional upload and the
 * Firestore write in ONE try/catch and used to report any failure as
 * "Something went wrong while saving. Please try again.", which was wrong
 * about what failed (the upload throws before the write), invited a retry
 * that cannot succeed, and told the one person who can fix it nothing.
 *
 * See ../../../services/firebase/storageErrors.ts. Its own unit tests
 * cover the classification; these cover the wiring in each form, which is
 * the part that was actually missing.
 *
 * Lives under announcements/__tests__ rather than being split six ways
 * because it is one behaviour with six call sites: keeping it together is
 * what makes a future seventh upload path obviously missing from the list.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { AnnouncementForm } from '../AnnouncementForm';
import { SongForm } from '../../songs/SongForm';
import { PlanForm } from '../../plans/PlanForm';
import { CommunityPostForm } from '../../community/CommunityPostForm';
import { DailyVerseForm } from '../../daily-verses/DailyVerseForm';

import * as announcementsService from '../../../services/firebase/announcements';
import * as songsService from '../../../services/firebase/songs';
import * as plansService from '../../../services/firebase/plans';
import * as communityService from '../../../services/firebase/communityPosts';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import { IMAGE_UPLOAD_UNAVAILABLE_MESSAGE } from '../../../services/firebase/storageErrors';

vi.mock('../../../services/firebase/announcements');
vi.mock('../../../services/firebase/songs');
vi.mock('../../../services/firebase/plans');
vi.mock('../../../services/firebase/communityPosts');
vi.mock('../../../services/firebase/dailyVerses');

/** What the Storage SDK reports for a bucket that does not exist. */
const BUCKET_MISSING = { code: 'storage/unknown' };

function pngFile() {
  return new File(['x'], 'cover.png', { type: 'image/png' });
}

function renderIn(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin image upload when Cloud Storage is unavailable', () => {
  it('announcements: reports the accurate cause and does not attempt the write', async () => {
    vi.mocked(announcementsService.uploadAnnouncementImage).mockRejectedValue(
      BUCKET_MISSING
    );
    renderIn(<AnnouncementForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Sunday Service');
    await user.type(screen.getByTestId('announcement-content-input'), 'Join us at 10am.');
    await user.upload(screen.getByTestId('announcement-image-input'), pngFile());
    await user.click(screen.getByTestId('announcement-form-submit'));

    const error = await screen.findByTestId('announcement-form-error');
    expect(error).toHaveTextContent(IMAGE_UPLOAD_UNAVAILABLE_MESSAGE);
    // The upload throws first, so the content write must not have run.
    expect(announcementsService.createAnnouncement).not.toHaveBeenCalled();
  });

  it('announcements: a second submit then saves the content without an image', async () => {
    // The whole point of clearing the selection: the operator is not stuck.
    vi.mocked(announcementsService.uploadAnnouncementImage).mockRejectedValue(
      BUCKET_MISSING
    );
    vi.mocked(announcementsService.createAnnouncement).mockResolvedValue('new-id');
    renderIn(<AnnouncementForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Sunday Service');
    await user.type(screen.getByTestId('announcement-content-input'), 'Join us at 10am.');
    await user.upload(screen.getByTestId('announcement-image-input'), pngFile());
    await user.click(screen.getByTestId('announcement-form-submit'));
    await screen.findByTestId('announcement-form-error');

    await user.click(screen.getByTestId('announcement-form-submit'));

    await waitFor(() =>
      expect(announcementsService.createAnnouncement).toHaveBeenCalledWith({
        title: 'Sunday Service',
        content: 'Join us at 10am.',
        imageUrl: null,
      })
    );
    // And it did not try the doomed upload a second time.
    expect(announcementsService.uploadAnnouncementImage).toHaveBeenCalledTimes(1);
  });

  it('songs: reports the accurate cause and does not attempt the write', async () => {
    vi.mocked(songsService.uploadSongCoverImage).mockRejectedValue(BUCKET_MISSING);
    renderIn(<SongForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('song-title-input'), 'Amazing Grace');
    await user.type(screen.getByTestId('song-artist-input'), 'Traditional');
    await user.type(screen.getByTestId('song-category-input'), 'Hymn');
    await user.type(screen.getByTestId('song-lyrics-input'), 'Amazing grace...');
    await user.type(
      screen.getByTestId('song-audio-url-input'),
      'https://example.com/a.mp3'
    );
    await user.upload(screen.getByTestId('song-cover-input'), pngFile());
    await user.click(screen.getByTestId('song-form-submit'));

    const error = await screen.findByTestId('song-form-error');
    expect(error).toHaveTextContent(IMAGE_UPLOAD_UNAVAILABLE_MESSAGE);
    expect(songsService.createSong).not.toHaveBeenCalled();
  });

  it('plans: reports the accurate cause and does not attempt the write', async () => {
    vi.mocked(plansService.uploadPlanCoverImage).mockRejectedValue(BUCKET_MISSING);
    renderIn(<PlanForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('plan-title-input'), '7 Days in Psalms');
    await user.type(screen.getByTestId('plan-description-input'), 'A week of psalms.');
    await user.type(screen.getByTestId('plan-category-input'), 'Devotional');
    await user.upload(screen.getByTestId('plan-cover-image-input'), pngFile());
    await user.click(screen.getByTestId('plan-form-submit'));

    const error = await screen.findByTestId('plan-form-error');
    expect(error).toHaveTextContent(IMAGE_UPLOAD_UNAVAILABLE_MESSAGE);
    expect(plansService.createPlan).not.toHaveBeenCalled();
  });

  it('community posts: reports the accurate cause and does not attempt the write', async () => {
    vi.mocked(communityService.uploadCommunityPostImage).mockRejectedValue(
      BUCKET_MISSING
    );
    renderIn(<CommunityPostForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('community-post-title-input'), 'Youth Camp');
    await user.type(
      screen.getByTestId('community-post-content-input'),
      'Sign up by Friday.'
    );
    await user.upload(screen.getByTestId('community-post-image-input'), pngFile());
    await user.click(screen.getByTestId('community-post-form-submit'));

    const error = await screen.findByTestId('community-post-form-error');
    expect(error).toHaveTextContent(IMAGE_UPLOAD_UNAVAILABLE_MESSAGE);
    expect(communityService.createCommunityPost).not.toHaveBeenCalled();
  });

  it('daily verses: reports the accurate cause and does not attempt the write', async () => {
    vi.mocked(dailyVersesService.uploadDailyVerseImage).mockRejectedValue(BUCKET_MISSING);
    renderIn(<DailyVerseForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('daily-verse-reference-input'), 'John 3:16');
    await user.type(screen.getByTestId('daily-verse-text-input'), 'For God so loved...');
    await user.type(screen.getByTestId('daily-verse-date-input'), '2026-09-16');
    await user.upload(screen.getByTestId('daily-verse-image-input'), pngFile());
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    const error = await screen.findByTestId('daily-verse-form-error');
    expect(error).toHaveTextContent(IMAGE_UPLOAD_UNAVAILABLE_MESSAGE);
    expect(dailyVersesService.createDailyVerse).not.toHaveBeenCalled();
  });

  it('a transient upload failure still offers a retry and keeps the image', async () => {
    // The opposite case: a real, retryable failure must NOT be relabelled.
    vi.mocked(announcementsService.uploadAnnouncementImage).mockRejectedValue({
      code: 'storage/retry-limit-exceeded',
    });
    renderIn(<AnnouncementForm mode="create" />);
    const user = userEvent.setup();

    await user.type(screen.getByTestId('announcement-title-input'), 'Sunday Service');
    await user.type(screen.getByTestId('announcement-content-input'), 'Join us at 10am.');
    await user.upload(screen.getByTestId('announcement-image-input'), pngFile());
    await user.click(screen.getByTestId('announcement-form-submit'));

    const error = await screen.findByTestId('announcement-form-error');
    expect(error).toHaveTextContent(/please try again/i);
    expect(error).not.toHaveTextContent(/Cloud Storage/);
  });
});
