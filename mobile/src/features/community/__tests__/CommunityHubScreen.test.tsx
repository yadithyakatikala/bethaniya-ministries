import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { CommunityHubScreen } from '../CommunityHubScreen';

jest.mock('../../../services/firebase/app');
// The feed is tested on its own; here it only has to be given the hub's header.
jest.mock('../../updates/UpdatesFeed', () => {
  const { View, Text: T } = jest.requireActual('react-native');
  return {
    UpdatesFeed: ({ header }: { header?: React.ReactNode }) => (
      <View testID="feed-stub">
        {header}
        <T>The feed</T>
      </View>
    ),
  };
});
jest.mock('../CommunityChatScreen', () => {
  const { Text: T } = jest.requireActual('react-native');
  return { CommunityChatScreen: () => <T testID="chat-stub">The chat</T> };
});

/**
 * Community: ONE destination for the church family -- Updates (what the
 * church says, with the shelf to Events, Songs and Photos and videos) and
 * Chat (what the church says to itself). A tester reported "Community" and
 * "Church chat" as the same feature; they are the two tabs of one place now.
 */
function ui(tab?: 'updates' | 'chat') {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <CommunityHubScreen
          navigation={{} as never}
          route={
            {
              key: 'CommunityHub',
              name: 'CommunityHub',
              params: tab ? { tab } : undefined,
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

describe('CommunityHubScreen', () => {
  it('offers Updates and Chat as two tabs, Updates chosen', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('community-hub')).toBeTruthy();
    expect(getByTestId('community-tabs').props.accessibilityRole).toBe('tablist');
    expect(getByTestId('community-tabs-updates').props.accessibilityLabel).toBe(
      'Updates'
    );
    expect(getByTestId('community-tabs-chat').props.accessibilityLabel).toBe('Chat');
    expect(getByTestId('community-tabs-updates').props.accessibilityState.selected).toBe(
      true
    );
    expect(getByTestId('community-tabs-chat').props.accessibilityState.selected).toBe(
      false
    );
  });

  it('shows the feed first, and only the feed: the chat is not opened by itself', async () => {
    const { getByTestId, queryByTestId } = await render(ui());
    expect(getByTestId('feed-stub')).toBeTruthy();
    expect(queryByTestId('chat-stub')).toBeNull();
  });

  it('hands the feed its title and tabs, so they scroll away with the list', async () => {
    const { getByTestId, getByText } = await render(ui());
    // Inside the feed, not beside it.
    expect(getByTestId('feed-stub')).toContainElement(getByText('Community'));
    expect(getByTestId('feed-stub')).toContainElement(getByTestId('community-tabs'));
    expect(getByText('Community').props.accessibilityRole).toBe('header');
  });

  it('opens on the chat when the route asks for it (Home’s "Church chat" row)', async () => {
    const { getByTestId, queryByTestId } = await render(ui('chat'));
    expect(getByTestId('chat-stub')).toBeTruthy();
    expect(queryByTestId('feed-stub')).toBeNull();
    expect(getByTestId('community-tabs-chat').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('keeps the title and tabs FIXED above the chat: its message box needs the rest', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(ui('chat'));
    expect(getByText('Community')).toBeTruthy();
    expect(getByTestId('community-tabs')).toBeTruthy();
    // They are not inside any feed.
    expect(queryByTestId('feed-stub')).toBeNull();
  });

  it('switches on a tap, mounting only the view in front', async () => {
    const { getByTestId, queryByTestId } = await render(ui());
    await fireEvent.press(getByTestId('community-tabs-chat'));
    expect(getByTestId('chat-stub')).toBeTruthy();
    expect(queryByTestId('feed-stub')).toBeNull();

    await fireEvent.press(getByTestId('community-tabs-updates'));
    expect(getByTestId('feed-stub')).toBeTruthy();
    expect(queryByTestId('chat-stub')).toBeNull();
  });

  it('moves to the chat when navigated to again asking for it', async () => {
    const { getByTestId, rerender } = await render(ui());
    await rerender(ui('chat'));
    await waitFor(() => expect(getByTestId('chat-stub')).toBeTruthy());
  });

  it('is titled and tabbed in Telugu in a Telugu interface', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await render(ui());
    await waitFor(() =>
      expect(getByTestId('community-tabs-updates').props.accessibilityLabel).toMatch(
        /[ఀ-౿]/u
      )
    );
    expect(getByTestId('community-tabs-chat').props.accessibilityLabel).toMatch(/[ఀ-౿]/u);
  });
});
