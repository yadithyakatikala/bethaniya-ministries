import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  DEFAULT_READING_PREFS,
  READING_PREFS_DOC_ID,
  saveReadingPrefs,
  subscribeToReadingPrefs,
  toReadingPrefs,
} from '../readingPrefs';
import {
  getReadingPosition,
  saveReadingPosition,
  subscribeToReadingPosition,
} from '../readingPosition';
import { readingScale } from '../../../theme/tokens';

jest.mock('../app');

function lastDocPath(): string {
  return ((doc as jest.Mock).mock.results.at(-1)?.value as { path: string }).path;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reading preferences defaults', () => {
  it('takes its defaults from the M3 reading tokens rather than restating them', () => {
    expect(DEFAULT_READING_PREFS).toEqual({
      font: 'serif',
      size: readingScale.defaultSize,
      lineHeight: readingScale.defaultLineHeight,
      width: readingScale.defaultMeasure,
      layout: 'stacked',
    });
  });

  it('every stored value is a NAMED STEP, never a raw number', () => {
    // A synced document cannot then carry an unreadable 4pt size or a
    // 3000dp column, and firestore.rules validates the same closed sets.
    for (const value of Object.values(DEFAULT_READING_PREFS)) {
      expect(typeof value).toBe('string');
    }
    expect(Object.keys(readingScale.size)).toContain(DEFAULT_READING_PREFS.size);
  });
});

describe('reading a preferences document defensively', () => {
  it('returns the defaults for a missing document', () => {
    expect(toReadingPrefs(undefined)).toEqual(DEFAULT_READING_PREFS);
  });

  it('keeps the fields it recognises and defaults the rest', () => {
    expect(toReadingPrefs({ size: 'xxl', font: 'sans' })).toEqual({
      ...DEFAULT_READING_PREFS,
      size: 'xxl',
      font: 'sans',
    });
  });

  it('rejects a step this build does not know, rather than passing it through', () => {
    // A document written by a future build (or by hand) must not be able
    // to put the reader into a state it cannot render.
    expect(
      toReadingPrefs({
        size: 'enormous',
        lineHeight: 42,
        width: null,
        layout: 'carousel',
      })
    ).toEqual(DEFAULT_READING_PREFS);
  });

  it('accepts every step the tokens define', () => {
    for (const size of Object.keys(readingScale.size)) {
      expect(toReadingPrefs({ size }).size).toBe(size);
    }
    for (const lineHeight of Object.keys(readingScale.lineHeight)) {
      expect(toReadingPrefs({ lineHeight }).lineHeight).toBe(lineHeight);
    }
    for (const width of Object.keys(readingScale.measure)) {
      expect(toReadingPrefs({ width }).width).toBe(width);
    }
  });
});

describe('writing reading preferences', () => {
  it('merges only the changed fields into the owner-scoped document', async () => {
    await saveReadingPrefs('member-1', { size: 'lg' });
    expect(lastDocPath()).toBe(`users/member-1/readingPrefs/${READING_PREFS_DOC_ID}`);
    const [, data, options] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
      { merge?: boolean },
    ];
    expect(data.size).toBe('lg');
    expect(data.font).toBeUndefined();
    // merge, because the first change a member makes has no document to
    // update.
    expect(options.merge).toBe(true);
  });

  it('reports a document that does not exist yet as null', () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => false });
      return jest.fn();
    });
    const onNext = jest.fn();
    subscribeToReadingPrefs('member-1', onNext, jest.fn());
    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('validates what Firestore hands back, not just what the app wrote', () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ size: 'bogus', width: 'wide' }) });
      return jest.fn();
    });
    const onNext = jest.fn();
    subscribeToReadingPrefs('member-1', onNext, jest.fn());
    expect(onNext).toHaveBeenCalledWith({
      ...DEFAULT_READING_PREFS,
      width: 'wide',
    });
  });
});

describe('reading position', () => {
  it('keeps one document per translation, keyed by the translation', async () => {
    await saveReadingPosition('member-1', {
      translationId: 'te',
      bookId: 'psalms',
      chapter: 119,
      verse: 105,
    });
    expect(lastDocPath()).toBe('users/member-1/readingPosition/te');

    await saveReadingPosition('member-1', {
      translationId: 'en',
      bookId: 'psalms',
      chapter: 119,
      verse: 105,
    });
    // A member who switches translations must not lose either place.
    expect(lastDocPath()).toBe('users/member-1/readingPosition/en');
  });

  it('writes only the four fields firestore.rules allows', async () => {
    await saveReadingPosition('member-1', {
      translationId: 'te',
      bookId: 'psalms',
      chapter: 119,
      verse: 105,
    });
    const [, data] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(Object.keys(data).sort()).toEqual(
      ['bookId', 'chapter', 'updatedAt', 'verse'].sort()
    );
    // The translation is the document id, not a field.
    expect(data.translationId).toBeUndefined();
  });

  it('reads back a saved position with its translation attached', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ bookId: 'john', chapter: 3, verse: 16 }),
    });
    await expect(getReadingPosition('member-1', 'en')).resolves.toEqual({
      translationId: 'en',
      bookId: 'john',
      chapter: 3,
      verse: 16,
      updatedAt: null,
    });
  });

  it('returns null when the member has never read in that translation', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
    await expect(getReadingPosition('member-1', 'en')).resolves.toBeNull();
  });

  it('treats a document with no usable book as no position at all', () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ chapter: 3, verse: 16 }) });
      return jest.fn();
    });
    const onNext = jest.fn();
    subscribeToReadingPosition('member-1', 'en', onNext, jest.fn());
    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('falls back to verse 1 when the stored verse is unusable', () => {
    (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ bookId: 'john', chapter: 3 }) });
      return jest.fn();
    });
    const onNext = jest.fn();
    subscribeToReadingPosition('member-1', 'en', onNext, jest.fn());
    expect(onNext.mock.calls[0][0]).toMatchObject({ chapter: 3, verse: 1 });
  });
});
