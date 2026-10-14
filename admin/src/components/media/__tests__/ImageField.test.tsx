import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

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
  type UploadOptions,
} from '../../../services/media/cloudinaryUpload';
import {
  assetFromUpload,
  createMediaAsset,
  subscribeToMediaAssets,
} from '../../../services/firebase/mediaAssets';
import { useAuthStore } from '../../../store/authStore';
import type { UploadedAsset } from '../../../services/media/types';
import { RULES_NOT_DEPLOYED_MESSAGE } from '../libraryErrors';
import { ImageField } from '../ImageField';
import { INVALID, MISSING, READY, deferred, fileOf, renderThemed } from './helpers';

const UPLOADED: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/image/upload/v1/cover.jpg',
  publicId: 'maranatha/cover',
  resourceType: 'image',
  kind: 'image',
  format: 'jpg',
  bytes: 1000,
  width: 800,
  height: 600,
  durationSeconds: null,
  originalFilename: 'cover',
};

function Harness({
  initial = null,
  validateFile,
  disabled,
  error,
  onBusyChange,
}: {
  initial?: string | null;
  validateFile?: (file: File) => string | null;
  disabled?: boolean;
  error?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <ImageField
        value={value}
        onChange={setValue}
        label="Cover image"
        category="cover"
        testIdPrefix="cover"
        validateFile={validateFile}
        disabled={disabled}
        error={error}
        onBusyChange={onBusyChange}
      />
      <output data-testid="value">{value ?? ''}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: 'Admin One', email: 'a@x.org' } as never,
  });
  URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  URL.revokeObjectURL = vi.fn();
});

const picker = () => userEvent.setup({ applyAccept: false });

describe('when uploading is not set up', () => {
  it.each([
    ['missing', MISSING],
    ['invalid', INVALID],
  ])('shows a setup notice instead of an upload button (%s)', (_name, config) => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(config);
    renderThemed(<Harness />);
    expect(screen.getByTestId('cover-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('cover-upload-button')).toBeNull();
    expect(screen.queryByTestId('cover-input')).toBeNull();
  });

  it('still offers the library and a web address, with the address box already open', () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderThemed(<Harness />);
    expect(screen.getByTestId('cover-library-button')).toBeInTheDocument();
    expect(screen.getByTestId('cover-url-input')).toBeInTheDocument();
  });

  it('accepts a good https address', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.type(screen.getByTestId('cover-url-input'), 'https://example.org/c.png');
    await user.click(screen.getByTestId('cover-url-apply'));
    expect(screen.getByTestId('value')).toHaveTextContent('https://example.org/c.png');
    expect(screen.getByTestId('cover-preview')).toHaveAttribute(
      'src',
      'https://example.org/c.png'
    );
  });

  it.each([
    ['http://example.org/c.png', /must start with https/],
    ['javascript:alert(1)', /must start with https/],
    ['https://user:pw@example.org/c.png', /username or password/],
    ['https://example.org/logo.svg', /will not open/],
    ['not an address', /not a complete web address/],
  ])('rejects %s with a sentence that says why', async (address, message) => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.type(screen.getByTestId('cover-url-input'), address);
    await user.click(screen.getByTestId('cover-url-apply'));
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('');
  });
});

describe('when uploading is set up', () => {
  it('offers an upload button and keeps the address box out of the way', () => {
    renderThemed(<Harness />);
    expect(screen.getByTestId('cover-upload-button')).toHaveTextContent('Upload image');
    expect(screen.getByTestId('cover-input')).toHaveAttribute(
      'accept',
      expect.stringContaining('image/jpeg')
    );
    expect(screen.queryByTestId('cover-setup')).toBeNull();
    expect(screen.queryByTestId('cover-url-input')).toBeNull();
  });

  it('reveals the address box on request', async () => {
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.click(screen.getByTestId('cover-url-toggle'));
    expect(screen.getByTestId('cover-url-input')).toBeInTheDocument();
  });

  it('uploads a chosen file, shows progress, and stores the returned address', async () => {
    const pending = deferred<UploadedAsset>();
    let report: UploadOptions['onProgress'];
    vi.mocked(uploadToCloudinary).mockImplementation((_file, _kind, options) => {
      report = options?.onProgress;
      return pending.promise;
    });
    vi.mocked(createMediaAsset).mockResolvedValue('lib-1');
    const user = picker();
    renderThemed(<Harness />);

    const file = fileOf('cover.jpg', 'image/jpeg');
    await user.upload(screen.getByTestId('cover-input'), file);

    expect(uploadToCloudinary).toHaveBeenCalledWith(file, 'image', expect.any(Object));
    const progress = await screen.findByTestId('cover-progress');
    expect(progress).toHaveTextContent('Uploading cover.jpg');
    // While it uploads, the chosen picture is previewed from the local file.
    expect(screen.getByTestId('cover-preview')).toHaveAttribute(
      'src',
      'blob:local-preview'
    );

    act(() => report?.(40));
    expect(screen.getByTestId('cover-progress')).toHaveTextContent('40%');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');

    await act(async () => pending.resolve(UPLOADED));
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(UPLOADED.url)
    );
    expect(screen.queryByTestId('cover-progress')).toBeNull();
    expect(screen.getByTestId('cover-preview')).toHaveAttribute('src', UPLOADED.url);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-preview');
  });

  it("records the upload in the library under the field's category, as the signed-in admin", async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED);
    vi.mocked(createMediaAsset).mockResolvedValue('lib-1');
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await waitFor(() => expect(createMediaAsset).toHaveBeenCalledTimes(1));
    expect(assetFromUpload).toHaveBeenCalledWith(UPLOADED, {
      title: '',
      altText: '',
      category: 'cover',
    });
    expect(createMediaAsset).toHaveBeenCalledWith(expect.anything(), {
      uid: 'admin-1',
      name: 'Admin One',
    });
  });

  it('still uses the address when the library cannot record it, and says why', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED);
    vi.mocked(createMediaAsset).mockRejectedValue({ code: 'permission-denied' });
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(UPLOADED.url)
    );
    expect(screen.getByTestId('cover-library-warning')).toHaveTextContent(
      RULES_NOT_DEPLOYED_MESSAGE
    );
    // A catalogue failure is not an upload failure.
    expect(screen.queryByTestId('cover-error')).toBeNull();
  });

  it('refuses an oversized file before sending anything', async () => {
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('big.jpg', 'image/jpeg', 6 * 1024 * 1024)
    );
    expect(await screen.findByTestId('cover-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('refuses a file of the wrong kind before sending anything', async () => {
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('logo.svg', 'image/svg+xml')
    );
    expect(await screen.findByTestId('cover-error')).toHaveTextContent(
      'Please choose a JPEG, PNG, WebP or GIF image.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it("applies a feature's own file check instead of the shared one", async () => {
    const user = picker();
    renderThemed(<Harness validateFile={() => 'This cover must be square.'} />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    expect(await screen.findByTestId('cover-error')).toHaveTextContent(
      'This cover must be square.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  it('reports a failed upload, keeps the old value, and retries on request', async () => {
    vi.mocked(uploadToCloudinary)
      .mockRejectedValueOnce(
        new UploadError(
          'network',
          'Could not reach Cloudinary. Check your internet connection.'
        )
      )
      .mockResolvedValueOnce(UPLOADED);
    vi.mocked(createMediaAsset).mockResolvedValue('lib-1');
    const user = picker();
    renderThemed(<Harness initial="https://example.org/old.png" />);

    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    expect(await screen.findByTestId('cover-error')).toHaveTextContent(
      'Could not reach Cloudinary'
    );
    // The previous image is untouched by a failed replacement.
    expect(screen.getByTestId('value')).toHaveTextContent('https://example.org/old.png');

    await user.click(screen.getByTestId('cover-retry'));
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(UPLOADED.url)
    );
    expect(uploadToCloudinary).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('cover-error')).toBeNull();
  });

  it('cancels an upload without an error and without changing the value', async () => {
    vi.mocked(uploadToCloudinary).mockImplementation(
      (_file, _kind, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new UploadError('aborted', 'The upload was cancelled.'))
          );
        })
    );
    const user = picker();
    renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await user.click(await screen.findByTestId('cover-cancel'));
    await waitFor(() => expect(screen.queryByTestId('cover-progress')).toBeNull());
    expect(screen.queryByTestId('cover-error')).toBeNull();
    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('replaces an existing image only when the new upload succeeds', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED);
    vi.mocked(createMediaAsset).mockResolvedValue('lib-1');
    const user = picker();
    renderThemed(<Harness initial="https://example.org/old.png" />);
    expect(screen.getByTestId('cover-upload-button')).toHaveTextContent('Replace image');
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent(UPLOADED.url)
    );
  });

  it('removes the image from the form without touching any file', async () => {
    const user = userEvent.setup();
    renderThemed(<Harness initial="https://example.org/old.png" />);
    await user.click(screen.getByTestId('cover-remove'));
    expect(screen.getByTestId('value')).toHaveTextContent('');
    expect(screen.queryByTestId('cover-preview')).toBeNull();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(createMediaAsset).not.toHaveBeenCalled();
  });

  it('warns when the stored address does not load as a picture', () => {
    renderThemed(<Harness initial="https://example.org/missing.png" />);
    fireEvent.error(screen.getByTestId('cover-preview'));
    expect(screen.getByTestId('cover-load-failed')).toBeInTheDocument();
  });

  it('chooses an image from the library', async () => {
    vi.mocked(subscribeToMediaAssets).mockImplementation(((
      next: (a: unknown[]) => void
    ) => {
      next([
        {
          id: 'a1',
          kind: 'image',
          source: 'cloudinary',
          category: 'cover',
          title: 'Easter cover',
          altText: '',
          url: 'https://res.cloudinary.com/my-church/image/upload/v1/easter.jpg',
          thumbnailUrl: null,
          publicId: 'p',
          format: 'jpg',
          bytes: 1000,
          width: 10,
          height: 10,
          durationSeconds: null,
          originalFilename: 'easter',
          youtubeId: null,
          createdBy: 'u',
          createdByName: 'U',
          createdAt: null,
          updatedAt: null,
        },
      ]);
      return vi.fn();
    }) as never);
    const user = userEvent.setup();
    renderThemed(<Harness />);
    await user.click(screen.getByTestId('cover-library-button'));
    await user.click(await screen.findByTestId('cover-picker-item-a1'));
    expect(screen.getByTestId('value')).toHaveTextContent(
      'https://res.cloudinary.com/my-church/image/upload/v1/easter.jpg'
    );
  });

  it('cancels a running upload if the form goes away', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(uploadToCloudinary).mockImplementation((_f, _k, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    const user = picker();
    const { unmount } = renderThemed(<Harness />);
    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await screen.findByTestId('cover-progress');
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

describe('the form around the field', () => {
  it("shows the form's own message about the picture", () => {
    renderThemed(<Harness error="Logo URL is required." />);
    expect(screen.getByTestId('cover-field-error')).toHaveTextContent(
      'Logo URL is required.'
    );
  });

  it('tells the form when an upload starts and when it ends', async () => {
    const pending = deferred<UploadedAsset>();
    vi.mocked(uploadToCloudinary).mockReturnValue(pending.promise);
    const onBusyChange = vi.fn();
    const user = picker();
    renderThemed(<Harness onBusyChange={onBusyChange} />);

    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));

    await act(async () => {
      pending.resolve(UPLOADED);
    });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });

  it('is not left "busy" if it is removed from the page mid-upload', async () => {
    vi.mocked(uploadToCloudinary).mockReturnValue(new Promise(() => undefined));
    const onBusyChange = vi.fn();
    const user = picker();
    const { unmount } = renderThemed(<Harness onBusyChange={onBusyChange} />);

    await user.upload(
      screen.getByTestId('cover-input'),
      fileOf('cover.jpg', 'image/jpeg')
    );
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    unmount();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
});

describe('when the field is read-only', () => {
  it('shows the picture but offers nothing to change it, and no setup advice', () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
    renderThemed(<Harness initial="https://example.org/logo.png" disabled />);

    expect(screen.getByTestId('cover-preview')).toHaveAttribute(
      'src',
      'https://example.org/logo.png'
    );
    expect(screen.getByTestId('cover-library-button')).toBeDisabled();
    expect(screen.getByTestId('cover-remove')).toBeDisabled();
    // Setup instructions are for someone who can act on them.
    expect(screen.queryByTestId('cover-setup')).toBeNull();
    expect(screen.queryByTestId('cover-url-input')).toBeNull();
  });

  it('disables the upload button as well when uploading is set up', () => {
    renderThemed(<Harness initial="https://example.org/logo.png" disabled />);
    expect(screen.getByTestId('cover-upload-button')).toBeDisabled();
  });
});
