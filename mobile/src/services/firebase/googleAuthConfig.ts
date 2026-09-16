/**
 * Google Sign-In OAuth client configuration.
 *
 * Real values come from OAuth 2.0 Client IDs created in Google Cloud Console
 * for the SAME project as the Firebase config -- a Console step that cannot
 * be performed from this repository (and every accounts.google.com /
 * googleapis.com endpoint is network-blocked from the development sandbox;
 * see SECURITY.md's "Known limitations"). Creating them costs nothing:
 * OAuth clients and Firebase Authentication are both available on the free
 * Spark plan and need no billing account.
 *
 * WHY THE PLATFORM MATTERS -- this was a real bug, found and fixed during
 * the V1 production-readiness audit. expo-auth-session's Google provider
 * does NOT treat these four values as interchangeable. Reading the
 * installed source (node_modules/expo-auth-session/build/providers/Google.js,
 * `useAuthRequest`), it resolves exactly one of them by platform and then
 * falls back to the generic `clientId`:
 *
 *     Platform.select({ ios: 'iosClientId',
 *                       android: 'androidClientId',
 *                       default: 'webClientId' })
 *     ?? config.clientId
 *
 * `isGoogleAuthConfigured()` used to return true if ANY of the four was
 * set. So a build carrying only EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID -- the
 * value Firebase Console surfaces most prominently, and therefore the
 * easiest one to set on its own -- reported itself as configured and
 * enabled the button, while on Android the provider resolved
 * PLACEHOLDER_GOOGLE_CLIENT_ID and would have sent
 * `client_id=not-configured...` to Google. The functions below now mirror
 * the provider's own resolution, so "configured" means configured *for the
 * platform actually running*.
 */
import { Platform } from 'react-native';

export interface GoogleAuthEnvConfig {
  /** Generic fallback client id, used for any platform without a more specific one below. */
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
}

/** The three buckets expo-auth-session's Platform.select() collapses to. */
export type GoogleAuthPlatform = 'ios' | 'android' | 'web';

export function getGoogleAuthConfig(): GoogleAuthEnvConfig {
  return {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  };
}

/** Which bucket the current runtime falls into. Anything that is neither
 * iOS nor Android takes the provider's `default:` branch, i.e. the web
 * client id. */
export function currentGoogleAuthPlatform(): GoogleAuthPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * The client id expo-auth-session will actually use, resolved exactly the
 * way it resolves it. `undefined` means this platform has no usable client
 * id, and Google Sign-In cannot work here whatever the other three hold.
 */
export function resolveGoogleClientId(
  config: GoogleAuthEnvConfig,
  platform: GoogleAuthPlatform = currentGoogleAuthPlatform()
): string | undefined {
  const platformSpecific =
    platform === 'ios'
      ? config.iosClientId
      : platform === 'android'
        ? config.androidClientId
        : config.webClientId;
  return platformSpecific ?? config.clientId;
}

/** True only when the *running* platform has a real client id to use. */
export function isGoogleAuthConfigured(
  config: GoogleAuthEnvConfig,
  platform: GoogleAuthPlatform = currentGoogleAuthPlatform()
): boolean {
  const resolved = resolveGoogleClientId(config, platform);
  return Boolean(resolved) && resolved !== PLACEHOLDER_GOOGLE_CLIENT_ID;
}

/**
 * expo-auth-session's useIdTokenAuthRequest throws synchronously if the
 * client id resolved for the current platform is `undefined`
 * (`invariantClientId` in its ProviderUtils), and Hooks must still be
 * called unconditionally even when no real OAuth credentials are
 * configured. This inert, obviously-fake value is passed as the generic
 * fallback `clientId` in that case. It is never a valid Google OAuth
 * client, and isGoogleAuthConfigured() treats it as unconfigured, so the
 * Google button is not rendered at all in that state -- there is no code
 * path that sends this value to Google.
 */
export const PLACEHOLDER_GOOGLE_CLIENT_ID = 'not-configured.apps.googleusercontent.com';
