/**
 * The upload fields, wired into every admin form that has a picture or a
 * song, checked in one place.
 *
 * WHAT THIS PINS. These forms used to upload to Firebase Storage inside
 * the same try/catch as the Firestore write. This project has no Storage
 * bucket (Spark plan), so every one of those uploads failed permanently --
 * and the forms either blamed the save or, later, explained the missing
 * bucket. Now each form uses <ImageField> / <AudioField>: the file goes to
 * Cloudinary, the field hands back an https address, and Save stores that
 * address like any other text. What each form must therefore do is the same
 * three things, so they are tested together:
 *
 *   1. an uploaded file's address is what gets saved;
 *   2. when uploading is not set up the form says so in plain words,
 *      offers no dead button, and still saves without the picture;
 *   3. Save waits for an upload in progress, rather than saving the old
 *      address while the new one is still on its way.
 *
 * One behaviour with many call sites: keeping the table together is what
 * makes a form that forgets the field obviously missing from it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

import { AnnouncementForm } from '../../../features/announcements/AnnouncementForm';
import { SongForm } from '../../../features/songs/SongForm';
import { PlanForm } from '../../../features/plans/PlanForm';
import { CommunityPostForm } from '../../../features/community/CommunityPostForm';
import { DailyVerseForm } from '../../../features/daily-verses/DailyVerseForm';

import * as announcementsService from '../../../services/firebase/announcements';
import * as songsService from '../../../services/firebase/songs';
import * as plansService from '../../../services/firebase/plans';
import * as communityService from '../../../services/firebase/communityPosts';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import { useAuthStore } from '../../../store/authStore';
import type { UploadedAsset } from '../../../services/media/types';
import { MISSING, READY, UPLOADED_AUDIO, UPLOADED_IMAGE, deferred } from './helpers';

vi.mock('../../../services/firebase/announcements');
vi.mock('../../../services/firebase/songs');
vi.mock('../../../services/firebase/plans');
vi.mock('../../../services/firebase/communityPosts');
vi.mock('../../../services/firebase/dailyVerses');
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

type User = ReturnType<typeof userEvent.setup>;

interface FormCase {
  name: string;
  element: ReactElement;
  /** Fill in everything the form requires apart from the picture. */
  fill: (user: User) => Promise<void>;
  /** The test-id prefix of the picture field. */
  prefix: string;
  submit: string;
  create: () => ReturnType<typeof vi.fn>;
  /** The saved field that holds the picture's address. */
  key: string;
}

const FORMS: FormCase[] = [
  {
    name: 'announcements',
    element: <AnnouncementForm mode="create" />,
    fill: async (user) => {
      await user.type(screen.getByTestId('announcement-title-input'), 'Sunday');
      await user.type(screen.getByTestId('announcement-content-input'), 'Join us.');
    },
    prefix: 'announcement-image',
    submit: 'announcement-form-submit',
    create: () => vi.mocked(announcementsService.createAnnouncement),
    key: 'imageUrl',
  },
  {
    name: 'community posts',
    element: <CommunityPostForm mode="create" />,
    fill: async (user) => {
      await user.type(screen.getByTestId('community-post-title-input'), 'Youth camp');
      await user.type(screen.getByTestId('community-post-content-input'), 'Sign up.');
    },
    prefix: 'community-post-image',
    submit: 'community-post-form-submit',
    create: () => vi.mocked(communityService.createCommunityPost),
    key: 'imageUrl',
  },
  {
    name: 'daily verses',
    element: <DailyVerseForm mode="create" />,
    fill: async (user) => {
      await user.type(screen.getByTestId('daily-verse-reference-input'), 'John 3:16');
      await user.type(screen.getByTestId('daily-verse-text-input'), 'For God so loved');
      await user.type(screen.getByTestId('daily-verse-date-input'), '2026-09-16');
    },
    prefix: 'daily-verse-image',
    submit: 'daily-verse-form-submit',
    create: () => vi.mocked(dailyVersesService.createDailyVerse),
    key: 'imageUrl',
  },
  {
    name: 'reading plans',
    element: <PlanForm mode="create" />,
    fill: async (user) => {
      await user.type(screen.getByTestId('plan-title-input'), 'Psalms');
      await user.type(screen.getByTestId('plan-description-input'), 'A week of psalms.');
      await user.type(screen.getByTestId('plan-category-input'), 'Devotional');
    },
    prefix: 'plan-cover-image',
    submit: 'plan-form-submit',
    create: () => vi.mocked(plansService.createPlan),
    key: 'coverImageUrl',
  },
  {
    name: 'song covers',
    element: <SongForm mode="create" />,
    fill: async (user) => {
      await user.type(screen.getByTestId('song-title-input'), 'Amazing Grace');
      await user.type(screen.getByTestId('song-artist-input'), 'Traditional');
      await user.type(screen.getByTestId('song-category-input'), 'Hymn');
      await user.type(screen.getByTestId('song-lyrics-input'), 'Amazing grace');
      await user.type(
        screen.getByTestId('song-audio-url-input'),
        'https://example.com/a.mp3'
      );
    },
    prefix: 'song-cover',
    submit: 'song-form-submit',
    create: () => vi.mocked(songsService.createSong),
    key: 'coverUrl',
  },
];

function renderIn(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

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

const photo = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

describe.each(FORMS)('$name form', (form) => {
  it('saves the address Cloudinary returned for the uploaded picture', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    form.create().mockResolvedValue('new-id');
    renderIn(form.element);
    const user = userEvent.setup();

    await form.fill(user);
    await user.upload(screen.getByTestId(`${form.prefix}-input`), photo());
    await waitFor(() =>
      expect(screen.getByTestId(`${form.prefix}-preview`)).toHaveAttribute(
        'src',
        UPLOADED_IMAGE.url
      )
    );
    await user.click(screen.getByTestId(form.submit));

    await waitFor(() =>
      expect(form.create()).toHaveBeenCalledWith(
        expect.objectContaining({ [form.key]: UPLOADED_IMAGE.url })
      )
    );
  });

  it('says uploading is not set up, offers no dead button, and saves without a picture', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    form.create().mockResolvedValue('new-id');
    renderIn(form.element);
    const user = userEvent.setup();

    expect(screen.getByTestId(`${form.prefix}-setup`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${form.prefix}-upload-button`)).toBeNull();
    expect(screen.queryByTestId(`${form.prefix}-input`)).toBeNull();

    await form.fill(user);
    await user.click(screen.getByTestId(form.submit));

    await waitFor(() =>
      expect(form.create()).toHaveBeenCalledWith(
        expect.objectContaining({ [form.key]: null })
      )
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('holds Save while the picture is still uploading', async () => {
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    form.create().mockResolvedValue('new-id');
    renderIn(form.element);
    const user = userEvent.setup();

    await form.fill(user);
    await user.upload(screen.getByTestId(`${form.prefix}-input`), photo());
    expect(await screen.findByTestId(`${form.prefix}-progress`)).toBeInTheDocument();
    expect(screen.getByTestId(form.submit)).toBeDisabled();

    await act(async () => {
      pending.resolve(UPLOADED_IMAGE);
    });
    await waitFor(() => expect(screen.getByTestId(form.submit)).toBeEnabled());
    expect(form.create()).not.toHaveBeenCalled();
  });
});

describe('song audio', () => {
  async function fillSong(user: User) {
    await user.type(screen.getByTestId('song-title-input'), 'Amazing Grace');
    await user.type(screen.getByTestId('song-artist-input'), 'Traditional');
    await user.type(screen.getByTestId('song-category-input'), 'Hymn');
    await user.type(screen.getByTestId('song-lyrics-input'), 'Amazing grace');
  }

  it('uploads an audio file as audio and saves the address as the song', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_AUDIO);
    vi.mocked(songsService.createSong).mockResolvedValue('new-id');
    renderIn(<SongForm mode="create" />);
    const user = userEvent.setup();

    await fillSong(user);
    const file = new File(['x'], 'hymn.mp3', { type: 'audio/mpeg' });
    await user.upload(screen.getByTestId('song-audio-input'), file);

    await waitFor(() =>
      expect(screen.getByTestId('song-audio-url-input')).toHaveValue(UPLOADED_AUDIO.url)
    );
    expect(uploadToCloudinary).toHaveBeenCalledWith(file, 'audio', expect.anything());
    // Duration, size and format come from Cloudinary and are shown beside the player.
    expect(screen.getByTestId('song-audio-facts')).toHaveTextContent('3:07');

    await user.click(screen.getByTestId('song-form-submit'));
    await waitFor(() =>
      expect(songsService.createSong).toHaveBeenCalledWith(
        expect.objectContaining({ audioUrl: UPLOADED_AUDIO.url })
      )
    );
  });

  it('still requires a song to have audio before it is saved', async () => {
    renderIn(<SongForm mode="create" />);
    const user = userEvent.setup();

    await fillSong(user);
    await user.click(screen.getByTestId('song-form-submit'));

    expect(await screen.findByText('Audio URL is required.')).toBeInTheDocument();
    expect(songsService.createSong).not.toHaveBeenCalled();
  });

  it('holds Save while the song is still uploading', async () => {
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    renderIn(<SongForm mode="create" />);
    const user = userEvent.setup();

    await fillSong(user);
    await user.upload(
      screen.getByTestId('song-audio-input'),
      new File(['x'], 'hymn.mp3', { type: 'audio/mpeg' })
    );
    expect(await screen.findByTestId('song-audio-progress')).toBeInTheDocument();
    expect(screen.getByTestId('song-form-submit')).toBeDisabled();

    await act(async () => {
      pending.resolve(UPLOADED_AUDIO);
    });
    await waitFor(() => expect(screen.getByTestId('song-form-submit')).toBeEnabled());
  });

  it('shows how to set up audio uploading, and still takes a pasted link', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    vi.mocked(songsService.createSong).mockResolvedValue('new-id');
    renderIn(<SongForm mode="create" />);
    const user = userEvent.setup();

    expect(screen.getByTestId('song-audio-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('song-audio-upload-button')).toBeNull();

    await fillSong(user);
    await user.type(
      screen.getByTestId('song-audio-url-input'),
      'https://example.com/hymn.mp3'
    );
    await user.click(screen.getByTestId('song-form-submit'));

    await waitFor(() =>
      expect(songsService.createSong).toHaveBeenCalledWith(
        expect.objectContaining({ audioUrl: 'https://example.com/hymn.mp3' })
      )
    );
  });
});
