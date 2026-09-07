/**
 * Manual Jest mock for 'react-native-webview' -- same automatic-node-module-mock
 * pattern as ./expo-audio.js and ./firebase/*.js (a root-level __mocks__
 * file applied to every test with no jest.mock() call needed).
 *
 * react-native-webview's real native module isn't present under Jest (no
 * real device/simulator) -- confirmed empirically (Day 7) that it throws
 * `Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'RNCWebViewModule'
 * could not be found` at *import* time, the same failure class expo-audio
 * has (see expo-audio.js's doc comment) -- so every test whose module
 * graph reaches YouTubePlayerScreen.tsx needs this mocked, not just tests
 * that exercise it directly.
 *
 * The mock component is a real React component (not a bare jest.fn(), so
 * it can actually render as a child and be found by react-test-renderer/
 * React Testing Library queries) that renders nothing but exposes its
 * received props (notably `source.uri`, the resolved YouTube embed URL)
 * via a testID so tests can assert on exactly what URL would have been
 * loaded -- see YouTubePlayerScreen.test.tsx. This mock only proves the
 * app *asked* the WebView to load a given URL; it says nothing about
 * whether a real WebView would actually render/play it -- that is a
 * manual, real-device verification item (see YouTubePlayerScreen.tsx's
 * doc comment).
 */
const React = require('react');
const { View } = require('react-native');

function WebView(props) {
  return React.createElement(View, {
    testID: props.testID || 'mock-webview',
    accessibilityLabel: props.source && props.source.uri ? props.source.uri : undefined,
  });
}

module.exports = { WebView };
module.exports.default = WebView;
