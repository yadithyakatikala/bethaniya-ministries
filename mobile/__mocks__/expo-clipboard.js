/**
 * Manual Jest mock for 'expo-clipboard' -- same root-level pattern as
 * ./expo-audio.js and ./expo-notifications.js, applied automatically to
 * every test with no jest.mock() call needed.
 *
 * The real module needs the native clipboard, which does not exist under
 * Jest. Resolving rather than rejecting is what lets the reader's copy
 * tests assert the "copied" confirmation; a test that needs the failure
 * path overrides this with mockRejectedValueOnce().
 */
export const setStringAsync = jest.fn(() => Promise.resolve(true));
export const getStringAsync = jest.fn(() => Promise.resolve(''));
