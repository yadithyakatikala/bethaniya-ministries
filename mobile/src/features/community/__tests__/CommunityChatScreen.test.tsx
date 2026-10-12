import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { CommunityChatScreen } from '../CommunityChatScreen';
import {
  deleteOwnMessage,
  fetchOlderMessages,
  sendMessage,
} from '../../../services/firebase/communityChat';
import { lightTokens } from '../../../theme/tokens';

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

describe('runs of messages', () => {
  // The data is newest-first, as the listener delivers it.
  it('names a person once, on the first message of their run, and again after somebody else speaks', async () => {
    deliver([
      message('c4', { authorUid: 'member-2', authorName: 'Asha' }),
      message('c3', { authorUid: 'member-2', authorName: 'Asha' }),
      message('c2', { authorUid: 'member-3', authorName: 'Daniel' }),
      message('c1', { authorUid: 'member-2', authorName: 'Asha' }),
    ]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-list')).toBeTruthy());
    // Oldest c1 (Asha) starts a run; c2 (Daniel) starts one; c3 (Asha) starts one again; c4 continues it.
    expect(screen.getByTestId('chat-author-c1')).toBeTruthy();
    expect(screen.getByTestId('chat-author-c2')).toHaveTextContent('Daniel');
    expect(screen.getByTestId('chat-author-c3')).toBeTruthy();
    expect(screen.queryByTestId('chat-author-c4')).toBeNull();
  });

  it('starts a new run after a removed message', async () => {
    deliver([
      message('c3', { authorUid: 'member-2' }),
      message('c2', { authorUid: 'member-2', removed: true }),
      message('c1', { authorUid: 'member-2' }),
    ]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-list')).toBeTruthy());
    expect(screen.getByTestId('chat-author-c3')).toBeTruthy();
  });

  it('treats the oldest message loaded as the start of a run', async () => {
    deliver([message('c2'), message('c1')]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-author-c1')).toBeTruthy());
    expect(screen.queryByTestId('chat-author-c2')).toBeNull();
  });
});

describe('deleting your own message', () => {
  const mine = () => message('mine', { authorUid: 'member-1', authorName: 'Asha' });

  it('asks first, in the app’s own dialog, and does nothing if you cancel', async () => {
    deliver([mine()]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-delete-mine')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-delete-mine'));
    expect(screen.getByText('Delete this message?')).toBeTruthy();
    expect(deleteOwnMessage).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Cancel'));
    expect(deleteOwnMessage).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete this message?')).toBeNull();
  });

  it('deletes that message, and only that one, when confirmed', async () => {
    deliver([mine(), message('other', { authorUid: 'member-2' })]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-delete-mine')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-delete-mine'));
    await fireEvent.press(screen.getByTestId('chat-delete-dialog-confirm'));

    expect(deleteOwnMessage).toHaveBeenCalledTimes(1);
    expect(deleteOwnMessage).toHaveBeenCalledWith('mine');
    expect(screen.queryByText('Delete this message?')).toBeNull();
  });
});

describe('the message box', () => {
  it('is a 48-high field with a Send that waits until there is something to send', async () => {
    deliver([message('c1')]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-input')).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId('chat-input').props.style).minHeight).toBe(48);
    expect(screen.getByTestId('chat-send').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('chat-input'), '   ');
    expect(screen.getByTestId('chat-send').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Amen');
    expect(screen.getByTestId('chat-send').props.accessibilityState.disabled).toBe(false);
  });

  it('keeps what was typed, and says so, when sending fails', async () => {
    (sendMessage as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      deliver([message('c1')]);
      const screen = await renderChat();
      await waitFor(() => expect(screen.getByTestId('chat-input')).toBeTruthy());
      await fireEvent.changeText(screen.getByTestId('chat-input'), 'Hello church');
      await fireEvent.press(screen.getByTestId('chat-send'));
      await waitFor(() => expect(screen.getByTestId('chat-send-failed')).toBeTruthy());
      expect(screen.getByTestId('chat-send-failed')).toHaveTextContent(
        'Your message was not sent.'
      );
      expect(screen.getByTestId('chat-input').props.value).toBe('Hello church');
    } finally {
      warn.mockRestore();
    }
  });

  it('is replaced by the pause notice for a suspended member, who can still read', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
      onNext({ exists: () => true, data: () => ({ accountStatus: 'suspended' }) });
      return jest.fn();
    });
    deliver([message('c1', { text: 'Good morning church' })]);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-suspended')).toBeTruthy());
    expect(screen.getByText('Good morning church')).toBeTruthy();
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(screen.queryByTestId('chat-send')).toBeNull();
  });
});

describe('earlier messages', () => {
  const oldest = { id: 'cursor' };

  it('offers to load them in gold, when there is history', async () => {
    deliver([message('c1')], oldest);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-load-older')).toBeTruthy());
    expect(screen.getByText('Load earlier messages')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Load earlier messages').props.style).color
    ).toBe(lightTokens.accent);
  });

  it('says it is loading while it does, then shows them', async () => {
    let finish: (page: unknown) => void = () => undefined;
    (fetchOlderMessages as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve))
    );
    deliver([message('c2')], oldest);
    const screen = await renderChat();
    await waitFor(() => expect(screen.getByTestId('chat-load-older')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-load-older'));
    await waitFor(() => expect(screen.getByTestId('chat-loading-older')).toBeTruthy());
    expect(screen.getByText('Loading earlier messages…')).toBeTruthy();

    await act(async () => finish({ messages: [message('c1', { text: 'An older hello' })], cursor: null }));
    await waitFor(() => expect(screen.getByText('An older hello')).toBeTruthy());
    expect(screen.queryByTestId('chat-loading-older')).toBeNull();
    // History is exhausted: nothing more to offer.
    expect(screen.queryByTestId('chat-load-older')).toBeNull();
  });
});
