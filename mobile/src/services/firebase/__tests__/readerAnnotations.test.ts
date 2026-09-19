import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  addBookmark,
  deleteVerseNote,
  removeBookmark,
  removeHighlight,
  saveVerseNote,
  setHighlight,
  subscribeToBookmarks,
  subscribeToHighlights,
  subscribeToVerseNotes,
  verseKey,
  type VerseRef,
} from '../readerAnnotations';

jest.mock('../app');

const JOHN_3_16: VerseRef = {
  translationId: 'en',
  bookId: 'john',
  chapter: 3,
  verse: 16,
};

function docPath(): string {
  return ((doc as jest.Mock).mock.results.at(-1)?.value as { path: string }).path;
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));
});

describe('the deterministic verse key', () => {
  it('names the translation, the book, the chapter and the verse', () => {
    expect(verseKey(JOHN_3_16)).toBe('en_john_3_16');
  });

  it('keeps a hyphenated book slug readable', () => {
    expect(
      verseKey({ translationId: 'te', bookId: 'song-of-solomon', chapter: 2, verse: 1 })
    ).toBe('te_song-of-solomon_2_1');
  });

  it('separates the two translations of the same verse', () => {
    expect(verseKey({ ...JOHN_3_16, translationId: 'te' })).not.toBe(verseKey(JOHN_3_16));
  });

  it('is stable, which is what makes a second write idempotent', () => {
    expect(verseKey(JOHN_3_16)).toBe(verseKey({ ...JOHN_3_16 }));
  });
});

describe('highlights', () => {
  it('writes the verse, the colour and the owner path', async () => {
    await setHighlight('member-1', JOHN_3_16, 'yellow');
    expect(docPath()).toBe('users/member-1/highlights/en_john_3_16');
    const [, data] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(data).toMatchObject({
      translationId: 'en',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      colour: 'yellow',
    });
    // Nothing else: firestore.rules field-locks these documents.
    expect(Object.keys(data).sort()).toEqual(
      ['bookId', 'chapter', 'colour', 'createdAt', 'translationId', 'verse'].sort()
    );
  });

  it('re-colouring the same verse targets the SAME document', async () => {
    await setHighlight('member-1', JOHN_3_16, 'yellow');
    const first = docPath();
    await setHighlight('member-1', JOHN_3_16, 'blue');
    expect(docPath()).toBe(first);
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  it('removes a highlight by the same key', async () => {
    await removeHighlight('member-1', JOHN_3_16);
    expect(docPath()).toBe('users/member-1/highlights/en_john_3_16');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('drops a document whose stored reference is unusable rather than painting it', () => {
    const rows = [
      { id: 'good', data: { ...JOHN_3_16, colour: 'green' } },
      // A corrupt or partially-written document. Each of these would put
      // the reader at chapter NaN or with no colour at all.
      { id: 'no-colour', data: { ...JOHN_3_16 } },
      { id: 'bad-colour', data: { ...JOHN_3_16, colour: 'octarine' } },
      { id: 'no-book', data: { ...JOHN_3_16, bookId: '', colour: 'green' } },
      { id: 'bad-chapter', data: { ...JOHN_3_16, chapter: 'three', colour: 'green' } },
      {
        id: 'bad-translation',
        data: { ...JOHN_3_16, translationId: 'bilingual', colour: 'green' },
      },
    ];
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ docs: rows.map((row) => ({ id: row.id, data: () => row.data })) });
      return jest.fn();
    });

    const onNext = jest.fn();
    subscribeToHighlights('member-1', onNext, jest.fn());
    expect(onNext).toHaveBeenCalledWith([
      { id: 'good', ...JOHN_3_16, colour: 'green', createdAt: null },
    ]);
  });
});

describe('bookmarks', () => {
  it('uses the deterministic id, so a second tap cannot duplicate the record', async () => {
    await addBookmark('member-1', JOHN_3_16);
    const first = docPath();
    await addBookmark('member-1', JOHN_3_16);
    expect(docPath()).toBe(first);
    expect(first).toBe('users/member-1/bookmarks/en_john_3_16');
  });

  it('deletes by the same key', async () => {
    await removeBookmark('member-1', JOHN_3_16);
    expect(docPath()).toBe('users/member-1/bookmarks/en_john_3_16');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('returns them newest first, including one whose timestamp has not resolved', () => {
    // orderBy('createdAt') would EXCLUDE the unresolved one, so a
    // just-added bookmark would briefly vanish from the reader.
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        docs: [
          {
            id: 'old',
            data: () => ({ ...JOHN_3_16, createdAt: new Timestamp(1000, 0) }),
          },
          { id: 'pending', data: () => ({ ...JOHN_3_16, verse: 17 }) },
          {
            id: 'new',
            data: () => ({ ...JOHN_3_16, verse: 18, createdAt: new Timestamp(9000, 0) }),
          },
        ],
      });
      return jest.fn();
    });

    const onNext = jest.fn();
    subscribeToBookmarks('member-1', onNext, jest.fn());
    expect(onNext.mock.calls[0][0].map((b: { id: string }) => b.id)).toEqual([
      'new',
      'old',
      'pending',
    ]);
  });
});

describe('notes', () => {
  it('writes the text with both timestamps under the verse key', async () => {
    await saveVerseNote('member-1', JOHN_3_16, '  A thought.  ');
    expect(docPath()).toBe('users/member-1/verseNotes/en_john_3_16');
    const [, data] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(data.text).toBe('A thought.');
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it('preserves the original creation time when a note is edited', async () => {
    const created = new Date('2026-01-02T03:04:05Z');
    await saveVerseNote('member-1', JOHN_3_16, 'Edited.', created);
    const [, data] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      { createdAt: { toDate: () => Date } },
    ];
    expect(data.createdAt.toDate().getTime()).toBe(
      Math.floor(created.getTime() / 1000) * 1000
    );
  });

  it('refuses to store an empty note instead of writing a blank document', async () => {
    await expect(saveVerseNote('member-1', JOHN_3_16, '   ')).rejects.toThrow();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('deletes by the verse key', async () => {
    await deleteVerseNote('member-1', JOHN_3_16);
    expect(docPath()).toBe('users/member-1/verseNotes/en_john_3_16');
  });

  it('drops a note document with no text', () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({
        docs: [
          { id: 'a', data: () => ({ ...JOHN_3_16, text: 'Real.' }) },
          { id: 'b', data: () => ({ ...JOHN_3_16, text: '' }) },
          { id: 'c', data: () => ({ ...JOHN_3_16 }) },
        ],
      });
      return jest.fn();
    });
    const onNext = jest.fn();
    subscribeToVerseNotes('member-1', onNext, jest.fn());
    expect(onNext.mock.calls[0][0]).toHaveLength(1);
  });
});

describe('every path is owner-scoped', () => {
  it('reads and writes only under users/{uid}', async () => {
    await setHighlight('member-1', JOHN_3_16, 'pink');
    await addBookmark('member-1', JOHN_3_16);
    await saveVerseNote('member-1', JOHN_3_16, 'Mine.');
    subscribeToHighlights('member-1', jest.fn(), jest.fn());
    subscribeToBookmarks('member-1', jest.fn(), jest.fn());
    subscribeToVerseNotes('member-1', jest.fn(), jest.fn());

    const paths = [
      ...(doc as jest.Mock).mock.results.map((r) => (r.value as { path: string }).path),
      ...(collection as jest.Mock).mock.results.map(
        (r) => (r.value as { path: string }).path
      ),
    ];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.startsWith('users/member-1/')).toBe(true);
    }
  });
});
