import React from 'react';
import { render } from '@testing-library/react-native';
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
  it('is labelled "You" rather than with your name', async () => {
    const screen = await renderBubble({ isOwn: true });
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('offers Delete, not Report', async () => {
    const screen = await renderBubble({ isOwn: true });
    expect(screen.getByTestId('chat-delete-c1')).toBeTruthy();
    expect(screen.queryByTestId('chat-report-c1')).toBeNull();
  });
});

describe('a message still being sent', () => {
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
