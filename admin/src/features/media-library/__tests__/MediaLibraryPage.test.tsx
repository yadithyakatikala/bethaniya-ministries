import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { ToastProvider } from '../../../components/ui';

vi.mock('../../../services/firebase/app', () => ({ db: {} }));
vi.mock('../../../services/firebase/auditLog', () => ({ logAdminAction: vi.fn() }));
vi.mock('../../../services/firebase/mediaAssets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/firebase/mediaAssets')>()),
  subscribeToMediaAssets: vi.fn(),
  createMediaAsset: vi.fn(),
  updateMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn(),
}));
vi.mock('../../../services/media/cloudinaryConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryConfig')>()),
  getCloudinaryConfig: vi.fn(),
}));
vi.mock('../../../services/media/cloudinaryUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryUpload')>()),
  uploadToCloudinary: vi.fn(),
}));

import {
  createMediaAsset,
  deleteMediaAsset,
  subscribeToMediaAssets,
  updateMediaAsset,
  type MediaAsset,
} from '../../../services/firebase/mediaAssets';
import { getCloudinaryConfig } from '../../../services/media/cloudinaryConfig';
import { uploadToCloudinary } from '../../../services/media/cloudinaryUpload';
import { useAuthStore } from '../../../store/authStore';
import type { UserRole } from '../../../types';
import { MediaLibraryPage } from '../MediaLibraryPage';
import { PAGE_SIZE } from '../filters';
import { MISSING, READY } from '../../../components/media/__tests__/helpers';

function asset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'a',
    kind: 'image',
    source: 'cloudinary',
    category: 'poster',
    title: 'Poster',
    altText: '',
    url: 'https://res.cloudinary.com/my-church/image/upload/v1/p.jpg',
    thumbnailUrl: null,
    publicId: 'p',
    format: 'jpg',
    bytes: 2097152,
    width: 1600,
    height: 900,
    durationSeconds: null,
    originalFilename: 'p',
    youtubeId: null,
    createdBy: 'admin-1',
    createdByName: 'Admin One',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

const LIBRARY: MediaAsset[] = [
  asset({
    id: 'easter',
    title: 'Easter poster',
    category: 'poster',
    originalFilename: 'easter-final',
  }),
  asset({
    id: 'advent',
    title: 'Advent cover',
    category: 'cover',
    altText: 'Candles burning',
  }),
  asset({
    id: 'grace',
    kind: 'audio',
    category: 'song',
    title: 'Amazing Grace',
    format: 'mp3',
    width: null,
    height: null,
    durationSeconds: 125,
    url: 'https://res.cloudinary.com/my-church/video/upload/v1/ag.mp3',
  }),
  asset({
    id: 'sermon',
    kind: 'video',
    source: 'youtube',
    category: 'video',
    title: 'Sunday sermon',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    youtubeId: 'dQw4w9WgXcQ',
    format: null,
    bytes: null,
    width: null,
    height: null,
  }),
];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function publish(assets: MediaAsset[] | 'never') {
  vi.mocked(subscribeToMediaAssets).mockImplementation(((
    next: (a: MediaAsset[]) => void
  ) => {
    if (assets !== 'never') next(assets);
    return vi.fn();
  }) as never);
}

function renderPage(role: UserRole = 'content_admin', path = '/media-library') {
  useAuthStore.setState({
    role,
    user: { uid: 'admin-1', displayName: 'Admin One', email: 'a@x.org' } as never,
  });
  return render(
    <ThemeProvider theme={theme}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/media-library" element={<MediaLibraryPage />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
  publish(LIBRARY);
});

describe('what the page shows', () => {
  it('has one h1 and, while loading, a skeleton rather than an empty state', () => {
    publish('never');
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Media Library' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('media-library-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('media-library-empty')).toBeNull();
  });

  it('lists every record with its name and details', () => {
    renderPage();
    for (const id of ['easter', 'advent', 'grace', 'sermon']) {
      expect(screen.getByTestId(`media-library-card-${id}`)).toBeInTheDocument();
    }
    const grace = screen.getByTestId('media-library-card-grace');
    expect(grace).toHaveTextContent('Amazing Grace');
    expect(grace).toHaveTextContent('MP3 · 2:05 · 2.0 MB');
    expect(grace).toHaveTextContent('Songs & worship');
    expect(screen.getByTestId('media-library-card-sermon')).toHaveTextContent('YouTube');
  });

  it('counts each type on its tab', () => {
    renderPage();
    expect(screen.getByTestId('media-library-tab-all')).toHaveTextContent('All (4)');
    expect(screen.getByTestId('media-library-tab-image')).toHaveTextContent('Images (2)');
    expect(screen.getByTestId('media-library-tab-audio')).toHaveTextContent('Audio (1)');
    expect(screen.getByTestId('media-library-tab-video')).toHaveTextContent(
      'Videos & links (1)'
    );
  });

  it('shows an inviting empty state with the way to fill it', async () => {
    publish([]);
    renderPage();
    expect(screen.getByTestId('media-library-empty')).toHaveTextContent(
      'Your library is empty'
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Upload your first file' }));
    expect(screen.getByTestId('location')).toHaveTextContent('?upload=1');
  });

  it('explains a refused read in terms of the security rules', () => {
    vi.mocked(subscribeToMediaAssets).mockImplementation(((
      _next: unknown,
      onError: (e: unknown) => void
    ) => {
      onError({ code: 'permission-denied' });
      return vi.fn();
    }) as never);
    renderPage();
    expect(screen.getByTestId('media-library-error')).toHaveTextContent(
      'needs the latest Firestore security rules'
    );
    // And the page does not pretend the library is merely empty.
    expect(screen.queryByTestId('media-library-empty')).toBeNull();
  });

  it('shows only the first page of a long library, with a way to see the rest', async () => {
    const many = Array.from({ length: PAGE_SIZE + 2 }, (_, i) =>
      asset({ id: `m${i}`, title: `Picture ${i}` })
    );
    publish(many);
    renderPage();
    expect(screen.getAllByTestId(/^media-library-card-/)).toHaveLength(PAGE_SIZE);
    await userEvent.setup().click(screen.getByTestId('media-library-more'));
    expect(screen.getAllByTestId(/^media-library-card-/)).toHaveLength(PAGE_SIZE + 2);
    expect(screen.queryByTestId('media-library-more')).toBeNull();
  });
});

describe('finding things', () => {
  it('filters by type', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('media-library-tab-audio'));
    expect(screen.getByTestId('media-library-card-grace')).toBeInTheDocument();
    expect(screen.queryByTestId('media-library-card-easter')).toBeNull();
  });

  it('filters by category', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Category'));
    await user.click(await screen.findByRole('option', { name: 'Covers' }));
    expect(screen.getByTestId('media-library-card-advent')).toBeInTheDocument();
    expect(screen.queryByTestId('media-library-card-easter')).toBeNull();
  });

  it('searches names, file names and descriptions', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('media-library-search'), 'candles');
    expect(screen.getByTestId('media-library-card-advent')).toBeInTheDocument();
    expect(screen.queryByTestId('media-library-card-easter')).toBeNull();
  });

  it('says so when nothing matches, and clears the filters on request', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('media-library-search'), 'zzzz');
    expect(screen.getByTestId('media-library-no-match')).toBeInTheDocument();
    await user.click(screen.getByTestId('media-library-clear'));
    expect(screen.getByTestId('media-library-card-easter')).toBeInTheDocument();
    expect(screen.getByTestId('media-library-search')).toHaveValue('');
  });

  it('keeps the tab counts steady while searching', async () => {
    renderPage();
    await userEvent.setup().type(screen.getByTestId('media-library-search'), 'zzzz');
    expect(screen.getByTestId('media-library-tab-all')).toHaveTextContent('All (4)');
  });
});

describe('who may do what', () => {
  it('lets a host browse and copy, but not add, rename or remove', () => {
    // Even with uploading switched off, a host is not shown the setup notice:
    // it is for the people who can fix it.
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderPage('host');
    expect(screen.getByTestId('media-library-card-easter')).toBeInTheDocument();
    expect(screen.queryByTestId('media-library-upload-button')).toBeNull();
    expect(screen.queryByTestId('media-library-add-link-button')).toBeNull();
    expect(screen.queryByTestId('media-library-edit-easter')).toBeNull();
    expect(screen.queryByTestId('media-library-delete-easter')).toBeNull();
    expect(screen.getByTestId('media-library-copy-easter')).toBeInTheDocument();
    expect(screen.queryByTestId('media-library-setup')).toBeNull();
  });

  it('opens a record read-only for a host', async () => {
    renderPage('host');
    await userEvent.setup().click(screen.getByTestId('media-library-open-easter'));
    const dialog = await screen.findByTestId('media-asset-dialog');
    expect(within(dialog).queryByTestId('media-asset-title-input')).toBeNull();
    expect(screen.queryByTestId('media-asset-save')).toBeNull();
    expect(screen.getByTestId('media-asset-address')).toHaveTextContent(LIBRARY[0]!.url);
  });

  it('does not open the upload dialog for a host who follows an ?upload=1 link', () => {
    renderPage('host', '/media-library?upload=1');
    expect(screen.queryByTestId('upload-media-dialog')).toBeNull();
  });

  it('shows the upload setup notice to a content admin when uploading is off', () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderPage('content_admin');
    expect(screen.getByTestId('media-library-setup')).toBeInTheDocument();
  });

  it('shows the setup notice to nobody when everything is configured', () => {
    renderPage('content_admin');
    expect(screen.queryByTestId('media-library-setup')).toBeNull();
  });
});

describe('looking at and renaming a record', () => {
  it('shows the preview, the facts and the address', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('media-library-open-grace'));
    const dialog = await screen.findByTestId('media-asset-dialog');
    expect(within(dialog).getByTestId('media-asset-player')).toHaveAttribute(
      'src',
      LIBRARY[2]!.url
    );
    expect(dialog).toHaveTextContent('Uploaded to Cloudinary');
    expect(dialog).toHaveTextContent('Length');
    expect(dialog).toHaveTextContent('2:05');
    expect(screen.getByTestId('media-asset-address')).toHaveTextContent(LIBRARY[2]!.url);
  });

  it('shows a YouTube record with its player thumbnail', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('media-library-open-sermon'));
    expect(
      await screen.findByTestId('media-asset-youtube-thumbnail')
    ).toBeInTheDocument();
  });

  it('saves a new name, description and category', async () => {
    vi.mocked(updateMediaAsset).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('media-library-edit-easter'));
    expect(screen.getByTestId('media-asset-save')).toBeDisabled();
    const title = screen.getByTestId('media-asset-title-input');
    await user.clear(title);
    await user.type(title, 'Easter poster 2027');
    await user.type(screen.getByTestId('media-asset-alt-input'), 'A cross at sunrise');
    await user.click(screen.getByTestId('media-asset-save'));
    await waitFor(() =>
      expect(updateMediaAsset).toHaveBeenCalledWith('easter', {
        title: 'Easter poster 2027',
        altText: 'A cross at sunrise',
        category: 'poster',
      })
    );
    expect(await screen.findByText('Saved "Easter poster 2027".')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('media-asset-dialog')).toBeNull());
  });

  it('will not save an empty name', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('media-library-edit-easter'));
    await user.clear(screen.getByTestId('media-asset-title-input'));
    await user.click(screen.getByTestId('media-asset-save'));
    expect(await screen.findByText('A name is required.')).toBeInTheDocument();
    expect(updateMediaAsset).not.toHaveBeenCalled();
  });

  it('reports a refused save in terms of the rules and keeps the dialog open', async () => {
    vi.mocked(updateMediaAsset).mockRejectedValue({ code: 'permission-denied' });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('media-library-edit-easter'));
    await user.type(screen.getByTestId('media-asset-title-input'), ' 2');
    await user.click(screen.getByTestId('media-asset-save'));
    expect(await screen.findByTestId('media-asset-error')).toHaveTextContent(
      'security rules'
    );
    expect(screen.getByTestId('media-asset-dialog')).toBeInTheDocument();
  });

  it('offers no description field for audio', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('media-library-edit-grace'));
    expect(screen.queryByTestId('media-asset-alt-input')).toBeNull();
  });
});

describe('copying an address', () => {
  it('puts the address on the clipboard and says so', async () => {
    renderPage();
    // user-event installs its own clipboard on setup, so the spy goes in after.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByTestId('media-library-copy-easter'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LIBRARY[0]!.url));
    expect(await screen.findByText('Address copied.')).toBeInTheDocument();
  });

  it('says what to do when the browser will not copy', async () => {
    renderPage();
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    await user.click(screen.getByTestId('media-library-copy-easter'));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
  });
});

describe('removing a record', () => {
  it('asks first, and says plainly that the file itself stays', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByTestId('media-library-delete-easter'));
    const dialog = await screen.findByRole('dialog', {
      name: 'Remove from the library?',
    });
    expect(dialog).toHaveTextContent('The file itself is not deleted');
    expect(dialog).toHaveTextContent('keeps working');
    expect(deleteMediaAsset).not.toHaveBeenCalled();
  });

  it('removes only the record when confirmed', async () => {
    vi.mocked(deleteMediaAsset).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('media-library-delete-easter'));
    await user.click(await screen.findByTestId('media-library-confirm-delete'));
    await waitFor(() =>
      expect(deleteMediaAsset).toHaveBeenCalledWith('easter', 'Easter poster')
    );
    expect(
      await screen.findByText('Removed "Easter poster" from the library.')
    ).toBeInTheDocument();
  });

  it('does nothing when cancelled', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('media-library-delete-easter'));
    await user.click(await screen.findByTestId('media-library-cancel-delete'));
    expect(deleteMediaAsset).not.toHaveBeenCalled();
  });

  it('reports a refused removal', async () => {
    vi.mocked(deleteMediaAsset).mockRejectedValue({ code: 'permission-denied' });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('media-library-delete-easter'));
    await user.click(await screen.findByTestId('media-library-confirm-delete'));
    expect(await screen.findByText(/security rules/)).toBeInTheDocument();
  });
});

describe('uploading from the library', () => {
  const user = () => userEvent.setup({ applyAccept: false });
  const png = () => {
    const f = new File(['x'], 'sunday.png', { type: 'image/png' });
    Object.defineProperty(f, 'size', { value: 4096 });
    return f;
  };

  it('opens from the button, and from an ?upload=1 link, and closes back to the plain address', async () => {
    renderPage();
    const u = user();
    await u.click(screen.getByTestId('media-library-upload-button'));
    expect(await screen.findByTestId('upload-media-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/media-library?upload=1');
    await u.click(screen.getByTestId('upload-media-close'));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/media-library$/)
    );
  });

  it('opens straight away for the dashboard shortcut', async () => {
    renderPage('content_admin', '/media-library?upload=1');
    expect(await screen.findByTestId('upload-media-dialog')).toBeInTheDocument();
  });

  it('uploads a named file under a chosen category and records it', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue({
      url: 'https://res.cloudinary.com/my-church/image/upload/v1/sunday.png',
      publicId: 'maranatha/sunday',
      resourceType: 'image',
      kind: 'image',
      format: 'png',
      bytes: 4096,
      width: 800,
      height: 600,
      durationSeconds: null,
      originalFilename: 'sunday',
    });
    vi.mocked(createMediaAsset).mockResolvedValue('new-1');
    renderPage('content_admin', '/media-library?upload=1');
    const u = user();
    await screen.findByTestId('upload-media-dialog');
    await u.type(screen.getByTestId('upload-media-title-input'), 'Sunday flyer');
    await u.type(screen.getByTestId('upload-media-alt-input'), 'People gathering');
    // The page behind the dialog has a Category control too: scope to the dialog.
    await u.click(
      within(screen.getByTestId('upload-media-dialog')).getByLabelText('Category')
    );
    await u.click(await screen.findByRole('option', { name: 'Covers' }));
    await u.upload(screen.getByTestId('upload-media-input'), png());
    expect(screen.getByTestId('upload-media-file')).toHaveTextContent(
      'sunday.png · 4 KB'
    );
    await u.click(screen.getByTestId('upload-media-submit'));

    await waitFor(() => expect(createMediaAsset).toHaveBeenCalledTimes(1));
    expect(createMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'image',
        source: 'cloudinary',
        category: 'cover',
        title: 'Sunday flyer',
        altText: 'People gathering',
      }),
      { uid: 'admin-1', name: 'Admin One' }
    );
    expect(await screen.findByText('Added to the media library.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('upload-media-dialog')).toBeNull());
  });

  it('refuses an unsuitable file before anything is sent', async () => {
    renderPage('content_admin', '/media-library?upload=1');
    const u = user();
    await screen.findByTestId('upload-media-dialog');
    await u.upload(
      screen.getByTestId('upload-media-input'),
      new File(['x'], 'logo.svg', { type: 'image/svg+xml' })
    );
    expect(await screen.findByTestId('upload-media-file-error')).toHaveTextContent(
      'JPEG, PNG, WebP or GIF'
    );
    expect(screen.getByTestId('upload-media-submit')).toBeDisabled();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('shows the setup notice, and a disabled Upload, when uploading is not set up', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderPage('content_admin', '/media-library?upload=1');
    expect(await screen.findByTestId('upload-media-setup')).toBeInTheDocument();
    expect(screen.getByTestId('upload-media-submit')).toBeDisabled();
    expect(screen.queryByTestId('upload-media-input')).toBeNull();
  });

  it("shows the file's address instead of closing when it could not be recorded", async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue({
      url: 'https://res.cloudinary.com/my-church/image/upload/v1/sunday.png',
      publicId: 'p',
      resourceType: 'image',
      kind: 'image',
      format: 'png',
      bytes: 4096,
      width: 8,
      height: 8,
      durationSeconds: null,
      originalFilename: 'sunday',
    });
    vi.mocked(createMediaAsset).mockRejectedValue({ code: 'permission-denied' });
    renderPage('content_admin', '/media-library?upload=1');
    const u = user();
    await screen.findByTestId('upload-media-dialog');
    await u.upload(screen.getByTestId('upload-media-input'), png());
    await u.click(screen.getByTestId('upload-media-submit'));
    const unrecorded = await screen.findByTestId('upload-media-unrecorded');
    expect(unrecorded).toHaveTextContent('could not be added to the library');
    expect(unrecorded).toHaveTextContent('security rules');
    expect(unrecorded).toHaveTextContent(
      'https://res.cloudinary.com/my-church/image/upload/v1/sunday.png'
    );
  });

  it('switches to audio and uses the audio preset', async () => {
    renderPage('content_admin', '/media-library?upload=1');
    const u = user();
    await screen.findByTestId('upload-media-dialog');
    await u.click(screen.getByTestId('upload-media-kind-audio'));
    expect(screen.getByTestId('upload-media-input')).toHaveAttribute(
      'accept',
      expect.stringContaining('audio/mpeg')
    );
    expect(screen.queryByTestId('upload-media-alt-input')).toBeNull();
  });
});

describe('adding a link', () => {
  async function openAddLink() {
    renderPage();
    const u = userEvent.setup();
    await u.click(screen.getByTestId('media-library-add-link-button'));
    await screen.findByTestId('add-link-dialog');
    return u;
  }

  it('saves a YouTube video as a video record, tidied, with its thumbnail', async () => {
    vi.mocked(createMediaAsset).mockResolvedValue('v1');
    const u = await openAddLink();
    await u.type(
      screen.getByTestId('add-link-address-input'),
      'https://youtu.be/dQw4w9WgXcQ?si=abc'
    );
    expect(screen.getByTestId('add-link-youtube-preview')).toBeInTheDocument();
    await u.type(screen.getByTestId('add-link-title-input'), 'Sunday sermon');
    await u.click(screen.getByTestId('add-link-submit'));
    await waitFor(() => expect(createMediaAsset).toHaveBeenCalledTimes(1));
    expect(createMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'video',
        source: 'youtube',
        category: 'video',
        title: 'Sunday sermon',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      }),
      { uid: 'admin-1', name: 'Admin One' }
    );
    expect(await screen.findByText('Added to the media library.')).toBeInTheDocument();
  });

  it('saves an image link as a link record', async () => {
    vi.mocked(createMediaAsset).mockResolvedValue('l1');
    const u = await openAddLink();
    await u.click(screen.getByTestId('add-link-kind-image'));
    await u.type(
      screen.getByTestId('add-link-address-input'),
      'https://example.org/p.png'
    );
    await u.click(screen.getByTestId('add-link-submit'));
    await waitFor(() => expect(createMediaAsset).toHaveBeenCalled());
    expect(createMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'image',
        source: 'link',
        url: 'https://example.org/p.png',
        category: 'general',
      }),
      expect.anything()
    );
  });

  it.each([
    ['http://example.org/p.png', /https/],
    ['https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', /single video/],
  ])('refuses %s with a sentence and writes nothing', async (address, message) => {
    const u = await openAddLink();
    await u.type(screen.getByTestId('add-link-address-input'), address);
    await u.click(screen.getByTestId('add-link-submit'));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(createMediaAsset).not.toHaveBeenCalled();
  });

  it('reports a refused write in terms of the rules and stays open', async () => {
    vi.mocked(createMediaAsset).mockRejectedValue({ code: 'permission-denied' });
    const u = await openAddLink();
    await u.type(
      screen.getByTestId('add-link-address-input'),
      'https://youtu.be/dQw4w9WgXcQ'
    );
    await u.click(screen.getByTestId('add-link-submit'));
    expect(await screen.findByTestId('add-link-error')).toHaveTextContent(
      'security rules'
    );
    expect(screen.getByTestId('add-link-dialog')).toBeInTheDocument();
  });

  it('does not offer Add until there is an address', async () => {
    await openAddLink();
    expect(screen.getByTestId('add-link-submit')).toBeDisabled();
  });
});
