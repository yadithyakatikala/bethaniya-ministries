/**
 * What may be uploaded, checked in the browser before a single byte is sent.
 *
 * =====================================================================
 * THIS IS A COURTESY, NOT A DEFENCE
 * =====================================================================
 * Everything here runs in the visitor's own browser, so anyone who skips
 * the admin site and posts to Cloudinary directly skips these checks too.
 * They exist so a mistake (a 40 MB WAV, a PDF in the image box) is caught
 * in a sentence, in under a second, instead of after a slow upload fails.
 *
 * The REAL limits are the ones set on the Cloudinary upload preset
 * (allowed formats, an incoming transformation) and the account's own
 * plan limits. See docs/admin/MEDIA_UPLOADS.md for the exact settings.
 * Nothing in this file may be described as "securing" uploads.
 *
 * CLOUDINARY'S FREE PLAN CEILINGS, as published on its pricing and
 * plan-comparison pages when this was written: 10 MB per image, 100 MB per
 * video (audio counts as video), 10 MB per raw file. The limits below are
 * deliberately well under those, because a church feed does not need a
 * 100 MB song and every megabyte is later delivered to every member who
 * opens it (the free plan's bandwidth is part of the same 25 credits).
 */
import type { UploadKind } from './cloudinaryConfig';

export const MB = 1024 * 1024;

/** The free plan's own ceilings -- ours must stay under them. */
export const CLOUDINARY_FREE_IMAGE_MAX_BYTES = 10 * MB;
export const CLOUDINARY_FREE_VIDEO_MAX_BYTES = 100 * MB;

/**
 * Images: the four formats every phone and browser draws. SVG is
 * deliberately absent -- it can carry script -- as are BMP, TIFF and
 * HEIC, which Android cannot show.
 */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
/** Same 5 MB the Firebase Storage rule used to enforce. */
export const IMAGE_MAX_BYTES = 5 * MB;

/**
 * Audio: the formats both Android and iOS play natively. OGG, Opus and
 * FLAC are left out on purpose -- iOS will not play OGG, and a lossless
 * file is several times the size a hymn needs.
 */
export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav'] as const;
export const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/x-aac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
] as const;
export const AUDIO_MAX_BYTES = 25 * MB;

export interface UploadLimits {
  kind: UploadKind;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maxBytes: number;
  /** The word used in messages: "image" / "audio file". */
  noun: string;
  /** For a message: "JPEG, PNG, WebP or GIF". */
  formatsLabel: string;
}

export const UPLOAD_LIMITS: Record<UploadKind, UploadLimits> = {
  image: {
    kind: 'image',
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    maxBytes: IMAGE_MAX_BYTES,
    noun: 'image',
    formatsLabel: 'JPEG, PNG, WebP or GIF',
  },
  audio: {
    kind: 'audio',
    extensions: AUDIO_EXTENSIONS,
    mimeTypes: AUDIO_MIME_TYPES,
    maxBytes: AUDIO_MAX_BYTES,
    noun: 'audio file',
    formatsLabel: 'MP3, M4A, AAC or WAV',
  },
};

/** Value for an `<input type="file" accept>`: extensions and MIME types. */
export function acceptAttribute(kind: UploadKind): string {
  const limits = UPLOAD_LIMITS[kind];
  return [...limits.mimeTypes, ...limits.extensions.map((ext) => `.${ext}`)].join(',');
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** "4.2 MB", "812 KB". Whole kilobytes under a megabyte. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB`;
}

/** "3:07", "12:45", "1:02:09". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Why this file cannot be uploaded, as a sentence for the administrator,
 * or `null` when it can.
 *
 * The type is judged by the file NAME's extension first -- browsers
 * disagree about the MIME type of an .m4a, and some report none at all --
 * and the MIME type is only used to catch a file whose name lies (a
 * `photo.jpg` that is really a video). An empty MIME type is accepted.
 */
export function validateUploadFile(file: File, kind: UploadKind): string | null {
  const limits = UPLOAD_LIMITS[kind];

  if (file.size === 0) {
    return `That ${limits.noun} is empty.`;
  }

  const extension = fileExtension(file.name);
  if (!limits.extensions.includes(extension)) {
    return kind === 'image'
      ? `Please choose a ${limits.formatsLabel} image.`
      : `Please choose an audio file in ${limits.formatsLabel} format.`;
  }

  if (file.type) {
    const mime = file.type.toLowerCase();
    const matchesFamily =
      kind === 'image'
        ? mime.startsWith('image/')
        : mime.startsWith('audio/') || mime === 'video/mp4';
    const listed = (limits.mimeTypes as readonly string[]).includes(mime);
    if (!matchesFamily || (kind === 'image' && !listed)) {
      return kind === 'image'
        ? `Please choose a ${limits.formatsLabel} image.`
        : `That does not look like an audio file. Please choose ${limits.formatsLabel}.`;
    }
  }

  if (file.size >= limits.maxBytes) {
    const mb = limits.maxBytes / MB;
    return kind === 'image'
      ? `Image must be smaller than ${mb} MB.`
      : `Audio must be smaller than ${mb} MB. Try saving it as an MP3.`;
  }

  return null;
}
