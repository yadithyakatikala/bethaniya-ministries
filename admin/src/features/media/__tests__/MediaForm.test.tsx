import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MediaForm } from '../MediaForm';
import { useAuthStore } from '../../../store/authStore';
import * as service from '../../../services/firebase/media';
import type { MediaRecord } from '../../../services/firebase/media';

vi.mock('../../../services/firebase/media');

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

    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'https://example.org/photo.jpg'
    );
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findByText(/caption is required/i)).toBeInTheDocument();
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });

  it('refuses a link that is not https, and says which problem it is', async () => {
    renderForm({ mode: 'create' });

    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'http://example.org/photo.jpg'
    );
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    // findAll, not find: the same sentence is shown twice on purpose --
    // once under the field and once in the preview, where an
    // administrator is actually looking when a link goes wrong.
    expect(await screen.findAllByText(/must start with https/i)).not.toHaveLength(0);
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });

  it('refuses a javascript: link', async () => {
    renderForm({ mode: 'create' });

    await userEvent.type(screen.getByTestId('media-url-input'), 'javascript:alert(1)');
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    await waitFor(() => expect(service.createMediaPost).not.toHaveBeenCalled());
  });

  it('refuses a link to an installer', async () => {
    renderForm({ mode: 'create' });

    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'https://example.org/app.apk'
    );
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findAllByText(/will not open/i)).not.toHaveLength(0);
    expect(service.createMediaPost).not.toHaveBeenCalled();
  });
});

describe('saving', () => {
  it('saves a new post as a DRAFT, never published', async () => {
    // Publishing is a deliberate action on the list, so a half-finished
    // post cannot go live because somebody pressed Save.
    vi.mocked(service.createMediaPost).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'https://example.org/photo.jpg'
    );
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

    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'https://example.org/photo.jpg'
    );
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
    expect(screen.getByTestId('media-url-input')).toHaveValue(
      'https://example.org/photo.jpg'
    );
    expect(screen.getByTestId('media-caption-input')).toHaveValue('Sunday worship');
    expect(screen.getByTestId('media-verse-reference-input')).toHaveValue('John 3:16');
  });

  it('shows a failure rather than pretending the post saved', async () => {
    vi.mocked(service.createMediaPost).mockRejectedValue(new Error('denied'));
    renderForm({ mode: 'create' });

    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'https://example.org/photo.jpg'
    );
    await userEvent.type(screen.getByTestId('media-caption-input'), 'Sunday worship');
    await userEvent.click(screen.getByTestId('media-form-submit'));

    expect(await screen.findByTestId('media-form-error')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('the preview', () => {
  it('invites a link before there is one', () => {
    renderForm({ mode: 'create' });
    expect(screen.getByTestId('media-preview-empty')).toBeInTheDocument();
  });

  it('shows the image once the link is usable', async () => {
    renderForm({ mode: 'create' });
    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'https://example.org/photo.jpg'
    );
    expect(await screen.findByTestId('media-preview-image')).toBeInTheDocument();
  });

  it('explains a bad link instead of showing a broken image', async () => {
    renderForm({ mode: 'create' });
    await userEvent.type(
      screen.getByTestId('media-url-input'),
      'http://example.org/photo.jpg'
    );
    expect(await screen.findByTestId('media-preview-problem')).toBeInTheDocument();
    expect(screen.queryByTestId('media-preview-image')).not.toBeInTheDocument();
  });

  it('names a video rather than loading a player into the admin form', async () => {
    renderForm({ mode: 'edit', post: existing({ type: 'video' }) });
    expect(await screen.findByTestId('media-preview-video')).toBeInTheDocument();
  });
});
