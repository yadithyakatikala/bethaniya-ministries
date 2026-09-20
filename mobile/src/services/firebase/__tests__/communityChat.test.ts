import { addDoc } from 'firebase/firestore';
import {
  MESSAGE_PENDING_SORT_KEY,
  mergeMessages,
  messageSortKey,
  sendMessage,
  toCommunityMessage,
  type CommunityMessage,
} from '../communityChat';

jest.mock('../app', () => ({ db: {} }));

/**
 * The group chat's data layer.
 *
 * mergeMessages() is the interesting part: it is what keeps a message
 * from appearing twice when a page of history overlaps the live page,
 * and it is pure, so it can be tested without an emulator or a listener.
 */
function message(
  id: string,
  overrides: Partial<CommunityMessage> = {}
): CommunityMessage {
  return {
    id,
    text: `message ${id}`,
    authorUid: 'member-1',
    authorName: 'Asha',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    removed: false,
    ...overrides,
  };
}

describe('reading a message back', () => {
  it('maps a whole message', () => {
    const mapped = toCommunityMessage('c1', {
      text: 'Good morning',
      authorUid: 'member-1',
      authorName: '  Asha  ',
      removed: false,
    });
    expect(mapped?.text).toBe('Good morning');
    expect(mapped?.authorName).toBe('Asha');
    expect(mapped?.removed).toBe(false);
  });

  it('skips a message with no words', () => {
    expect(toCommunityMessage('c1', { text: '' })).toBeNull();
    expect(toCommunityMessage('c2', {})).toBeNull();
  });

  it('reports a removed message rather than hiding it', () => {
    // The screen draws a tombstone; dropping the row would make the
    // conversation reflow under whoever is reading it.
    const mapped = toCommunityMessage('c1', { text: 'x', removed: true });
    expect(mapped?.removed).toBe(true);
  });

  it('has a null timestamp until the server stamps it', () => {
    const mapped = toCommunityMessage('c1', { text: 'x' });
    expect(mapped?.createdAt).toBeNull();
  });
});

describe('ordering', () => {
  it('sorts a message whose timestamp has not resolved to the newest end', () => {
    // It is the one this device has just sent -- nothing else can have
    // an unresolved timestamp.
    expect(messageSortKey(message('c1', { createdAt: null }))).toBe(
      MESSAGE_PENDING_SORT_KEY
    );
  });

  it('puts the newest first', () => {
    const older = message('old', { createdAt: new Date('2026-03-01T08:00:00Z') });
    const newer = message('new', { createdAt: new Date('2026-03-01T10:00:00Z') });
    expect(mergeMessages([older], [newer]).map((m) => m.id)).toEqual(['new', 'old']);
  });

  it('puts a just-sent message above everything', () => {
    const existing = message('old', { createdAt: new Date('2026-03-01T08:00:00Z') });
    const pending = message('pending', { createdAt: null });
    expect(mergeMessages([existing], [pending]).map((m) => m.id)).toEqual([
      'pending',
      'old',
    ]);
  });
});

describe('merging history into what is on screen', () => {
  it('does not duplicate a message the two pages share', () => {
    const shared = message('c1');
    const merged = mergeMessages([shared, message('c2')], [shared, message('c3')]);
    expect(merged.map((m) => m.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('lets the INCOMING copy win, so a fresh removal is not undone', () => {
    // The live page's copy carries a removal an administrator has just
    // made; the copy already on screen predates it.
    const stale = message('c1', { removed: false });
    const fresh = message('c1', { removed: true });
    const merged = mergeMessages([stale], [fresh]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.removed).toBe(true);
  });

  it('keeps history already loaded when a new live page arrives', () => {
    const history = [message('h1'), message('h2')];
    const live = [message('live', { createdAt: new Date('2026-03-01T12:00:00Z') })];
    expect(mergeMessages(history, live)).toHaveLength(3);
  });
});

describe('sending', () => {
  it('stamps the author and pins removed to false', () => {
    (addDoc as jest.Mock).mockClear();
    void sendMessage({ uid: 'member-1', authorName: 'Asha', text: '  Hello  ' });
    const payload = (addDoc as jest.Mock).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.text).toBe('Hello');
    expect(payload.authorUid).toBe('member-1');
    expect(payload.authorName).toBe('Asha');
    // Written explicitly: firestore.rules requires it, so a message can
    // never arrive already claiming to have been moderated.
    expect(payload.removed).toBe(false);
  });
});
