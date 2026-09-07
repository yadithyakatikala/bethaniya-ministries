import React from 'react';
import { render } from '@testing-library/react-native';
import { YouTubePlayerScreen } from '../YouTubePlayerScreen';
import { buildYouTubeEmbedUrl } from '../youtube';

/**
 * react-native-webview is mocked at the root (mobile/__mocks__/react-native-webview.js)
 * -- see that file's doc comment for why (it throws at import time under
 * Jest without a native module, same failure class as expo-audio in
 * Day 6). The mock renders a plain View exposing `source.uri` as its
 * accessibilityLabel, which is how these tests read back the exact URL
 * this screen asked the WebView to load, without needing a real WebView.
 *
 * SCOPE NOTE: these tests prove YouTubePlayerScreen resolves the correct
 * official embed URL and hands it to a WebView. They do NOT prove a real
 * WebView on a real device actually renders/plays that stream -- see this
 * screen's own doc comment for why that's a separate, manual, real-device
 * verification item.
 */
async function renderScreen(youtubeUrl: string) {
  return await render(
    <YouTubePlayerScreen
      navigation={{} as never}
      route={
        { key: 'YouTubePlayer', name: 'YouTubePlayer', params: { youtubeUrl } } as never
      }
    />
  );
}

describe('YouTubePlayerScreen', () => {
  it('renders a WebView pointed at the official embed URL for a supported YouTube URL', async () => {
    const { getByTestId } = await renderScreen('https://youtu.be/dQw4w9WgXcQ');
    const webview = getByTestId('youtube-webview');
    expect(webview.props.accessibilityLabel).toBe(buildYouTubeEmbedUrl('dQw4w9WgXcQ'));
  });

  it('resolves a youtube.com/watch URL to the same embed URL', async () => {
    const { getByTestId } = await renderScreen(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    const webview = getByTestId('youtube-webview');
    expect(webview.props.accessibilityLabel).toBe(buildYouTubeEmbedUrl('dQw4w9WgXcQ'));
  });

  it('shows a graceful error, without crashing, for an unparseable/unsupported URL', async () => {
    const { getByTestId, queryByTestId } = await renderScreen(
      'https://example.com/not-youtube'
    );
    expect(getByTestId('youtube-player-error')).toBeTruthy();
    expect(queryByTestId('youtube-webview')).toBeNull();
  });

  it('shows a graceful error, without crashing, for an empty URL', async () => {
    const { getByTestId } = await renderScreen('');
    expect(getByTestId('youtube-player-error')).toBeTruthy();
  });
});
