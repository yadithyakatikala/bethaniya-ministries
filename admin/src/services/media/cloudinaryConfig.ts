/**
 * Where the admin site finds its Cloudinary upload settings, and how it
 * refuses to run when they are wrong.
 *
 * =====================================================================
 * WHAT IS, AND IS NOT, IN THE BROWSER
 * =====================================================================
 * The site uploads with an UNSIGNED UPLOAD PRESET. That needs exactly two
 * kinds of value, and neither is a secret:
 *
 *   VITE_CLOUDINARY_CLOUD_NAME     the account's name, as it appears in
 *                                  every delivery URL it serves
 *   VITE_CLOUDINARY_IMAGE_PRESET   the name of an unsigned preset limited
 *   VITE_CLOUDINARY_AUDIO_PRESET   to images / to audio (either may be
 *                                  left out to turn that kind off)
 *
 * They are baked into the published JavaScript, so anyone who can open the
 * site can read them. That is how unsigned uploading works, and it is why
 * ../../../../docs/admin/MEDIA_UPLOADS.md spends a section on what a
 * stranger could do with them and how to limit it. Hiding the upload
 * button behind the admin login does NOT make the Cloudinary endpoint
 * private -- the endpoint is Cloudinary's, not this site's.
 *
 * THE API SECRET MUST NEVER APPEAR HERE. Any variable Vite exposes to the
 * browser is public, so a secret placed in one is published. This module
 * therefore looks at the NAMES of the variables it was given (never their
 * values) and, if one looks like a Cloudinary secret or key, refuses to
 * enable uploading at all and says why. That turns a silent leak into a
 * loud, early failure on the first page load.
 *
 * Nothing in this file reads, logs or returns a value it did not validate,
 * and no error message ever echoes a value back: a mistaken paste of the
 * whole `cloudinary://key:secret@name` line must not be repeated on screen.
 */

export type UploadKind = 'image' | 'audio';

export type CloudinaryConfig =
  | {
      status: 'ready';
      cloudName: string;
      /** null when this kind of upload is not set up. */
      imagePreset: string | null;
      audioPreset: string | null;
    }
  | { status: 'missing'; missing: string[] }
  | { status: 'invalid'; problems: string[] };

export const ENV_CLOUD_NAME = 'VITE_CLOUDINARY_CLOUD_NAME';
export const ENV_IMAGE_PRESET = 'VITE_CLOUDINARY_IMAGE_PRESET';
export const ENV_AUDIO_PRESET = 'VITE_CLOUDINARY_AUDIO_PRESET';

/** Cloudinary cloud names are lowercase letters, digits, hyphens and underscores. */
const CLOUD_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;
const PRESET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * A variable NAME that suggests a Cloudinary credential. Matched on the
 * name only. `API_KEY` is included: unsigned uploading never needs one, and
 * a key alongside a leaked secret completes the pair.
 */
const SECRET_NAME_PATTERN =
  /cloudinary.*(secret|api[_-]?key|private|token)|cloudinary[_-]?url/i;

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * Whether a value looks like something other than a bare name: a URL, a
 * `key:secret@name` string, or anything with characters a name never has.
 * Used only to choose a more helpful message -- the value is not echoed.
 */
function looksLikeCredentialOrUrl(value: string): boolean {
  return /[:@/\s]/.test(value);
}

export function readCloudinaryConfig(
  env: Record<string, string | boolean | undefined>
): CloudinaryConfig {
  const problems: string[] = [];

  // 1. A secret in the browser bundle is the worst possible configuration.
  const secretNames = Object.keys(env).filter((name) => SECRET_NAME_PATTERN.test(name));
  for (const name of secretNames) {
    problems.push(
      `${name} looks like a Cloudinary secret or key. Anything starting with VITE_ is ` +
        'published to every visitor. Remove it from your .env files and, because it has ' +
        'been exposed, create a new API secret in the Cloudinary console. Unsigned ' +
        'uploading needs only the cloud name and an unsigned preset name.'
    );
  }

  const asString = (name: string): string | undefined => {
    const raw = env[name];
    return typeof raw === 'string' ? raw : undefined;
  };

  const cloudName = clean(asString(ENV_CLOUD_NAME));
  const imagePreset = clean(asString(ENV_IMAGE_PRESET));
  const audioPreset = clean(asString(ENV_AUDIO_PRESET));

  const missing: string[] = [];
  if (!cloudName) missing.push(ENV_CLOUD_NAME);
  if (!imagePreset && !audioPreset) {
    missing.push(`${ENV_IMAGE_PRESET} or ${ENV_AUDIO_PRESET}`);
  }

  if (cloudName) {
    if (looksLikeCredentialOrUrl(cloudName)) {
      problems.push(
        `${ENV_CLOUD_NAME} must be only the cloud name (for example "my-church"), not a ` +
          'web address or a connection string.'
      );
    } else if (!CLOUD_NAME_PATTERN.test(cloudName)) {
      problems.push(
        `${ENV_CLOUD_NAME} is not a valid cloud name. Cloud names use lowercase letters, ` +
          'digits, hyphens and underscores.'
      );
    }
  }
  for (const [name, value] of [
    [ENV_IMAGE_PRESET, imagePreset],
    [ENV_AUDIO_PRESET, audioPreset],
  ] as const) {
    if (value && !PRESET_PATTERN.test(value)) {
      problems.push(
        `${name} is not a valid upload preset name. Use the name exactly as shown in ` +
          'Cloudinary under Settings > Upload > Upload presets.'
      );
    }
  }

  if (problems.length > 0) return { status: 'invalid', problems };
  if (missing.length > 0) return { status: 'missing', missing };

  return {
    status: 'ready',
    cloudName,
    imagePreset: imagePreset || null,
    audioPreset: audioPreset || null,
  };
}

/** The configuration for the running site. */
export function getCloudinaryConfig(): CloudinaryConfig {
  return readCloudinaryConfig(
    import.meta.env as Record<string, string | boolean | undefined>
  );
}

/** The preset for one kind of upload, or null if that kind is not set up. */
export function presetFor(config: CloudinaryConfig, kind: UploadKind): string | null {
  if (config.status !== 'ready') return null;
  return kind === 'image' ? config.imagePreset : config.audioPreset;
}

/** Whether an upload of this kind can be attempted right now. */
export function isUploadAvailable(config: CloudinaryConfig, kind: UploadKind): boolean {
  return presetFor(config, kind) !== null;
}

/**
 * Cloudinary stores audio as a VIDEO resource: an audio file is a video
 * with no picture, uploaded to the `video` endpoint. Sending it to
 * `image` fails. This one mapping is the only place that fact lives.
 */
export function resourceTypeFor(kind: UploadKind): 'image' | 'video' {
  return kind === 'image' ? 'image' : 'video';
}

export function uploadEndpoint(cloudName: string, kind: UploadKind): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}/${resourceTypeFor(kind)}/upload`;
}

/** The sentence an administrator sees when uploading is not ready. */
export function describeUnavailable(config: CloudinaryConfig, kind: UploadKind): string {
  const noun = kind === 'image' ? 'Image' : 'Audio';
  if (config.status === 'invalid') {
    return `${noun} upload is switched off because the Cloudinary settings are wrong.`;
  }
  if (config.status === 'missing') {
    return `${noun} upload is not set up yet.`;
  }
  return `${noun} upload is not set up yet. The ${kind} upload preset has not been added.`;
}
