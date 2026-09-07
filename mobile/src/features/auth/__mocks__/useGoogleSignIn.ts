/**
 * Manual mock for useGoogleSignIn -- the real hook calls into
 * expo-auth-session, which needs a real Expo manifest/URI scheme
 * (via expo-constants/expo-linking) to build its redirect URI. That isn't
 * available under plain Jest, so every test that renders SignInScreen
 * (directly or via App) mocks this hook at the module boundary instead of
 * fighting Expo's config-resolution machinery in tests. Opt in per test file
 * with `jest.mock('.../useGoogleSignIn')`.
 */
export const useGoogleSignIn = jest.fn(() => ({
  configured: false,
  canPrompt: false,
  promptAsync: jest.fn(),
}));
