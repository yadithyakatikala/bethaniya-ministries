import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { CommunityListScreen } from '../CommunityListScreen';
import type { RootStackParamList } from '../../../navigation/AppNavigator';
import { subscribeToPublishedCommunityPosts } from '../../../services/firebase/communityPosts';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/communityPosts');

/**
 * Community -- the church's social AREA.
 *
 * A tester reported Community and Church chat as "the same feature". The
 * screens were never the same code, but on a new church BOTH were an
 * empty centred sentence, and from the outside that is one feature listed
 * twice.
 *
 * What these tests defend is the distinction a member can actually see:
 * Community is its own screen, it does not open the chat, and it still
 * tells you where the church family is when nobody has posted anything.
 */
// Typed, so the stub navigator type-checks the screen's own route props
// instead of widening them to ParamListBase.
const Stack = createNativeStackNavigator<RootStackParamList>();

function ChatStub() {
  return <Text testID="chat-stub">Chat stub</Text>;
}

function MediaStub() {
  return <Text testID="media-stub">Media stub</Text>;
}

function PostDetailStub() {
  return <Text testID="post-detail-stub">Post detail stub</Text>;
}

function deliverPosts(posts: unknown[]) {
  (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation((onNext) => {
    onNext(posts);
    return jest.fn();
  });
}

function renderCommunity() {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <PreferencesProvider>
          <Stack.Navigator>
            <Stack.Screen name="CommunityList" component={CommunityListScreen} />
            <Stack.Screen name="CommunityChat" component={ChatStub} />
            <Stack.Screen name="MediaFeed" component={MediaStub} />
            <Stack.Screen name="CommunityPostDetail" component={PostDetailStub} />
          </Stack.Navigator>
        </PreferencesProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Community is not the chat', () => {
  it('does not open the chat by itself', async () => {
    deliverPosts([]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-list')).toBeTruthy());
    // Opening Community must not land a member in Church chat.
    expect(screen.queryByTestId('chat-stub')).toBeNull();
    expect(screen.queryByTestId('chat-input')).toBeNull();
  });

  it('offers the chat as a named destination, with a sentence about it', async () => {
    deliverPosts([]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-open-chat')).toBeTruthy());
    expect(screen.getByText('Talk with the whole church')).toBeTruthy();
  });

  it('goes to the chat only when that destination is pressed', async () => {
    deliverPosts([]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-open-chat')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('community-open-chat'));
    await waitFor(() => expect(screen.getByTestId('chat-stub')).toBeTruthy());
  });

  it('also leads to the photo and video feed', async () => {
    deliverPosts([]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-open-media')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('community-open-media'));
    await waitFor(() => expect(screen.getByTestId('media-stub')).toBeTruthy());
  });
});

describe('with no posts yet', () => {
  it('is still a usable screen rather than one empty sentence', async () => {
    // The actual reported problem: a blank screen that could have been
    // any feature. It now says what it is and where to go.
    deliverPosts([]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-empty')).toBeTruthy());

    expect(screen.getByText('Everything the church family shares, in one place.'))
      .toBeTruthy();
    expect(screen.getByTestId('community-open-chat')).toBeTruthy();
    expect(screen.getByTestId('community-open-media')).toBeTruthy();
  });
});

describe('with posts', () => {
  const post = {
    id: 'p1',
    title: 'A testimony',
    content: 'What the Lord has done.',
    imageUrl: null,
    createdAt: new Date('2026-03-01T09:00:00Z'),
  };

  it('lists them under the church heading', async () => {
    deliverPosts([post]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-post-p1')).toBeTruthy());
    expect(screen.getByText('A testimony')).toBeTruthy();
    expect(screen.getByText('From the church')).toBeTruthy();
  });

  it('opens a post, not the chat', async () => {
    deliverPosts([post]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-post-p1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('community-post-p1'));
    await waitFor(() => expect(screen.getByTestId('post-detail-stub')).toBeTruthy());
  });

  it('keeps the destinations available above them', async () => {
    deliverPosts([post]);
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-post-p1')).toBeTruthy());
    expect(screen.getByTestId('community-open-chat')).toBeTruthy();
  });
});

describe('when the posts cannot be read', () => {
  it('says so without taking the rest of the area away', async () => {
    (subscribeToPublishedCommunityPosts as jest.Mock).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'unavailable' });
        return jest.fn();
      }
    );
    const screen = await renderCommunity();
    await waitFor(() => expect(screen.getByTestId('community-error')).toBeTruthy());
    // The chat and the media feed do not depend on this read.
    expect(screen.getByTestId('community-open-chat')).toBeTruthy();
  });
});
