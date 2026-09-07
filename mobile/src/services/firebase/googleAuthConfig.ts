/**
 * Google Sign-In OAuth client configuration.
 *
 * Real values come from a project registered in Google Cloud Console (OAuth
 * consent screen + OAuth 2.0 Client IDs for iOS/Android/Web) -- Console
 * configuration this environment cannot perform on your behalf (every
 * accounts.google.com / googleapis.com endpoint is network-blocked from this
 * sandbox; see SECURITY.md's "Known limitations"). Until real client IDs are
 * supplied via these env vars, the sign-in button renders but stays disabled
 * with an explanatory message -- see SignInScreen.tsx.
 */

export interface GoogleAuthEnvConfig {
  /** Generic/Expo-proxy fallback client id, used for any platform without a more specific one below. */
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
}

export function getGoogleAuthConfig(): GoogleAuthEnvConfig {
  return {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  };
}

export function isGoogleAuthConfigured(config: GoogleAuthEnvConfig): boolean {
  return Boolean(
    config.clientId || config.iosClientId || config.androidClientId || config.webClientId
  );
}

/**
 * expo-auth-session's useIdTokenAuthRequest throws synchronously if the
 * client id resolved for the current platform is `undefined` -- Hooks must
 * still be called unconditionally even when no real OAuth credentials are
 * configured, so this inert, obviously-fake value is passed as the generic
 * fallback `clientId` in that case. It is never a valid Google OAuth client,
 * so pressing "Continue with Google" while unconfigured cannot reach Google
 * at all -- see isGoogleAuthConfigured(), which gates the button itself.
 */
export const PLACEHOLDER_GOOGLE_CLIENT_ID = 'not-configured.apps.googleusercontent.com';
