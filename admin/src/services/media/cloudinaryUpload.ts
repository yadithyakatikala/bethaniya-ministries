/**
 * Uploading one file to Cloudinary from the browser, with progress.
 *
 * =====================================================================
 * HOW IT WORKS
 * =====================================================================
 * One POST of `multipart/form-data` to
 *
 *   https://api.cloudinary.com/v1_1/<cloud name>/<resource type>/upload
 *
 * carrying exactly two fields: `file`, and `upload_preset` (the name of an
 * UNSIGNED preset). No API key, no signature, no secret -- an unsigned
 * upload has none, and this module could not add one without a server.
 *
 * It uses XMLHttpRequest rather than `fetch` for one reason: `fetch` cannot
 * report upload progress, and a progress bar is the difference between a
 * 20 MB song that is uploading and one that has frozen.
 *
 * AUDIO IS A VIDEO. Cloudinary files audio under the `video` resource
 * type -- the endpoint above for audio ends in `/video/upload`, and the
 * reply says `resource_type: "video"`. That mapping lives in
 * ./cloudinaryConfig.ts (resourceTypeFor) and is asserted in the tests; a
 * request to `/image/upload` with an MP3 is rejected by Cloudinary.
 *
 * WHAT THE REPLY IS TRUSTED FOR. Nothing is taken on faith: the reply must
 * be JSON, carry an https `secure_url` and a `public_id`, and name the
 * resource type this upload asked for. Anything else is an error, not a
 * half-filled record.
 *
 * Every failure is reported as an UploadError with a `code` the screen can
 * branch on and a `message` that says what to DO, in words an
 * administrator (not a developer) can act on. Cloudinary's own wording is
 * kept in `detail` for whoever has to fix the setup.
 */
import {
  describeUnavailable,
  getCloudinaryConfig,
  presetFor,
  resourceTypeFor,
  uploadEndpoint,
  type CloudinaryConfig,
  type UploadKind,
} from './cloudinaryConfig';
import { validateUploadFile } from './uploadRules';
import type { UploadedAsset } from './types';

export type UploadErrorCode =
  | 'not_configured'
  | 'invalid_file'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'cloud_name'
  | 'preset_missing'
  | 'preset_signed'
  | 'too_large'
  | 'format'
  | 'account_limit'
  | 'bad_response'
  | 'unknown';

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  /** Cloudinary's own message, for whoever is fixing the setup. */
  readonly detail: string | null;
  readonly status: number | null;

  constructor(
    code: UploadErrorCode,
    message: string,
    options: { detail?: string | null; status?: number | null } = {}
  ) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.detail = options.detail ?? null;
    this.status = options.status ?? null;
  }
}

export interface UploadOptions {
  /** Whole percent, 0 to 100, as the bytes leave the browser. */
  onProgress?: (percent: number) => void;
  /** Aborting rejects with code `aborted`. */
  signal?: AbortSignal;
  config?: CloudinaryConfig;
  xhrFactory?: () => XMLHttpRequest;
  /** Default five minutes: 25 MB over a slow office connection. */
  timeoutMs?: number;
}

export const DEFAULT_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The validated asset in a success reply, or null if the reply is not one. */
export function parseUploadResponse(
  body: unknown,
  kind: UploadKind
): UploadedAsset | null {
  if (!isRecord(body)) return null;
  const secureUrl = body.secure_url;
  const publicId = body.public_id;
  if (typeof secureUrl !== 'string' || typeof publicId !== 'string' || !publicId) {
    return null;
  }
  try {
    if (new URL(secureUrl).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  // The reply must say it stored what we asked it to: image as image,
  // audio as video.
  if (body.resource_type !== resourceTypeFor(kind)) return null;

  return {
    url: secureUrl,
    publicId,
    resourceType: resourceTypeFor(kind),
    kind,
    format: stringOrNull(body.format),
    bytes: numberOrNull(body.bytes),
    width: numberOrNull(body.width),
    height: numberOrNull(body.height),
    durationSeconds: numberOrNull(body.duration),
    originalFilename: stringOrNull(body.original_filename),
  };
}

/**
 * Turns an error reply into an UploadError. Matching is on Cloudinary's
 * wording, so it is deliberately forgiving (substrings, any case) and
 * falls back to a generic sentence rather than to nothing.
 */
export function mapCloudinaryError(status: number, body: unknown): UploadError {
  const raw =
    isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
      ? body.error.message
      : null;
  const text = (raw ?? '').toLowerCase();
  const options = { detail: raw, status };

  if (
    /preset.*(not found|unknown|invalid)|unknown upload preset|upload preset not found/.test(
      text
    )
  ) {
    return new UploadError(
      'preset_missing',
      'Cloudinary does not know the upload preset this site is using. Ask whoever set up uploads to check the preset name against Settings > Upload > Upload presets in Cloudinary.',
      options
    );
  }
  if (/whitelisted|unsigned|signed/.test(text) && /preset/.test(text)) {
    return new UploadError(
      'preset_signed',
      'The upload preset is set to "Signed", so it cannot be used from this site. In Cloudinary, edit the preset and set its Signing mode to "Unsigned".',
      options
    );
  }
  if (
    /cloud_name|cloud name/.test(text) ||
    (status === 401 && /invalid|unknown/.test(text))
  ) {
    return new UploadError(
      'cloud_name',
      'Cloudinary does not recognise the cloud name this site is using. Ask whoever set up uploads to check it against the Cloudinary dashboard.',
      options
    );
  }
  if (status === 413 || /too large|file size|exceeds? the (maximum|limit)/.test(text)) {
    return new UploadError(
      'too_large',
      'That file is larger than Cloudinary will accept for this account. Choose a smaller file.',
      options
    );
  }
  if (
    /format|not allowed|invalid (image|video) file|unsupported|invalid extension/.test(
      text
    )
  ) {
    return new UploadError(
      'format',
      'Cloudinary would not accept that kind of file. Check that it is a normal image or audio file and try again.',
      options
    );
  }
  if (
    status === 420 ||
    status === 429 ||
    /rate limit|quota|account.*(disabled|suspended|blocked)|limit.*exceeded|exceeded.*limit/.test(
      text
    )
  ) {
    return new UploadError(
      'account_limit',
      'Cloudinary is not accepting uploads right now. The account may have used up its free allowance or hit a rate limit. Check usage in the Cloudinary dashboard, or try again later.',
      options
    );
  }
  return new UploadError(
    'unknown',
    'The upload did not work. Please try again; if it keeps failing, tell whoever manages this site.',
    options
  );
}

export function uploadToCloudinary(
  file: File,
  kind: UploadKind,
  options: UploadOptions = {}
): Promise<UploadedAsset> {
  const config = options.config ?? getCloudinaryConfig();
  const preset = presetFor(config, kind);

  if (config.status !== 'ready' || preset === null) {
    return Promise.reject(
      new UploadError('not_configured', describeUnavailable(config, kind))
    );
  }

  // The screens validate first; doing it again here means a caller that
  // forgot to is still stopped before a byte is sent.
  const problem = validateUploadFile(file, kind);
  if (problem) return Promise.reject(new UploadError('invalid_file', problem));

  if (options.signal?.aborted) {
    return Promise.reject(new UploadError('aborted', 'The upload was cancelled.'));
  }

  const cloudName = config.cloudName;
  const makeXhr = options.xhrFactory ?? (() => new XMLHttpRequest());

  return new Promise<UploadedAsset>((resolve, reject) => {
    const xhr = makeXhr();
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', preset);

    xhr.open('POST', uploadEndpoint(cloudName, kind));
    xhr.timeout = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;

    const onAbortSignal = () => xhr.abort();
    options.signal?.addEventListener('abort', onAbortSignal, { once: true });
    const cleanup = () => options.signal?.removeEventListener('abort', onAbortSignal);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return;
      // The last percent is held back until Cloudinary has replied: the
      // bytes are sent, but the file is not stored until it answers.
      options.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      cleanup();
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const asset = parseUploadResponse(body, kind);
        if (!asset) {
          reject(
            new UploadError(
              'bad_response',
              'Cloudinary replied, but not in the form this site expected. Please try again.',
              { status: xhr.status }
            )
          );
          return;
        }
        options.onProgress?.(100);
        resolve(asset);
        return;
      }
      reject(mapCloudinaryError(xhr.status, body));
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        new UploadError(
          'network',
          'Could not reach Cloudinary. Check your internet connection and try again.'
        )
      );
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(
        new UploadError(
          'timeout',
          'The upload took too long and was stopped. Try again, or choose a smaller file.'
        )
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new UploadError('aborted', 'The upload was cancelled.'));
    };

    xhr.send(form);
  });
}

/** A sentence for any error thrown while uploading. */
export function describeUploadError(error: unknown): string {
  if (error instanceof UploadError) return error.message;
  return 'The upload did not work. Please try again.';
}
