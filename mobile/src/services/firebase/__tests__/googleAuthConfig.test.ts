/**
 * Tests for ../googleAuthConfig.ts.
 *
 * This module had NO test coverage until the V1 production-readiness audit,
 * and the gap hid a real bug: isGoogleAuthConfigured() returned true if ANY
 * of the four EXPO_PUBLIC_GOOGLE_*_CLIENT_ID values was set, while
 * expo-auth-session resolves exactly ONE of them by platform. A build
 * carrying only the web client id therefore advertised Google Sign-In as
 * available and enabled the button, but on Android had no usable client id
 * at all. See that module's header comment for the provider source this
 * mirrors.
 *
 * Every case below pins the platform explicitly rather than relying on
 * whichever Platform.OS the Jest preset happens to report, so the
 * platform-specific resolution is genuinely covered in all three
 * directions.
 */
import {
  PLACEHOLDER_GOOGLE_CLIENT_ID,
  getGoogleAuthConfig,
  isGoogleAuthConfigured,
  resolveGoogleClientId,
} from '../googleAuthConfig';

const ANDROID_ID = '111-android.apps.googleusercontent.com';
const IOS_ID = '222-ios.apps.googleusercontent.com';
const WEB_ID = '333-web.apps.googleusercontent.com';
const GENERIC_ID = '444-generic.apps.googleusercontent.com';

describe('resolveGoogleClientId', () => {
  it('prefers the platform-specific id on android', () => {
    expect(
      resolveGoogleClientId(
        { androidClientId: ANDROID_ID, iosClientId: IOS_ID, webClientId: WEB_ID },
        'android'
      )
    ).toBe(ANDROID_ID);
  });

  it('prefers the platform-specific id on ios', () => {
    expect(
      resolveGoogleClientId(
        { androidClientId: ANDROID_ID, iosClientId: IOS_ID, webClientId: WEB_ID },
        'ios'
      )
    ).toBe(IOS_ID);
  });

  it('uses the web id for anything that is neither ios nor android', () => {
    expect(
      resolveGoogleClientId(
        { androidClientId: ANDROID_ID, iosClientId: IOS_ID, webClientId: WEB_ID },
        'web'
      )
    ).toBe(WEB_ID);
  });

  it('falls back to the generic clientId when the platform-specific one is unset', () => {
    expect(resolveGoogleClientId({ clientId: GENERIC_ID }, 'android')).toBe(GENERIC_ID);
    expect(resolveGoogleClientId({ clientId: GENERIC_ID }, 'ios')).toBe(GENERIC_ID);
    expect(resolveGoogleClientId({ clientId: GENERIC_ID }, 'web')).toBe(GENERIC_ID);
  });

  it('does NOT substitute another platform’s id', () => {
    // The whole point: a web-only configuration leaves android with nothing.
    expect(resolveGoogleClientId({ webClientId: WEB_ID }, 'android')).toBeUndefined();
    expect(resolveGoogleClientId({ androidClientId: ANDROID_ID }, 'ios')).toBeUndefined();
  });
});

describe('isGoogleAuthConfigured', () => {
  it('is true when the running platform has its own client id', () => {
    expect(isGoogleAuthConfigured({ androidClientId: ANDROID_ID }, 'android')).toBe(true);
  });

  it('is true when only the generic fallback is set', () => {
    expect(isGoogleAuthConfigured({ clientId: GENERIC_ID }, 'android')).toBe(true);
  });

  it('is FALSE on android when only the web client id is set -- the regression this file exists for', () => {
    // Previously returned true, enabling a button that could never work.
    expect(isGoogleAuthConfigured({ webClientId: WEB_ID }, 'android')).toBe(false);
  });

  it('is false for an entirely empty config', () => {
    expect(isGoogleAuthConfigured({}, 'android')).toBe(false);
    expect(isGoogleAuthConfigured({}, 'ios')).toBe(false);
    expect(isGoogleAuthConfigured({}, 'web')).toBe(false);
  });

  it('treats the inert placeholder as unconfigured', () => {
    // Otherwise the placeholder that only exists to stop
    // expo-auth-session's invariantClientId() from throwing would itself
    // look like a valid configuration.
    expect(
      isGoogleAuthConfigured({ clientId: PLACEHOLDER_GOOGLE_CLIENT_ID }, 'android')
    ).toBe(false);
  });
});

describe('getGoogleAuthConfig', () => {
  const ENV_KEYS = [
    'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  ] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    ENV_KEYS.forEach((key) => {
      original[key] = process.env[key];
      delete process.env[key];
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  });

  it('reads each client id from its own environment variable', () => {
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ANDROID_ID;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = WEB_ID;

    expect(getGoogleAuthConfig()).toEqual({
      clientId: undefined,
      iosClientId: undefined,
      androidClientId: ANDROID_ID,
      webClientId: WEB_ID,
    });
  });

  it('normalises an empty-string env var to undefined, not ""', () => {
    // An empty value in a .env file must not read as "configured".
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = '';
    expect(getGoogleAuthConfig().androidClientId).toBeUndefined();
    expect(isGoogleAuthConfigured(getGoogleAuthConfig(), 'android')).toBe(false);
  });
});
