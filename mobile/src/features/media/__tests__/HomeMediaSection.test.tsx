import React from 'react';
import { Text } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { collection, getDocs, limit } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { HomeMediaSection } from '../HomeMediaSection';

jest.mock('../../../services/firebase/app');

/**
 * Home's media strip. Its whole job is to be SMALL: a few thumbnails, a
 * way into the real feed, and nothing at all when there is nothing to
 * show -- Home already carries two devotional blocks, a reading plan and
 * the next event, and a full feed dropped into the middle would bury all
 * of them.
 */
const Stack = createNativeStackNavigator();

function FeedStub() {
  return <Text testID="media-feed-stub">feed</Text>;
}

function DetailStub() {
  return <Text testID="media-detail-stub">detail</Text>;
}

function mediaDoc(id: string, partial: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      type: 'image',
      mediaUrl: `https://example.org/${id}.jpg`,
      caption: `Caption ${id}`,
      published: true,
      publishAt: new Date('2026-04-01T00:00:00Z'),
      authorName: 'Pastor',
      ...partial,
    }),
  };
}

async function renderSection() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeMediaSection} />
            <Stack.Screen name="MediaFeed" component={FeedStub} />
            <Stack.Screen name="MediaDetail" component={DetailStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));
});

afterEach(async () => {
  await cleanup();
});

describe('the Home media strip', () => {
  it('shows the newest posts and a way into the full feed', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a'), mediaDoc('b')] });
    const screen = await renderSection();

    await waitFor(() => expect(screen.getByTestId('home-media-section')).toBeTruthy());
    expect(screen.getByTestId('home-media-a')).toBeTruthy();
    expect(screen.getByTestId('home-media-b')).toBeTruthy();
  });

  it('asks for a HANDFUL, not a feed', async () => {
    // Home must stay cheap to open.
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a')] });
    await renderSection();

    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(limit).toHaveBeenCalledWith(3);
  });

  it('renders NOTHING when the church has posted nothing', async () => {
    // Not an empty card, not a placeholder -- nothing. Home's container
    // uses `gap`, so an empty wrapper would still leave a band of
    // unexplained whitespace.
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    const screen = await renderSection();

    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(screen.queryByTestId('home-media-section')).toBeNull();
  });

  it('renders nothing when the read fails, rather than an error on Home', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const screen = await renderSection();

    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(screen.queryByTestId('home-media-section')).toBeNull();
  });

  it('opens the full feed from "See all"', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a')] });
    const screen = await renderSection();
    await waitFor(() => expect(screen.getByTestId('home-media-section')).toBeTruthy());

    await fireEvent.press(screen.getByText('See all'));

    await waitFor(() => expect(screen.getByTestId('media-feed-stub')).toBeTruthy());
  });

  it('opens a post directly from a thumbnail', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a')] });
    const screen = await renderSection();
    await waitFor(() => expect(screen.getByTestId('home-media-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('home-media-a'));

    await waitFor(() => expect(screen.getByTestId('media-detail-stub')).toBeTruthy());
  });
});
