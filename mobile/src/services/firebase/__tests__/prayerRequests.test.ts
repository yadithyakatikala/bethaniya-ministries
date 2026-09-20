import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import {
  createPrayerRequest,
  toPrayerRequest,
  updatePrayerRequest,
} from '../prayerRequests';

jest.mock('../app', () => ({ db: {} }));

/**
 * The prayer wall's data layer -- and mostly, what it refuses to write.
 *
 * The assertions about `anonymous` are the point of this file. An
 * anonymous request must carry NO identity: firestore.rules refuses the
 * write if it does (see firebase-tests/src/firestore.rules.test.ts for
 * that half), and these check that the client never even forms such a
 * payload -- so the two halves fail independently rather than relying on
 * each other.
 */
type StagedWrite = { ref: unknown; data: Record<string, unknown> };

function captureBatch(): { writes: StagedWrite[]; commits: number } {
  const record = { writes: [] as StagedWrite[], commits: 0 };
  (writeBatch as jest.Mock).mockImplementation(() => ({
    set: (ref: unknown, data: Record<string, unknown>) =>
      record.writes.push({ ref, data }),
    update: jest.fn(),
    delete: jest.fn(),
    commit: async () => {
      record.commits += 1;
    },
  }));
  return record;
}

beforeEach(() => {
  (doc as jest.Mock).mockImplementation((...segments: unknown[]) => ({
    // collection(db, 'x') and doc(ref, 'a', 'b') both land here; the
    // joined path is enough to tell the three staged writes apart.
    id: 'generated-id',
    path: segments.filter((s) => typeof s === 'string').join('/'),
  }));
});

describe('reading a request back', () => {
  it('keeps the author name on a named request', () => {
    const request = toPrayerRequest('p1', {
      title: 'Please pray',
      body: 'For my family.',
      anonymous: false,
      authorName: 'Asha',
      status: 'open',
      removed: false,
    });
    expect(request?.authorName).toBe('Asha');
    expect(request?.anonymous).toBe(false);
  });

  it('reports NO author name for an anonymous request', () => {
    const request = toPrayerRequest('p1', {
      title: 'Please pray',
      body: 'Something private.',
      anonymous: true,
      status: 'open',
      removed: false,
    });
    expect(request?.authorName).toBeNull();
  });

  it('still reports no author name if a legacy document somehow has one', () => {
    // Belt and braces. Rules refuse this shape today; a document written
    // before they did must not start leaking a name now.
    const request = toPrayerRequest('p1', {
      title: 'Please pray',
      body: 'Something private.',
      anonymous: true,
      authorName: 'Asha',
      status: 'open',
      removed: false,
    });
    expect(request?.authorName).toBeNull();
  });

  it('exposes no uid at all -- the type has no field for one', () => {
    const request = toPrayerRequest('p1', {
      title: 'Please pray',
      body: 'For my family.',
      anonymous: false,
      authorUid: 'member-1',
      authorName: 'Asha',
      status: 'open',
      removed: false,
    });
    expect(Object.keys(request ?? {})).not.toContain('authorUid');
  });

  it('skips a request with no words rather than rendering an empty card', () => {
    expect(toPrayerRequest('p1', { title: '  ', body: 'x', anonymous: false })).toBeNull();
    expect(toPrayerRequest('p2', { title: 'x', body: '', anonymous: false })).toBeNull();
  });

  it('falls back to open for an unrecognised status, and drops a bad category', () => {
    const request = toPrayerRequest('p1', {
      title: 'Please pray',
      body: 'For my family.',
      anonymous: false,
      authorName: 'Asha',
      status: 'something-else',
      category: 'not-a-category',
      removed: false,
    });
    expect(request?.status).toBe('open');
    expect(request?.category).toBeNull();
  });
});

describe('writing a request', () => {
  it('writes the request, the private author record and the index in ONE batch', () => {
    const record = captureBatch();
    void createPrayerRequest({
      uid: 'member-1',
      authorName: 'Asha',
      title: 'Please pray',
      body: 'For my family.',
      category: 'family',
      anonymous: false,
    });
    expect(record.writes).toHaveLength(3);
  });

  it('OMITS the uid and the name from an anonymous request', () => {
    const record = captureBatch();
    void createPrayerRequest({
      uid: 'member-1',
      authorName: 'Asha',
      title: 'Please pray',
      body: 'Something private.',
      category: null,
      anonymous: true,
    });

    const [request] = record.writes;
    expect(request?.data.anonymous).toBe(true);
    // Omitted, not nulled: firestore.rules refuses the write if the key
    // is present at all.
    expect(request?.data).not.toHaveProperty('authorUid');
    expect(request?.data).not.toHaveProperty('authorName');
    // The name is not smuggled anywhere else in the payload either.
    expect(JSON.stringify(request?.data)).not.toContain('Asha');
    expect(JSON.stringify(request?.data)).not.toContain('member-1');
  });

  it('records the author privately even when the request is anonymous', () => {
    // Otherwise they could never edit or delete their own request.
    const record = captureBatch();
    void createPrayerRequest({
      uid: 'member-1',
      authorName: 'Asha',
      title: 'Please pray',
      body: 'Something private.',
      category: null,
      anonymous: true,
    });
    const privateWrite = record.writes.find((write) => write.data.uid === 'member-1');
    expect(privateWrite).toBeDefined();
  });

  it('attributes a NON-anonymous request to its author', () => {
    const record = captureBatch();
    void createPrayerRequest({
      uid: 'member-1',
      authorName: 'Asha',
      title: 'Please pray',
      body: 'For my family.',
      category: 'family',
      anonymous: false,
    });
    const [request] = record.writes;
    expect(request?.data.authorUid).toBe('member-1');
    expect(request?.data.authorName).toBe('Asha');
  });

  it('always starts a request open and un-removed', () => {
    const record = captureBatch();
    void createPrayerRequest({
      uid: 'member-1',
      authorName: 'Asha',
      title: 'Please pray',
      body: 'For my family.',
      category: null,
      anonymous: false,
    });
    const [request] = record.writes;
    expect(request?.data.status).toBe('open');
    expect(request?.data.removed).toBe(false);
  });
});

describe('editing a request', () => {
  it('never sends `anonymous`, so the choice cannot be undone', async () => {
    // The rules keep it out of the author's allowlist; this keeps the
    // client from even trying, so a denial can never be mistaken for a
    // feature that nearly works.
    (updateDoc as jest.Mock).mockClear();
    await updatePrayerRequest('p1', {
      title: 'Please pray',
      body: 'Updated.',
      category: 'family',
      status: 'answered',
    });
    const payload = (updateDoc as jest.Mock).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('anonymous');
    expect(payload).not.toHaveProperty('authorUid');
    expect(payload).not.toHaveProperty('authorName');
  });
});
