import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import type { ReactElement } from 'react';
import { theme } from '../../../theme/theme';
import {
  readCloudinaryConfig,
  type CloudinaryConfig,
} from '../../../services/media/cloudinaryConfig';
import type { UploadedAsset } from '../../../services/media/types';

export const READY: CloudinaryConfig = readCloudinaryConfig({
  VITE_CLOUDINARY_CLOUD_NAME: 'my-church',
  VITE_CLOUDINARY_IMAGE_PRESET: 'maranatha_images',
  VITE_CLOUDINARY_AUDIO_PRESET: 'maranatha_audio',
});

export const MISSING: CloudinaryConfig = readCloudinaryConfig({});

export const INVALID: CloudinaryConfig = readCloudinaryConfig({
  VITE_CLOUDINARY_CLOUD_NAME: 'my-church',
  VITE_CLOUDINARY_IMAGE_PRESET: 'maranatha_images',
  VITE_CLOUDINARY_API_SECRET: 'do-not-print',
});

/** What Cloudinary reports for a successful image upload. Not a real file. */
export const UPLOADED_IMAGE: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/image/upload/v1/maranatha/photo.jpg',
  publicId: 'maranatha/photo',
  resourceType: 'image',
  kind: 'image',
  format: 'jpg',
  bytes: 120_000,
  width: 800,
  height: 600,
  durationSeconds: null,
  originalFilename: 'photo',
};

/** What Cloudinary reports for a successful audio upload (a `video` resource). */
export const UPLOADED_AUDIO: UploadedAsset = {
  url: 'https://res.cloudinary.com/my-church/video/upload/v1/maranatha/hymn.mp3',
  publicId: 'maranatha/hymn',
  resourceType: 'video',
  kind: 'audio',
  format: 'mp3',
  bytes: 3_400_000,
  width: null,
  height: null,
  durationSeconds: 187,
  originalFilename: 'hymn',
};

export function renderThemed(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

/** A File that reports a given size without allocating that many bytes. */
export function fileOf(name: string, type: string, size = 2048): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
