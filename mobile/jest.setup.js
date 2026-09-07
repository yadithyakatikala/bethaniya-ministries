/**
 * Global Jest setup for the mobile app.
 *
 * AsyncStorage's real native module isn't present under Jest (no real
 * device/simulator), so every test that touches it (transitively, via
 * src/services/firebase/app.ts's getReactNativePersistence(AsyncStorage))
 * needs the official community mock instead -- see
 * @react-native-async-storage/async-storage's own Jest integration docs.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
