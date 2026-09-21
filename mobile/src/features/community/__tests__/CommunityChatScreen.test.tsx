import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { CommunityChatScreen } from '../CommunityChatScreen';
import { sendMessage } from '../../../services/firebase/communityChat';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/communityChat', () => {
  const actual = jest.requireActual('../../../services/firebase/communityChat');
  return {
    ...actual,
    subscribeToRecentMessages: jest.fn(),
    fetchOlderMessages: jest.fn(),
    sendMessage: jest.fn(async () => undefined),
    deleteOwnMessage: jest.fn(async () => undefined),
  };
});
jest.mock('../../../services/firebase/reports', () => ({
  ...jest.requireActual('../../../services/firebase/reports'),
  fetchReportedItemKeys: jest.fn(async () => new Set<string>()),
}));

const chat = jest.requireMock('../../../services/firebase/communityChat') as {
  subscribeToRecentMessages: jest.Mock;
};

/**
 * The church chat screen.
 *
 * The empty state is the reason this file exists. A tester photographed
 * it rendering UPSIDE DOWN in the release build: the list is `inverted`,
 * which React Native implements as a 180-degree transform on the scroll
 * view, and `ListEmptyComponent` inherits it like any other child.
 *
 * The fix was structural -- the empty state is no longer inside the
 * inverted list at all -- so the test is structural too: it asserts that
 * nothing wrapping the empty text carries a rotation or a scale flip,
 * which is what a counter-rotating workaround would have left behind.
 */
function deliver(messages: unknown[], oldest: unknown = null) {
  chat.subscribeToRecentMessages.mockImplementation(
    (onNext: (m: unknown[], o: unknown) => void) => {
      onNext(messages, oldest);
      return jest.fn();
    }
  );
}

function message(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    text: `message ${id}`,
    authorUid: 'member-2',
    authorName: 'Asha',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    removed: false,
    ...overrides,
  };
}

function renderChat() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <CommunityChatScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

/** Every transform on every node between the root and `node`'s style. */
function transformsIn(tree: unknown): unknown[] {
  const found: unknown[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const element = node as { props?: { style?: unknown }; children?: unknown[] };
    const style = StyleSheet.flatten(element.props?.style) as
      | { transform?: unknown }
      | undefined;
    if (style?.transform) found.push(style.transform);
    for (const child of element.children ?? []) walk(child);
  };
  walk(tree);
  return found;
}

beforeEach(() => {
  jest.clearAllMocks();
  (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  // Signed in, so the composer is enabled -- useMemberIdentity() gates
  // `canPost` on there being a member at all.
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'member-1', displayName: 'Asha', email: null, phoneNumber: null });
    return jest.fn();
  });
});

describe('the empty chat', () => {
  it('shows the empty state', async () => {
    deliver([]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-empty')).toBeTruthy());
    expect(screen.getByText('No messages yet')).toBeTruthy();
    expect(screen.getByText('Say hello to the church family.')).toBeTruthy();
  });

  it('renders it OUTSIDE the inverted list, so nothing is upside down', async () => {
    // The bug: ListEmptyComponent inside an inverted FlatList inherits
    // the list's 180-degree transform.
    deliver([]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-empty')).toBeTruthy());

    // The list itself is not mounted at all when there is nothing to
    // show, which is what removes the transform rather than cancelling it.
    expect(screen.queryByTestId('chat-list')).toBeNull();
    expect(screen.getByTestId('chat-empty-wrap')).toBeTruthy();
    expect(transformsIn(screen.toJSON())).toEqual([]);
  });

  it('keeps the composer, so the screen is still usable', async () => {
    deliver([]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-empty')).toBeTruthy());
    expect(screen.getByTestId('chat-input')).toBeTruthy();
    expect(screen.getByTestId('chat-send')).toBeTruthy();
  });

  it('still sends from the empty state', async () => {
    deliver([]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-input')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Hello church');
    await fireEvent.press(screen.getByTestId('chat-send'));

    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect((sendMessage as jest.Mock).mock.calls[0][0].text).toBe('Hello church');
  });
});

describe('the chat with messages', () => {
  it('uses the inverted list, so the newest sits at the bottom', async () => {
    deliver([message('c1')]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-list')).toBeTruthy());
    expect(screen.getByTestId('chat-list').props.inverted).toBe(true);
    expect(screen.queryByTestId('chat-empty')).toBeNull();
  });

  it('shows the message', async () => {
    deliver([message('c1', { text: 'Good morning church' })]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByText('Good morning church')).toBeTruthy());
  });
});
