/**
 * Google Sign-In hook for the mobile app, built on expo-auth-session's
 * generic OAuth/OpenID Connect request/response machinery (the
 * Google-specific `expo-auth-session/providers/google` helper, not the
 * long-deprecated `expo-google-app-auth` package).
 *
 * Real Google Sign-In requires OAuth 2.0 Client IDs from Google Cloud
 * Console (a Console step this environment cannot perform -- every
 * accounts.google.com/googleapis.com endpoint is network-blocked here; see
 * SECURITY.md's "Known limitations"). `configured` is false until a client
 * id exists for the *running platform* -- see googleAuthConfig.ts, which
 * mirrors the provider's own platform-specific resolution, and for why the
 * hook itself never throws in this state. Callers must not render a
 * sign-in affordance at all when `configured` is false: a release build
 * has no business showing a button that cannot work.
 *
 * On Android and iOS this runs the authorization-code + PKCE flow, not the
 * implicit id_token flow. Confirmed by reading the installed provider
 * source (node_modules/expo-auth-session/build/providers/Google.js):
 * `useIdTokenAuthRequest` only requests `ResponseType.IdToken` when
 * `Platform.OS === 'web'`; on a native build it leaves responseType
 * undefined, `useAuthRequest` then selects `ResponseType.Code`, and its
 * `shouldAutoExchangeCode` effect exchanges the code at
 * oauth2.googleapis.com and surfaces the id token as
 * `response.params.id_token`. That is the value Firebase needs, so the
 * read below is correct on every platform -- but it arrives one render
 * later than the raw redirect, which is why this is an effect on
 * `response` rather than something read from promptAsync()'s return.
 */
import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import {
  PLACEHOLDER_GOOGLE_CLIENT_ID,
  currentGoogleAuthPlatform,
  getGoogleAuthConfig,
  isGoogleAuthConfigured,
} from '../../services/firebase/googleAuthConfig';
import { signInWithGoogleIdToken } from '../../services/firebase/authService';
import { isDevBuild } from '../../services/firebase/app';

export function useGoogleSignIn(onError: (error: unknown) => void) {
  const config = getGoogleAuthConfig();
  const configured = isGoogleAuthConfigured(config);

  useEffect(() => {
    // A release build with no Google client id for this platform is a
    // packaging mistake, not a supported state: Google Sign-In is a V1
    // requirement. Shout once so it shows up in `adb logcat`/Xcode console
    // rather than silently presenting a sign-in screen with one provider
    // missing. Same rationale as assertProductionConfigSane() in
    // services/firebase/app.ts.
    if (!configured && !isDevBuild()) {
      console.error(
        '[auth:google] RELEASE BUILD HAS NO GOOGLE OAUTH CLIENT ID for platform ' +
          `"${currentGoogleAuthPlatform()}". "Continue with Google" is hidden. Set ` +
          'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (and/or the ios/web variants) ' +
          'and make sure the env file reached this build -- see .env.example.'
      );
    }
  }, [configured]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: config.clientId ?? PLACEHOLDER_GOOGLE_CLIENT_ID,
    iosClientId: config.iosClientId,
    androidClientId: config.androidClientId,
    webClientId: config.webClientId,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        signInWithGoogleIdToken(idToken).catch(onError);
      } else {
        onError(new Error('Google sign-in did not return an id token.'));
      }
    } else if (
      response.type === 'error' ||
      response.type === 'cancel' ||
      response.type === 'dismiss'
    ) {
      onError(response);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return {
    configured,
    canPrompt: configured && Boolean(request),
    promptAsync,
  };
}
