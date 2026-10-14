import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ENV_AUDIO_PRESET,
  ENV_CLOUD_NAME,
  ENV_IMAGE_PRESET,
  describeUnavailable,
  getCloudinaryConfig,
  isUploadAvailable,
  presetFor,
  readCloudinaryConfig,
  resourceTypeFor,
  uploadEndpoint,
} from '../cloudinaryConfig';

const READY = {
  [ENV_CLOUD_NAME]: 'my-church',
  [ENV_IMAGE_PRESET]: 'maranatha_images',
  [ENV_AUDIO_PRESET]: 'maranatha_audio',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('reading the Cloudinary settings', () => {
  it('is ready with a cloud name and both presets', () => {
    expect(readCloudinaryConfig(READY)).toEqual({
      status: 'ready',
      cloudName: 'my-church',
      imagePreset: 'maranatha_images',
      audioPreset: 'maranatha_audio',
    });
  });

  it('is ready with only the image preset, and then audio is simply off', () => {
    const config = readCloudinaryConfig({
      [ENV_CLOUD_NAME]: 'my-church',
      [ENV_IMAGE_PRESET]: 'maranatha_images',
    });
    expect(config.status).toBe('ready');
    expect(isUploadAvailable(config, 'image')).toBe(true);
    expect(isUploadAvailable(config, 'audio')).toBe(false);
  });

  it('trims stray whitespace from pasted values', () => {
    const config = readCloudinaryConfig({
      [ENV_CLOUD_NAME]: '  my-church \n',
      [ENV_IMAGE_PRESET]: ' maranatha_images ',
    });
    expect(config).toMatchObject({ status: 'ready', cloudName: 'my-church' });
  });

  it('reports exactly which settings are missing when none are given', () => {
    const config = readCloudinaryConfig({});
    expect(config).toEqual({
      status: 'missing',
      missing: [ENV_CLOUD_NAME, `${ENV_IMAGE_PRESET} or ${ENV_AUDIO_PRESET}`],
    });
  });

  it('is missing when a cloud name is given but no preset', () => {
    const config = readCloudinaryConfig({ [ENV_CLOUD_NAME]: 'my-church' });
    expect(config.status).toBe('missing');
  });

  it('treats empty strings (a blank .env line) as missing, not as a value', () => {
    const config = readCloudinaryConfig({
      [ENV_CLOUD_NAME]: '',
      [ENV_IMAGE_PRESET]: '',
      [ENV_AUDIO_PRESET]: '',
    });
    expect(config.status).toBe('missing');
  });
});

describe('refusing wrong or dangerous values', () => {
  it('rejects a web address pasted as the cloud name, without repeating it', () => {
    const config = readCloudinaryConfig({
      ...READY,
      [ENV_CLOUD_NAME]: 'https://console.cloudinary.com/my-church',
    });
    expect(config.status).toBe('invalid');
    const text = JSON.stringify(config);
    expect(text).not.toContain('console.cloudinary.com');
  });

  it('rejects the whole `cloudinary://key:secret@name` line and never echoes it', () => {
    // An obviously fake line in the real shape. Built from parts so no
    // secret scanner mistakes the fixture for a leaked credential.
    const fakeKey = 'FAKE-KEY-NOT-REAL';
    const fakeSecret = 'FAKE-SECRET-NOT-REAL';
    const config = readCloudinaryConfig({
      ...READY,
      [ENV_CLOUD_NAME]: [
        'cloudinary:/',
        '/',
        fakeKey,
        ':',
        fakeSecret,
        '@my-church',
      ].join(''),
    });
    expect(config.status).toBe('invalid');
    const text = JSON.stringify(config);
    expect(text).not.toContain(fakeSecret);
    expect(text).not.toContain(fakeKey);
  });

  it('rejects an invalid cloud name and an invalid preset name', () => {
    expect(
      readCloudinaryConfig({ ...READY, [ENV_CLOUD_NAME]: 'My Church!' }).status
    ).toBe('invalid');
    expect(
      readCloudinaryConfig({ ...READY, [ENV_IMAGE_PRESET]: 'bad preset' }).status
    ).toBe('invalid');
  });

  it.each([
    'VITE_CLOUDINARY_API_SECRET',
    'VITE_CLOUDINARY_API_KEY',
    'VITE_CLOUDINARY_APIKEY',
    'VITE_CLOUDINARY_URL',
    'VITE_CLOUDINARY_PRIVATE_KEY',
    'VITE_CLOUDINARY_TOKEN',
    // The console labels these "API Key" and "API Secret", and people shorten
    // them; a bare KEY, a signature and a password are as exposed as the rest.
    'VITE_CLOUDINARY_SECRET',
    'VITE_CLOUDINARY_KEY',
    'VITE_CLOUDINARY_PUBLIC_KEY',
    'VITE_CLOUDINARY_SIGNATURE',
    'VITE_CLOUDINARY_PASSWORD',
  ])('switches uploading OFF when %s exists in the browser build', (name) => {
    const config = readCloudinaryConfig({ ...READY, [name]: 'sEcReT-123-do-not-print' });
    expect(config.status).toBe('invalid');
    if (config.status !== 'invalid') throw new Error('unreachable');
    // It names the variable so it can be removed...
    expect(config.problems.join(' ')).toContain(name);
    // ...and tells the operator to replace the exposed secret...
    expect(config.problems.join(' ')).toMatch(/new API secret/);
    // ...but never prints the value it found.
    expect(JSON.stringify(config)).not.toContain('sEcReT-123-do-not-print');
    // And uploading really is off, for both kinds.
    expect(isUploadAvailable(config, 'image')).toBe(false);
    expect(isUploadAvailable(config, 'audio')).toBe(false);
  });

  // Every VITE_ variable is published to every visitor, so one NAMED like a
  // secret is a mistake whoever's secret it is -- and a person who shortens
  // "Cloudinary" to "CLD" must not slip past the check.
  it.each([
    'VITE_API_SECRET',
    'VITE_CLD_SECRET',
    'VITE_CLD_API_SECRET',
    'VITE_CLOUD_API_SECRET',
    'VITE_SECRET',
  ])(
    'also switches uploading OFF when %s exists, whatever it is called after',
    (name) => {
      const config = readCloudinaryConfig({
        ...READY,
        [name]: 'sEcReT-123-do-not-print',
      });
      expect(config.status).toBe('invalid');
      if (config.status !== 'invalid') throw new Error('unreachable');
      expect(config.problems.join(' ')).toContain(name);
      expect(config.problems.join(' ')).toMatch(/replace the secret/);
      // It does not send someone to the Cloudinary console about a secret that
      // may not be Cloudinary's.
      expect(config.problems.join(' ')).not.toMatch(/Cloudinary console/);
      expect(JSON.stringify(config)).not.toContain('sEcReT-123-do-not-print');
      expect(isUploadAvailable(config, 'image')).toBe(false);
    }
  );

  it('leaves alone a secret-named variable the browser build can never contain', () => {
    // Vite publishes only VITE_ variables. Where the whole process environment
    // is passed in -- a test run on a machine that has its own SOME_SECRET --
    // a name like this is not a leak and must not switch uploading off.
    const config = readCloudinaryConfig({
      ...READY,
      CI_DEPLOY_SECRET: 'never-published',
      GITHUB_TOKEN_SECRET: 'never-published',
    });
    expect(config.status).toBe('ready');
  });

  it('does not mistake the legitimate variables, or unrelated ones, for secrets', () => {
    const config = readCloudinaryConfig({
      ...READY,
      BASE_URL: '/',
      MODE: 'production',
      DEV: false,
      PROD: true,
      SSR: false,
      VITE_FIREBASE_API_KEY: 'public-web-key',
      VITE_FIREBASE_APP_ID: '1:0:web:0',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
      VITE_FIREBASE_AUTH_DOMAIN: 'x.firebaseapp.com',
      VITE_USE_FIREBASE_EMULATORS: 'false',
      VITE_APP_ENV: 'production',
    });
    expect(config.status).toBe('ready');
  });
});

describe('what the settings are used for', () => {
  const ready = readCloudinaryConfig(READY);

  it('picks the preset for each kind', () => {
    expect(presetFor(ready, 'image')).toBe('maranatha_images');
    expect(presetFor(ready, 'audio')).toBe('maranatha_audio');
    expect(presetFor({ status: 'missing', missing: [] }, 'image')).toBeNull();
  });

  it('files audio under the VIDEO resource type, images under image', () => {
    expect(resourceTypeFor('image')).toBe('image');
    expect(resourceTypeFor('audio')).toBe('video');
  });

  it('builds the documented upload endpoint for each resource type', () => {
    expect(uploadEndpoint('my-church', 'image')).toBe(
      'https://api.cloudinary.com/v1_1/my-church/image/upload'
    );
    expect(uploadEndpoint('my-church', 'audio')).toBe(
      'https://api.cloudinary.com/v1_1/my-church/video/upload'
    );
  });

  it('explains an unavailable upload in plain words', () => {
    expect(describeUnavailable({ status: 'missing', missing: ['x'] }, 'image')).toMatch(
      /Image upload is not set up yet/
    );
    expect(describeUnavailable({ status: 'invalid', problems: ['x'] }, 'audio')).toMatch(
      /Audio upload is switched off/
    );
  });

  it("reads the running site's settings from Vite env variables", () => {
    vi.stubEnv(ENV_CLOUD_NAME, 'from-env');
    vi.stubEnv(ENV_IMAGE_PRESET, 'img_preset');
    expect(getCloudinaryConfig()).toMatchObject({
      status: 'ready',
      cloudName: 'from-env',
      imagePreset: 'img_preset',
      audioPreset: null,
    });
  });
});
