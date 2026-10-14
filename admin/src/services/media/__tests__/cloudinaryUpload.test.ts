import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UPLOAD_TIMEOUT_MS,
  UploadError,
  describeUploadError,
  mapCloudinaryError,
  parseUploadResponse,
  uploadToCloudinary,
  type UploadErrorCode,
} from '../cloudinaryUpload';
import { readCloudinaryConfig, type CloudinaryConfig } from '../cloudinaryConfig';

/**
 * A stand-in for XMLHttpRequest that records what was sent and lets a test
 * play Cloudinary's reply. It implements only the members the uploader
 * uses, so a new use of XHR shows up here as a failure.
 */
class FakeXhr {
  static instances: FakeXhr[] = [];
  method = '';
  url = '';
  body: FormData | null = null;
  timeout = 0;
  status = 0;
  responseText = '';
  aborted = false;
  upload: { onprogress: ((event: Record<string, unknown>) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }
}

const xhrFactory = () => new FakeXhr() as unknown as XMLHttpRequest;
const last = () => FakeXhr.instances[FakeXhr.instances.length - 1]!;

const CONFIG = readCloudinaryConfig({
  VITE_CLOUDINARY_CLOUD_NAME: 'my-church',
  VITE_CLOUDINARY_IMAGE_PRESET: 'maranatha_images',
  VITE_CLOUDINARY_AUDIO_PRESET: 'maranatha_audio',
});

const image = () => new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
const audio = () => new File(['x'], 'hymn.mp3', { type: 'audio/mpeg' });

const IMAGE_REPLY = {
  public_id: 'maranatha/images/abc123',
  version: 1700000000,
  resource_type: 'image',
  type: 'upload',
  format: 'jpg',
  bytes: 123456,
  width: 1600,
  height: 900,
  original_filename: 'cover',
  url: 'http://res.cloudinary.com/my-church/image/upload/v1/maranatha/images/abc123.jpg',
  secure_url:
    'https://res.cloudinary.com/my-church/image/upload/v1/maranatha/images/abc123.jpg',
};

const AUDIO_REPLY = {
  public_id: 'maranatha/audio/hymn1',
  resource_type: 'video',
  format: 'mp3',
  bytes: 4200000,
  duration: 187.4,
  is_audio: true,
  original_filename: 'hymn',
  secure_url:
    'https://res.cloudinary.com/my-church/video/upload/v1/maranatha/audio/hymn1.mp3',
};

beforeEach(() => {
  FakeXhr.instances = [];
});

function start(
  file: File,
  kind: 'image' | 'audio',
  extra: Parameters<typeof uploadToCloudinary>[2] = {}
) {
  return uploadToCloudinary(file, kind, { config: CONFIG, xhrFactory, ...extra });
}

describe('the request', () => {
  it('posts an image to the image endpoint with ONLY a file and a preset name', async () => {
    const promise = start(image(), 'image');
    const xhr = last();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('https://api.cloudinary.com/v1_1/my-church/image/upload');
    const keys = [...xhr.body!.keys()].sort();
    // No api_key, signature, timestamp, folder or public_id -- an unsigned
    // upload carries none of them, and sending one would be a mistake.
    expect(keys).toEqual(['file', 'upload_preset']);
    expect(xhr.body!.get('upload_preset')).toBe('maranatha_images');
    xhr.respond(200, IMAGE_REPLY);
    await promise;
  });

  it('posts AUDIO to the VIDEO endpoint, with the audio preset', async () => {
    const promise = start(audio(), 'audio');
    const xhr = last();
    expect(xhr.url).toBe('https://api.cloudinary.com/v1_1/my-church/video/upload');
    expect(xhr.body!.get('upload_preset')).toBe('maranatha_audio');
    xhr.respond(200, AUDIO_REPLY);
    await promise;
  });

  it('never sends a credential-shaped field, whatever the file is called', async () => {
    const promise = start(
      new File(['x'], 'api_secret.png', { type: 'image/png' }),
      'image'
    );
    const xhr = last();
    const names = [...xhr.body!.keys()];
    expect(names.some((name) => /secret|signature|api_key|timestamp/i.test(name))).toBe(
      false
    );
    xhr.respond(200, IMAGE_REPLY);
    await promise;
  });

  it('applies the default five-minute timeout, or the one given', async () => {
    const first = start(image(), 'image');
    expect(last().timeout).toBe(DEFAULT_UPLOAD_TIMEOUT_MS);
    last().respond(200, IMAGE_REPLY);
    await first;

    const second = start(image(), 'image', { timeoutMs: 1234 });
    expect(last().timeout).toBe(1234);
    last().respond(200, IMAGE_REPLY);
    await second;
  });
});

describe('progress', () => {
  it('reports whole percentages and holds 100 until Cloudinary has answered', async () => {
    const seen: number[] = [];
    const promise = start(image(), 'image', { onProgress: (p) => seen.push(p) });
    const xhr = last();
    xhr.progress(250, 1000);
    xhr.progress(999, 1000);
    xhr.progress(1000, 1000); // all bytes sent -- but not stored yet
    expect(seen).toEqual([25, 99, 99]);
    xhr.respond(200, IMAGE_REPLY);
    await promise;
    expect(seen[seen.length - 1]).toBe(100);
  });

  it('ignores progress events that cannot be turned into a percentage', async () => {
    const seen: number[] = [];
    const promise = start(image(), 'image', { onProgress: (p) => seen.push(p) });
    const xhr = last();
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 5, total: 10 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 0, total: 0 });
    expect(seen).toEqual([]);
    xhr.respond(200, IMAGE_REPLY);
    await promise;
  });
});

describe('a successful reply', () => {
  it('returns the validated image asset', async () => {
    const promise = start(image(), 'image');
    last().respond(200, IMAGE_REPLY);
    await expect(promise).resolves.toEqual({
      url: IMAGE_REPLY.secure_url,
      publicId: 'maranatha/images/abc123',
      resourceType: 'image',
      kind: 'image',
      format: 'jpg',
      bytes: 123456,
      width: 1600,
      height: 900,
      durationSeconds: null,
      originalFilename: 'cover',
    });
  });

  it('returns the audio asset with its duration', async () => {
    const promise = start(audio(), 'audio');
    last().respond(200, AUDIO_REPLY);
    const asset = await promise;
    expect(asset).toMatchObject({
      kind: 'audio',
      resourceType: 'video',
      durationSeconds: 187.4,
      format: 'mp3',
      width: null,
      height: null,
    });
  });

  it('stores the HTTPS address, never the http one Cloudinary also returns', async () => {
    const promise = start(image(), 'image');
    last().respond(200, IMAGE_REPLY);
    expect((await promise).url.startsWith('https://')).toBe(true);
  });
});

describe('a reply that cannot be trusted', () => {
  const cases: [string, 'image' | 'audio', unknown][] = [
    ['not JSON at all', 'image', '<html>oops</html>'],
    ['an empty object', 'image', {}],
    ['a missing secure_url', 'image', { ...IMAGE_REPLY, secure_url: undefined }],
    [
      'an http secure_url',
      'image',
      { ...IMAGE_REPLY, secure_url: 'http://res.cloudinary.com/x.jpg' },
    ],
    [
      'a javascript: address',
      'image',
      { ...IMAGE_REPLY, secure_url: 'javascript:alert(1)' },
    ],
    ['a missing public_id', 'image', { ...IMAGE_REPLY, public_id: '' }],
    ['audio stored as an image', 'audio', { ...AUDIO_REPLY, resource_type: 'image' }],
    ['an image reply to an audio upload', 'audio', IMAGE_REPLY],
  ];

  it.each(cases)('is rejected as bad_response: %s', async (_name, kind, body) => {
    const promise = start(kind === 'audio' ? audio() : image(), kind);
    last().respond(200, body);
    await expect(promise).rejects.toMatchObject({ code: 'bad_response' });
  });
});

describe('Cloudinary error replies', () => {
  const cases: [number, string, UploadErrorCode][] = [
    [400, 'Upload preset not found', 'preset_missing'],
    [400, 'Unknown upload preset maranatha_images', 'preset_missing'],
    [400, 'Upload preset must be whitelisted for unsigned uploads', 'preset_signed'],
    [401, 'Invalid cloud_name my-chruch', 'cloud_name'],
    [400, 'File size too large. Got 12582912. Maximum is 10485760.', 'too_large'],
    [413, 'Request entity too large', 'too_large'],
    [400, 'Invalid image file', 'format'],
    [400, 'Format svg not allowed', 'format'],
    [420, 'Rate Limit Exceeded', 'account_limit'],
    [429, 'Too many requests', 'account_limit'],
    [403, 'Account is disabled', 'account_limit'],
    [500, 'Something exploded', 'unknown'],
  ];

  it.each(cases)('maps %i "%s" to %s', async (status, message, code) => {
    const promise = start(image(), 'image');
    last().respond(status, { error: { message } });
    const error = (await promise.catch((e) => e)) as UploadError;
    expect(error).toBeInstanceOf(UploadError);
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    // Cloudinary's own words are kept for whoever is fixing the setup...
    expect(error.detail).toBe(message);
    // ...while the message is a sentence an administrator can act on.
    expect(error.message.length).toBeGreaterThan(20);
    expect(error.message).not.toContain('Cloudinary said');
  });

  it('still produces a sentence when the reply is not JSON', async () => {
    const promise = start(image(), 'image');
    last().respond(502, '<html>Bad gateway</html>');
    await expect(promise).rejects.toMatchObject({ code: 'unknown', status: 502 });
  });

  it('never throws from the mapper on odd input', () => {
    for (const body of [null, undefined, 5, 'x', [], { error: 3 }, { error: {} }]) {
      expect(mapCloudinaryError(400, body)).toBeInstanceOf(UploadError);
    }
  });
});

describe('failures on the way', () => {
  it('reports a network failure', async () => {
    const promise = start(image(), 'image');
    last().onerror?.();
    await expect(promise).rejects.toMatchObject({ code: 'network' });
  });

  it('reports a timeout', async () => {
    const promise = start(image(), 'image');
    last().ontimeout?.();
    await expect(promise).rejects.toMatchObject({ code: 'timeout' });
  });

  it('cancels when the signal aborts, and aborts the request', async () => {
    const controller = new AbortController();
    const promise = start(image(), 'image', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
    expect(last().aborted).toBe(true);
  });

  it('does not even open a request if the signal was already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      start(image(), 'image', { signal: controller.signal })
    ).rejects.toMatchObject({
      code: 'aborted',
    });
    expect(FakeXhr.instances).toHaveLength(0);
  });
});

describe('refusing to start', () => {
  it('rejects, without a request, when uploading is not configured', async () => {
    const missing: CloudinaryConfig = { status: 'missing', missing: ['x'] };
    await expect(start(image(), 'image', { config: missing })).rejects.toMatchObject({
      code: 'not_configured',
    });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('rejects an audio upload when only the image preset exists', async () => {
    const imageOnly = readCloudinaryConfig({
      VITE_CLOUDINARY_CLOUD_NAME: 'my-church',
      VITE_CLOUDINARY_IMAGE_PRESET: 'maranatha_images',
    });
    await expect(start(audio(), 'audio', { config: imageOnly })).rejects.toMatchObject({
      code: 'not_configured',
    });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('rejects an invalid file before sending a byte', async () => {
    await expect(
      start(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), 'image')
    ).rejects.toMatchObject({ code: 'invalid_file' });
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it('does not run when the configuration contains a secret', async () => {
    const leaked = readCloudinaryConfig({
      VITE_CLOUDINARY_CLOUD_NAME: 'my-church',
      VITE_CLOUDINARY_IMAGE_PRESET: 'maranatha_images',
      VITE_CLOUDINARY_API_SECRET: 'nope',
    });
    await expect(start(image(), 'image', { config: leaked })).rejects.toMatchObject({
      code: 'not_configured',
    });
    expect(FakeXhr.instances).toHaveLength(0);
  });
});

describe('small helpers', () => {
  it('describes any thrown value as a sentence', () => {
    expect(
      describeUploadError(new UploadError('network', 'Could not reach Cloudinary.'))
    ).toBe('Could not reach Cloudinary.');
    expect(describeUploadError(new Error('boom'))).toBe(
      'The upload did not work. Please try again.'
    );
    expect(describeUploadError('weird')).toBe(
      'The upload did not work. Please try again.'
    );
  });

  it('parseUploadResponse tolerates missing optional numbers', () => {
    expect(
      parseUploadResponse(
        {
          public_id: 'a',
          secure_url: 'https://res.cloudinary.com/x/image/upload/a.png',
          resource_type: 'image',
        },
        'image'
      )
    ).toMatchObject({ bytes: null, width: null, height: null, durationSeconds: null });
  });

  it('parseUploadResponse refuses anything that is not an object', () => {
    for (const body of [null, undefined, 'x', 3, [], true]) {
      expect(parseUploadResponse(body, 'image')).toBeNull();
    }
  });

  it('keeps the progress callback optional', async () => {
    const promise = start(image(), 'image');
    last().progress(10, 100);
    last().respond(200, IMAGE_REPLY);
    await expect(promise).resolves.toBeDefined();
  });

  it('is a plain Error subclass so it survives being rethrown', () => {
    const error = new UploadError('timeout', 'slow');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('UploadError');
  });
});
