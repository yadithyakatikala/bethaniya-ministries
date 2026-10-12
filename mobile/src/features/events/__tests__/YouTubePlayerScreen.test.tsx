import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { YouTubePlayerScreen } from '../YouTubePlayerScreen';
import { buildYouTubeEmbedUrl } from '../youtube';

jest.mock('../../../services/firebase/app');

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
async function renderScreen(youtubeUrl: string, title?: string) {
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <YouTubePlayerScreen
          navigation={{ goBack } as never}
          route={
            {
              key: 'YouTubePlayer',
              name: 'YouTubePlayer',
              params: { youtubeUrl, title },
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, goBack };
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

  it('names the event in the top bar, or says Watch live on YouTube when it was given none', async () => {
    const named = await renderScreen('https://youtu.be/dQw4w9WgXcQ', 'Sunday Worship');
    expect(named.getByText('Sunday Worship')).toBeTruthy();
    await named.unmount();

    const unnamed = await renderScreen('https://youtu.be/dQw4w9WgXcQ');
    expect(unnamed.getByText('Watch live on YouTube')).toBeTruthy();
  });

  it('leaves the player with the top bar Back', async () => {
    const { getByRole, goBack } = await renderScreen('https://youtu.be/dQw4w9WgXcQ');
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the top bar, and offers a way back to the event, when the link is not supported', async () => {
    const { getByText, getByTestId, getByRole, goBack } = await renderScreen(
      'https://example.com/not-youtube',
      'Sunday Worship'
    );
    expect(getByText('Sunday Worship')).toBeTruthy();
    expect(getByTestId('youtube-player-error')).toHaveTextContent(
      /isn’t a supported YouTube URL/
    );
    await fireEvent.press(getByRole('button', { name: 'Back to the event' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
