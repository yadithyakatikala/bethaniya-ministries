import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MediaForm } from '../MediaForm';
import { useAuthStore } from '../../../store/authStore';
import * as service from '../../../services/firebase/media';
import type { MediaRecord } from '../../../services/firebase/media';
import type { UploadedAsset } from '../../../services/media/types';
import {
  MISSING,
  READY,
  UPLOADED_IMAGE,
  deferred,
} from '../../../components/media/__tests__/helpers';

vi.mock('../../../services/firebase/media');
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

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

/**
 * The form: what it refuses to save, what it saves, and the two things
 * that stop an incomplete post reaching the congregation -- a required
 * caption, and publishing being somebody's deliberate second action.
 */
function renderForm(props: Parameters<typeof MediaForm>[0]) {
  return render(
    <MemoryRouter>
      <MediaForm {...props} />
    </MemoryRouter>
  );
}

function existing(partial: Partial<MediaRecord> = {}): MediaRecord {
  return {
    id: 'm1',
    type: 'image',
    mediaUrl: 'https://example.org/photo.jpg',
    caption: 'Sunday worship',
    verseReference: 'John 3:16',
    verseText: null,
    published: true,
    publishAt: new Date('2026-04-01T09:00:00.000Z'),
    authorName: 'Pastor',
    authorUid: 'admin-1',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

// Uploading is NOT set up by default, which leaves the picture's web-address
// box open -- the way this form was used before uploads existed. The tests
// of the upload itself switch to READY.
beforeEach(() => {
  vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
  vi.mocked(createMediaAsset).mockResolvedValue('asset-1');
  vi.mocked(uploadToCloudinary).mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  URL.revokeObjectURL = vi.fn();
});

/** Types an address into the picture field and takes it. */
async function useImageAddress(address: string) {
  await userEvent.type(screen.getByTestId('media-image-url-input'), address);
  await userEvent.click(screen.getByTestId('media-image-url-apply'));
}

afterEach(() => {
  navigate.mockReset();
  vi.mocked(service.createMediaPost).mockReset();
  vi.mocked(service.updateMediaPost).mockReset();
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: 'Pastor' } as never,
    role: 'content_admin',
  });
});

describe('what the form refuses to save', () => {
  it('refuses a post with no caption, naming the field', async () => {
    renderForm({ mode: 'create' });

    await useImageAddress('https://example.org/photo.jpg');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findByText(/caption is required/i)).toBeInTheDocument();
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });

  it('refuses a post with no picture', async () => {
    renderForm({ mode: 'create' });

    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findAllByText(/media link is required/i)).not.toHaveLength(0);
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });

  it('will not take a link that is not https, and says which problem it is', async () => {
    renderForm({ mode: 'create' });

    await useImageAddress('http://example.org/photo.jpg');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(screen.getAllByText(/must start with https/i)).not.toHaveLength(0);
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });

  it('will not take a javascript: link', async () => {
    renderForm({ mode: 'create' });

    await useImageAddress('javascript:alert(1)');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.createMediaPost).not.toHaveBeenCalled());
    expect(screen.queryByTestId('media-image-address')).not.toBeInTheDocument();
  });

  it('will not take a link to an installer', async () => {
    renderForm({ mode: 'create' });

    await useImageAddress('https://example.org/app.apk');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(screen.getAllByText(/will not open/i)).not.toHaveLength(0);
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });

  it('refuses to save a stored link that is not https, in the same words', async () => {
    // An old post can carry a link the field would not take today.
    renderForm({
      mode: 'edit',
      post: existing({ mediaUrl: 'http://example.org/photo.jpg' }),
    });
    await userEvent.click(screen.getByTestId('media-form-submit'));

    // findAll, not find: the same sentence is shown twice on purpose --
    // once under the field and once in the preview, where an
    // administrator is actually looking when a link goes wrong.
    expect(await screen.findAllByText(/must start with https/i)).not.toHaveLength(0);
    expect(service.updateMediaPost).not.toHaveBeenCalled();
  });

  it('refuses a stored link to an installer', async () => {
    renderForm({
      mode: 'edit',
      post: existing({ mediaUrl: 'https://example.org/app.apk' }),
    });
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findAllByText(/will not open/i)).not.toHaveLength(0);
    expect(service.updateMediaPost).not.toHaveBeenCalled();
  });
});

describe('saving', () => {
  it('saves a new post as a DRAFT, never published', async () => {
    // Publishing is a deliberate action on the list, so a half-finished
    // post cannot go live because somebody pressed Save.
    vi.mocked(service.createMediaPost).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    await useImageAddress('https://example.org/photo.jpg');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.createMediaPost).toHaveBeenCalled());
    const input = vi.mocked(service.createMediaPost).mock.calls[0]![0];
    expect(input.published).toBe(false);
    expect(input.caption).toBe('Sunday worship');
    expect(input.mediaUrl).toBe('https://example.org/photo.jpg');
    expect(navigate).toHaveBeenCalledWith('/media');
  });

  it('says a new post is a draft, on the form', async () => {
    renderForm({ mode: 'create' });
    expect(screen.getByTestId('media-unpublished-note')).toBeInTheDocument();
  });

  it('records who wrote it, so the feed can show a name without a lookup', async () => {
    // firestore.rules does not let a member read another member's
    // profile, so the author is denormalized onto the post.
    vi.mocked(service.createMediaPost).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    await useImageAddress('https://example.org/photo.jpg');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.createMediaPost).toHaveBeenCalled());
    const input = vi.mocked(service.createMediaPost).mock.calls[0]![0];
    expect(input.authorName).toBe('Pastor');
    expect(input.authorUid).toBe('admin-1');
  });

  it('does NOT change published state when editing', async () => {
    // An edit is an edit. Unpublishing is its own action, with its own
    // audit entry.
    vi.mocked(service.updateMediaPost).mockResolvedValue(undefined);
    renderForm({ mode: 'edit', post: existing({ published: true }) });

    await userEvent.clear(screen.getByTestId('media-caption-input'));
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Edited caption');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.updateMediaPost).toHaveBeenCalled());
    const [, input] = vi.mocked(service.updateMediaPost).mock.calls[0]!;
    expect(input.published).toBe(true);
    expect(input.caption).toBe('Edited caption');
  });

  it('loads an existing post into the fields', () => {
    renderForm({ mode: 'edit', post: existing() });
    expect(screen.getByTestId('media-image-preview')).toHaveAttribute(
      'src',
      'https://example.org/photo.jpg'
    );
    expect(screen.getByTestId('media-caption-input')).toHaveValue('Sunday worship');
    expect(screen.getByTestId('media-verse-reference-input')).toHaveValue('John 3:16');
  });

  it('shows a failure rather than pretending the post saved', async () => {
    vi.mocked(service.createMediaPost).mockRejectedValue(new Error('denied'));
    renderForm({ mode: 'create' });

    await useImageAddress('https://example.org/photo.jpg');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findByTestId('media-form-error')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('the picture', () => {
  it('uploads a picture and saves the address Cloudinary returned', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    vi.mocked(service.createMediaPost).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    await userEvent.upload(
      screen.getByTestId('media-image-input'),
      new File(['x'], 'sunday.jpg', { type: 'image/jpeg' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('media-image-preview')).toHaveAttribute(
        'src',
        UPLOADED_IMAGE.url
      )
    );
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.createMediaPost).toHaveBeenCalled());
    expect(vi.mocked(service.createMediaPost).mock.calls[0]![0]).toMatchObject({
      type: 'image',
      mediaUrl: UPLOADED_IMAGE.url,
    });
    expect(createMediaAsset).toHaveBeenCalledTimes(1);
  });

  it('holds Save while the picture is still uploading', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    renderForm({ mode: 'create' });

    await userEvent.upload(
      screen.getByTestId('media-image-input'),
      new File(['x'], 'sunday.jpg', { type: 'image/jpeg' })
    );
    expect(await screen.findByTestId('media-image-progress')).toBeInTheDocument();
    expect(screen.getByTestId('media-form-submit')).toBeDisabled();

    await act(async () => {
      pending.resolve(UPLOADED_IMAGE);
    });
    await waitFor(() => expect(screen.getByTestId('media-form-submit')).toBeEnabled());
  });

  it('says plainly that uploading is not set up, and still takes an address', () => {
    renderForm({ mode: 'create' });
    expect(screen.getByTestId('media-image-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('media-image-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('media-image-url-input')).toBeInTheDocument();
  });
});

describe('a video post', () => {
  async function chooseVideo() {
    const select = screen.getByTestId('media-type-input');
    // MUI's select renders a hidden native input; the visible control is the button.
    await userEvent.click(
      within(select.parentElement as HTMLElement).getByRole('combobox')
    );
    await userEvent.click(await screen.findByRole('option', { name: 'Video' }));
  }

  it('is a link, never an upload', async () => {
    renderForm({ mode: 'create' });
    await chooseVideo();

    expect(screen.getByTestId('media-video-url-input')).toBeInTheDocument();
    expect(screen.queryByTestId('media-image-input')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('tidies a pasted YouTube address to the form the phone plays, and saves that', async () => {
    vi.mocked(service.createMediaPost).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    await chooseVideo();

    await userEvent.type(
      screen.getByTestId('media-video-url-input'),
      'https://youtu.be/dQw4w9WgXcQ?t=43'
    );
    await userEvent.tab();
    expect(screen.getByTestId('media-video-url-input')).toHaveValue(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );

    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sermon');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.createMediaPost).toHaveBeenCalled());
    expect(vi.mocked(service.createMediaPost).mock.calls[0]![0]).toMatchObject({
      type: 'video',
      mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('shows the video thumbnail in the preview of what a member will see', async () => {
    renderForm({
      mode: 'edit',
      post: existing({
        type: 'video',
        mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });
    expect(await screen.findByTestId('media-preview-video-thumbnail')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    );
  });

  it('refuses a video link that is not https, in the same words as for a picture', async () => {
    renderForm({
      mode: 'edit',
      post: existing({ type: 'video', mediaUrl: 'http://example.org/clip.mp4' }),
    });
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findAllByText(/must start with https/i)).not.toHaveLength(0);
    expect(service.updateMediaPost).not.toHaveBeenCalled();
  });
});

describe('the preview', () => {
  it('invites a link before there is one', () => {
    renderForm({ mode: 'create' });
    expect(screen.getByTestId('media-preview-empty')).toBeInTheDocument();
  });

  it('shows the image once the link is usable', async () => {
    renderForm({ mode: 'create' });
    await useImageAddress('https://example.org/photo.jpg');
    expect(await screen.findByTestId('media-preview-image')).toBeInTheDocument();
  });

  it('explains a bad stored link instead of showing a broken image', async () => {
    renderForm({
      mode: 'edit',
      post: existing({ mediaUrl: 'http://example.org/photo.jpg' }),
    });
    expect(await screen.findByTestId('media-preview-problem')).toBeInTheDocument();
    expect(screen.queryByTestId('media-preview-image')).not.toBeInTheDocument();
  });

  it('names a video rather than loading a player into the admin form', async () => {
    renderForm({ mode: 'edit', post: existing({ type: 'video' }) });
    expect(await screen.findByTestId('media-preview-video')).toBeInTheDocument();
  });
});
