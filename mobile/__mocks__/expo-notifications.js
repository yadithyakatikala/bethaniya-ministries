/**
 * Manual Jest mock for 'expo-notifications' -- same root-level, automatic
 * pattern as ./expo-audio.js and ./expo-image-picker.js (see
 * ./expo-audio.js's header comment for why this exists). App.tsx mounts
 * ../src/services/notifications/notificationService.ts's
 * useNotificationListeners() hook, which imports this module, so every
 * test that renders App (not just notificationService's own tests) needs
 * this mocked so the import/registration doesn't throw or hit a native
 * module that isn't present under Jest.
 * notificationService.test.ts additionally declares its own
 * jest.mock('expo-notifications', ...) to control per-test return
 * values/verify calls; that per-file mock takes precedence over this one
 * there.
 */
module.exports = {
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    })
  ),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    })
  ),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
};
