/**
 * Google Sign-In hook for the mobile app, built on expo-auth-session's
 * generic OAuth/OpenID Connect request/response machinery (the
 * Google-specific `expo-auth-session/providers/google` helper, not the
 * long-deprecated `expo-google-app-auth` package).
 *
 * Real Google Sign-In requires OAuth 2.0 Client IDs from Google Cloud
 * Console (a Console step this environment cannot perform -- every
 * accounts.google.com/googleapis.com endpoint is network-blocked here; see
 * SECURITY.md's "Known limitations"). Until EXPO_PUBLIC_GOOGLE_*_CLIENT_ID
 * env vars are set, `configured` is false and the caller should disable its
 * sign-in button rather than invoke `promptAsync` -- see googleAuthConfig.ts
 * for why the hook itself never throws in this state.
 */
import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import {
  PLACEHOLDER_GOOGLE_CLIENT_ID,
  getGoogleAuthConfig,
  isGoogleAuthConfigured,
} from '../../services/firebase/googleAuthConfig';
import { signInWithGoogleIdToken } from '../../services/firebase/authService';

export function useGoogleSignIn(onError: (error: unknown) => void) {
  const config = getGoogleAuthConfig();
  const configured = isGoogleAuthConfigured(config);

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
