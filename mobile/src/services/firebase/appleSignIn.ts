/**
 * Apple Sign-In.
 *
 * expo-apple-authentication wraps Apple's native "Sign in with Apple" sheet --
 * it is iOS-only and requires a native/custom-dev-client build (it does NOT
 * work in Expo Go) plus a real Apple Developer Program account with the
 * "Sign In with Apple" capability enabled for this app's bundle id, none of
 * which exist in this environment (see SECURITY.md's "Known limitations").
 * The functions below implement the real architecture regardless, so the
 * only missing piece for real-device verification is that external
 * configuration -- not application code.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { UserCredential } from 'firebase/auth';
import { signInWithAppleIdentityToken } from './authService';

/** Apple Sign-In is only ever possible on iOS, and only when the OS/device supports it. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Runs the native Apple sign-in sheet and exchanges the resulting identity
 * token for a Firebase session. The raw (unhashed) nonce is generated here
 * and sent to Firebase alongside the identity token, which Apple's identity
 * token itself contains a hash of -- this is Apple + Firebase's standard
 * replay-protection mechanism for native Sign In with Apple.
 */
export async function signInWithApple(): Promise<UserCredential> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    // Not a user-facing message -- toFriendlyAuthMessage() maps this to the
    // generic fallback, since this indicates a broken/misconfigured Apple
    // sign-in setup rather than anything the user did.
    throw new Error('Apple sign-in did not return an identity token.');
  }

  return signInWithAppleIdentityToken(credential.identityToken, rawNonce);
}
