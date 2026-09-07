/**
 * A minimal, dependency-free ApplicationVerifier for Phone Authentication
 * against the local Firebase Auth Emulator.
 *
 * Background: signInWithPhoneNumber() requires an ApplicationVerifier --
 * firebase/auth's interface for "prove this is a real client, not a bot",
 * normally satisfied by RecaptchaVerifier, a browser/WebView-hosted reCAPTCHA
 * challenge. The React Native build of the Firebase JS SDK does not export
 * RecaptchaVerifier at all -- confirmed by inspecting the actual bundled
 * runtime: node_modules/@firebase/auth/dist/rn/index.js exports
 * PhoneAuthProvider and signInWithPhoneNumber, but no RecaptchaVerifier
 * (RecaptchaVerifier is a browser-only DOM implementation). The community
 * package that normally fills this gap on Expo, expo-firebase-recaptcha,
 * pulls in an outdated expo-firebase-core -> nested expo-constants ->
 * {xmldom, semver, uuid, xml2js} dependency chain with multiple real
 * HIGH-severity npm audit findings (XML injection, ReDoS, prototype
 * pollution) as of this writing (`npm audit` on this repo: 4 high +
 * 13 moderate with it installed, vs. 10 pre-existing moderate without it) --
 * unacceptable given this project's "no unnecessary dependencies" /
 * quality-over-speed principles, especially for a dependency that would ship
 * in the real app bundle. It was installed, audited, and then deliberately
 * removed during Day 2 rather than accepted; see SECURITY.md.
 *
 * ApplicationVerifier itself is a tiny, generic interface (see
 * node_modules/@firebase/auth/dist/auth-public.d.ts):
 *   interface ApplicationVerifier { readonly type: string; verify(): Promise<string> }
 * Reading the SDK's actual bundled source (@firebase/auth's
 * injectRecaptchaV2Token / _verifyPhoneNumber) shows .verify() is only ever
 * called when the connected project has reCAPTCHA Enterprise phone-provider
 * protection enabled server-side -- a real-project Console setting this
 * repo's dev project does not have -- and the Auth Emulator does not enforce
 * any reCAPTCHA check at all for phone sign-in. That makes this stub
 * sufficient for emulator-based development and testing: the SDK proceeds
 * straight to the emulator's sendVerificationCode call without ever needing
 * a real token.
 *
 * THIS IS EMULATOR-ONLY. It is intentionally not a real bot-abuse defense and
 * must never be used against a real (non-emulator) Firebase backend --
 * getPhoneApplicationVerifier() throws if called outside emulator mode. Real
 * (production) Phone Authentication needs either a maintained
 * RecaptchaVerifier-equivalent for Expo/React Native or reCAPTCHA Enterprise,
 * neither of which is implemented -- see SECURITY.md's "Known limitations."
 */
import type { ApplicationVerifier } from 'firebase/auth';
import { usingFirebaseEmulators } from './app';

class EmulatorApplicationVerifier implements ApplicationVerifier {
  readonly type = 'recaptcha';

  async verify(): Promise<string> {
    // Never validated against anything in emulator mode -- see module doc above.
    return 'emulator-phone-auth-not-verified-by-recaptcha';
  }
}

/**
 * Returns an ApplicationVerifier suitable for the *current* environment.
 * Throws if called while not connected to the Firebase Emulator Suite, since
 * no real-provider verifier is implemented yet (see module doc).
 */
export function getPhoneApplicationVerifier(): ApplicationVerifier {
  if (!usingFirebaseEmulators) {
    throw new Error(
      'Phone sign-in against a real (non-emulator) Firebase backend is not yet ' +
        'implemented -- no real ApplicationVerifier (reCAPTCHA) is wired up. ' +
        'See the "Known limitations" section of SECURITY.md.'
    );
  }
  return new EmulatorApplicationVerifier();
}
