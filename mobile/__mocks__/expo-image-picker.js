/**
 * Manual Jest mock for 'expo-image-picker' -- same root-level, automatic
 * pattern as ./expo-audio.js (see its header comment for why this exists:
 * the real native module isn't present under Jest, and AppNavigator.tsx
 * imports ProfileScreen -- which imports this module -- so every test
 * that renders AppNavigator/App, not just ProfileScreen's own tests,
 * needs this mocked so the import itself doesn't throw).
 * ProfileScreen.test.tsx additionally declares its own
 * jest.mock('expo-image-picker', ...) to control per-test return values;
 * that per-file mock takes precedence over this one there.
 */
module.exports = {
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: null })
  ),
};
