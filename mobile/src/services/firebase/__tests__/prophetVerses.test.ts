import { Timestamp, getDocs, limit, orderBy, where } from 'firebase/firestore';
import {
  CLOCK_SKEW_ALLOWANCE_MS,
  PROPHET_VERSES_COLLECTION,
  fetchCurrentProphetVerse,
  toProphetVerse,
} from '../prophetVerses';

jest.mock('../app');

/**
 * Two things are worth pinning here, and neither is about rendering.
 *
 * The PUBLICATION RULE: published, and due, and if several qualify the
 * most recently scheduled one -- a rule that has to be written down
 * somewhere it can fail loudly, because "which devotional is showing" is
 * not something a member can debug.
 *
 * The READ COST: one document, never the collection.
 */
const NOW = new Date('2026-04-03T12:00:00.000Z');

function snapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map(({ id, data }) => ({ id, data: () => data })) };
}

const stored = {
  title: 'A word for the church',
  reference: 'Isaiah 43:19',
  text: 'Behold, I will do a new thing.',
  published: true,
  publishAt: Timestamp.fromDate(new Date('2026-04-01T06:00:00.000Z')),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reading a stored record', () => {
  it('keeps every field, trimmed', () => {
    expect(toProphetVerse('p1', { ...stored, attribution: '  Pastor  ' })).toEqual({
      id: 'p1',
      title: 'A word for the church',
      reference: 'Isaiah 43:19',
      text: 'Behold, I will do a new thing.',
      attribution: 'Pastor',
      imageUrl: null,
      publishAt: new Date('2026-04-01T06:00:00.000Z'),
    });
  });

  it('treats an absent or blank attribution as absent', () => {
    expect(toProphetVerse('p1', stored)?.attribution).toBeNull();
    expect(
      toProphetVerse('p1', { ...stored, attribution: '   ' })?.attribution
    ).toBeNull();
  });

  it('accepts only an https image url', () => {
    // Android blocks cleartext by default, so an http:// url renders as a
    // broken image -- better no image area than a broken one.
    expect(
      toProphetVerse('p1', { ...stored, imageUrl: 'https://example.org/a.jpg' })?.imageUrl
    ).toBe('https://example.org/a.jpg');
    for (const rejected of [
      'http://example.org/a.jpg',
      'ftp://example.org/a.jpg',
      'javascript:alert(1)',
      '/local/path.jpg',
      42,
      null,
    ]) {
      expect(
        toProphetVerse('p1', { ...stored, imageUrl: rejected })?.imageUrl
      ).toBeNull();
    }
  });

  it('refuses a record with no title or no text rather than rendering half of one', () => {
    expect(toProphetVerse('p1', { ...stored, title: '  ' })).toBeNull();
    expect(toProphetVerse('p1', { ...stored, text: '' })).toBeNull();
    expect(toProphetVerse('p1', {})).toBeNull();
  });

  it('tolerates a missing reference, which is optional in practice', () => {
    const { reference: _omitted, ...withoutReference } = stored;
    expect(toProphetVerse('p1', withoutReference)?.reference).toBe('');
  });

  it('reports an unusable publishAt as null instead of guessing a date', () => {
    expect(toProphetVerse('p1', { ...stored, publishAt: 'soon' })?.publishAt).toBeNull();
  });
});

describe('which record is current', () => {
  it('asks for published, due, most recently scheduled -- one document', async () => {
    (getDocs as jest.Mock).mockResolvedValue(snapshot([{ id: 'p1', data: stored }]));
    const verse = await fetchCurrentProphetVerse(NOW);

    expect(PROPHET_VERSES_COLLECTION).toBe('prophet_verses');
    expect(where).toHaveBeenCalledWith('published', '==', true);
    expect(where).toHaveBeenCalledWith('publishAt', '<=', Timestamp.fromDate(NOW));
    // Descending, so the newest qualifying record wins and ties fall to
    // Firestore's implicit document-id ordering in the same direction.
    expect(orderBy).toHaveBeenCalledWith('publishAt', 'desc');
    // One read per app open -- never the whole history.
    expect(limit).toHaveBeenCalledWith(1);
    expect(verse?.id).toBe('p1');
  });

  it('returns null when the church has published nothing yet', async () => {
    (getDocs as jest.Mock).mockResolvedValue(snapshot([]));
    expect(await fetchCurrentProphetVerse(NOW)).toBeNull();
  });

  it('returns null rather than a half-built record for a malformed document', async () => {
    (getDocs as jest.Mock).mockResolvedValue(
      snapshot([{ id: 'p1', data: { published: true } }])
    );
    expect(await fetchCurrentProphetVerse(NOW)).toBeNull();
  });
});

describe('a device clock that runs fast', () => {
  it('retries once with an earlier bound when the server refuses the query', async () => {
    // The rules compare against the SERVER's clock. A phone a minute
    // ahead can ask for a record that is not yet allowed, and Firestore
    // rejects the whole query rather than returning fewer rows.
    (getDocs as jest.Mock)
      .mockRejectedValueOnce({ code: 'permission-denied' })
      .mockResolvedValueOnce(snapshot([{ id: 'p1', data: stored }]));

    expect((await fetchCurrentProphetVerse(NOW))?.id).toBe('p1');
    expect(where).toHaveBeenCalledWith(
      'publishAt',
      '<=',
      Timestamp.fromDate(new Date(NOW.getTime() - CLOCK_SKEW_ALLOWANCE_MS))
    );
    expect(getDocs).toHaveBeenCalledTimes(2);
  });

  it('does not retry for any other failure', async () => {
    // Offline would fail the same way twice; retrying only spends reads.
    (getDocs as jest.Mock).mockRejectedValue({ code: 'unavailable' });
    await expect(fetchCurrentProphetVerse(NOW)).rejects.toEqual({ code: 'unavailable' });
    expect(getDocs).toHaveBeenCalledTimes(1);
  });
});
