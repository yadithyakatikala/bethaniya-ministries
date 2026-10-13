import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { lightTokens } from '../../../theme/tokens';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ChatMessageBubble } from '../ChatMessageBubble';
import type { CommunityMessage } from '../../../services/firebase/communityChat';

jest.mock('../../../services/firebase/app');

/**
 * One message in the group chat.
 *
 * The two things worth pinning are that own and other differ by more
 * than colour, and that a screen reader gets the whole bubble as ONE
 * label -- "Asha said: ..." -- rather than as three unconnected stops.
 */
function message(overrides: Partial<CommunityMessage> = {}): CommunityMessage {
  return {
    id: 'c1',
    text: 'Good morning church',
    authorUid: 'member-2',
    authorName: 'Asha',
    createdAt: new Date('2026-03-01T09:14:00Z'),
    removed: false,
    ...overrides,
  };
}

type TestNode = { parent: TestNode | null };

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
}

/** The bubble box is the parent of the accessible words node. */
function bubbleOf(words: { parent: unknown }) {
  return words.parent as { props: { style?: unknown } };
}

function isInside(node: TestNode, ancestor: unknown): boolean {
  for (let current: TestNode | null = node.parent; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function renderBubble(props: Partial<Parameters<typeof ChatMessageBubble>[0]> = {}) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <ChatMessageBubble
          message={message()}
          isOwn={false}
          alreadyReported={false}
          onDelete={jest.fn()}
          onReport={jest.fn()}
          {...props}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('somebody else’s message', () => {
  it('names the sender', async () => {
    const screen = await renderBubble();
    expect(screen.getByText('Asha')).toBeTruthy();
    expect(screen.getByText('Good morning church')).toBeTruthy();
  });

  it('offers Report, not Delete', async () => {
    const screen = await renderBubble();
    expect(screen.getByTestId('chat-report-c1')).toBeTruthy();
    expect(screen.queryByTestId('chat-delete-c1')).toBeNull();
  });

  it('says so once you have reported it', async () => {
    const screen = await renderBubble({ alreadyReported: true });
    expect(screen.getByText('Reported')).toBeTruthy();
    expect(screen.getByTestId('chat-report-c1').props.accessibilityState?.disabled).toBe(
      true
    );
  });
});

describe('your own message', () => {
  it('is announced as from "You", and shows no name of its own', async () => {
    const screen = await renderBubble({ isOwn: true });
    // The right-hand, ink-filled bubble is the visible sign; the label is the spoken one.
    expect(screen.getByLabelText('You said: Good morning church')).toBeTruthy();
    expect(screen.queryByText('You')).toBeNull();
    expect(screen.queryByText('Asha')).toBeNull();
  });

  it('has no disc beside it', async () => {
    const screen = await renderBubble({ isOwn: true });
    expect(screen.queryByText('A', { includeHiddenElements: true })).toBeNull();
  });

  it('is right-aligned and ink-filled; somebody else’s is left-aligned on the surface', async () => {
    const own = await renderBubble({ isOwn: true });
    expect(flat(own.getByTestId('chat-message-c1')).justifyContent).toBe('flex-end');
    expect(
      flat(bubbleOf(own.getByLabelText('You said: Good morning church'))).backgroundColor
    ).toBe(lightTokens.primary);
    await own.unmount();

    const other = await renderBubble();
    expect(flat(other.getByTestId('chat-message-c1')).justifyContent).toBeUndefined();
    expect(
      flat(bubbleOf(other.getByLabelText('Asha said: Good morning church')))
        .backgroundColor
    ).toBe(lightTokens.surface);
  });

  it('offers Delete, not Report', async () => {
    const screen = await renderBubble({ isOwn: true });
    expect(screen.getByTestId('chat-delete-c1')).toBeTruthy();
    expect(screen.queryByTestId('chat-report-c1')).toBeNull();
  });
});

describe('a run of messages from one person', () => {
  it('starts with a disc and the name in gold', async () => {
    const screen = await renderBubble({ startsRun: true });
    expect(screen.getByText('A', { includeHiddenElements: true })).toBeTruthy();
    expect(flat(screen.getByTestId('chat-author-c1')).color).toBe(lightTokens.accent);
    expect(screen.getByTestId('chat-author-c1')).toHaveTextContent('Asha');
  });

  it('carries on without either, keeping the bubble in line with the one above', async () => {
    const screen = await renderBubble({ startsRun: false });
    expect(screen.queryByTestId('chat-author-c1')).toBeNull();
    expect(screen.queryByText('A', { includeHiddenElements: true })).toBeNull();
    // ...but is still announced with who it is from, so a listener loses nothing.
    expect(screen.getByLabelText('Asha said: Good morning church')).toBeTruthy();
    expect(flat(screen.getByTestId('chat-message-c1')).marginTop).toBe(0);
  });

  it('puts a new voice a little lower than the one before', async () => {
    const screen = await renderBubble({ startsRun: true });
    expect(flat(screen.getByTestId('chat-message-c1')).marginTop).toBe(10);
  });
});

describe('a message still being sent', () => {
  it('offers no Delete until it has been sent', async () => {
    const screen = await renderBubble({
      isOwn: true,
      message: message({ createdAt: null }),
    });
    expect(screen.queryByTestId('chat-delete-c1')).toBeNull();
  });

  it('says "Sending…" rather than inventing a time', async () => {
    // Its serverTimestamp() has not resolved yet. Showing a made-up
    // "now" is a small lie that becomes visible when the real time
    // differs.
    const screen = await renderBubble({
      isOwn: true,
      message: message({ createdAt: null }),
    });
    expect(screen.getByText('Sending…')).toBeTruthy();
  });
});

describe('a removed message', () => {
  it('leaves a tombstone rather than a gap', async () => {
    const screen = await renderBubble({ message: message({ removed: true }) });
    expect(screen.getByTestId('chat-message-c1')).toBeTruthy();
    expect(screen.getByText('This message was removed.')).toBeTruthy();
  });

  it('does not show what was removed', async () => {
    const screen = await renderBubble({ message: message({ removed: true }) });
    expect(screen.queryByText('Good morning church')).toBeNull();
  });
});

describe('accessibility', () => {
  it('keeps Report and Delete outside the node a screen reader reads as the message', async () => {
    // A node that swallows its children hides them from VoiceOver: the words
    // are one stop, and the action is its own.
    const other = await renderBubble();
    const words = other.getByLabelText('Asha said: Good morning church');
    expect(isInside(other.getByTestId('chat-report-c1'), words)).toBe(false);
    expect(isInside(other.getByTestId('chat-time-c1'), words)).toBe(false);
    await other.unmount();

    const own = await renderBubble({ isOwn: true });
    expect(
      isInside(
        own.getByTestId('chat-delete-c1'),
        own.getByLabelText('You said: Good morning church')
      )
    ).toBe(false);
  });

  it('gives each action a 44-point target', async () => {
    const screen = await renderBubble();
    const slop = screen.getByTestId('chat-report-c1').props.hitSlop;
    // The words are 16 high.
    expect(16 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('announces the sender and the message as one label', async () => {
    // Queried by the label itself rather than by walking the tree: this
    // is exactly how a screen reader finds it, and it fails if the
    // bubble ever stops being one accessible node.
    const screen = await renderBubble();
    expect(screen.getByLabelText('Asha said: Good morning church')).toBeTruthy();
  });

  it('labels your own message as from You', async () => {
    const screen = await renderBubble({ isOwn: true });
    expect(screen.getByLabelText('You said: Good morning church')).toBeTruthy();
  });
});
