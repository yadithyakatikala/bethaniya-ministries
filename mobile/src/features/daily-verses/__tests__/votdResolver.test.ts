import { addDays } from '../votdDate';
import {
  FALLBACK_CONFIG,
  FALLBACK_REFERENCES,
  detectScriptLanguage,
  formatVotdReference,
  resolveVerseOfTheDay,
  resolveVotdReference,
  resolveVotdScripture,
  type VotdOverride,
} from '../votdResolver';
import {
  DEFAULT_VOTD_CONFIG,
  type VersePoolEntry,
  type VotdConfig,
} from '../votdSelection';
import { getChapter } from '../../bible/dataSource';

/**
 * The resolver: which verse, and what it says.
 *
 * Two things are being protected here. The first is the PRIORITY -- an
 * administrator who typed a verse for Good Friday must get that verse on
 * Good Friday, whatever the automation would have chosen. The second is
 * that NOTHING IS EVER INVENTED: every path either produces real text
 * from the bundled corpus (or the admin's own words) or produces null,
 * and null is what makes the caller show the shared empty state.
 */
function override(partial: Partial<VotdOverride> = {}): VotdOverride {
  return {
    id: '2026-04-03',
    date: '2026-04-03',
    reference: 'Isaiah 53:5',
    text: 'But he was pierced for our transgressions...',
    imageUrl: null,
    ...partial,
  };
}

function poolEntry(
  id: string,
  order: number,
  ref: { bookId: string; chapter: number; verse: number }
): VersePoolEntry {
  return {
    id,
    reference: `${ref.bookId} ${ref.chapter}:${ref.verse}`,
    ...ref,
    order,
    active: true,
  };
}

const POOL: VersePoolEntry[] = [
  poolEntry('a', 0, { bookId: 'john', chapter: 3, verse: 16 }),
  poolEntry('b', 1, { bookId: 'psalms', chapter: 23, verse: 1 }),
  poolEntry('c', 2, { bookId: 'romans', chapter: 8, verse: 28 }),
];

const CONFIG: VotdConfig = DEFAULT_VOTD_CONFIG;

describe('priority', () => {
  it('an admin override wins over the automated pool', () => {
    const selection = resolveVotdReference('2026-04-03', override(), CONFIG, POOL);
    expect(selection).toEqual({ source: 'override', override: override() });
  });

  it('an override wins even when automation is disabled', () => {
    const selection = resolveVotdReference(
      '2026-04-03',
      override(),
      { ...CONFIG, enabled: false },
      POOL
    );
    expect(selection?.source).toBe('override');
  });

  it('falls to the pool when there is no override for the date', () => {
    const selection = resolveVotdReference('2026-04-03', null, CONFIG, POOL);
    expect(selection?.source).toBe('pool');
    if (selection?.source !== 'pool') throw new Error('unreachable');
    expect(POOL.map((e) => e.reference)).toContain(selection.poolReference);
  });

  it('ignores an override with no reference or no text rather than showing a blank card', () => {
    // A half-saved document must not beat a working automated verse.
    for (const broken of [override({ text: '   ' }), override({ reference: '' })]) {
      expect(resolveVotdReference('2026-04-03', broken, CONFIG, POOL)?.source).toBe(
        'pool'
      );
    }
  });
});

describe('the fallback', () => {
  it('is used when Firestore could not be reached at all', () => {
    const selection = resolveVotdReference('2026-04-03', null, null, null);
    expect(selection?.source).toBe('fallback');
  });

  it('is used when automation is switched off and no override exists', () => {
    expect(
      resolveVotdReference('2026-04-03', null, { ...CONFIG, enabled: false }, POOL)
        ?.source
    ).toBe('fallback');
  });

  it('is used when the pool is empty, or holds nothing usable', () => {
    expect(resolveVotdReference('2026-04-03', null, CONFIG, [])?.source).toBe('fallback');
    const inactive = POOL.map((entry) => ({ ...entry, active: false }));
    expect(resolveVotdReference('2026-04-03', null, CONFIG, inactive)?.source).toBe(
      'fallback'
    );
  });

  it('is deterministic for a date, and rotates across days', () => {
    const first = resolveVotdReference('2026-04-03', null, null, null);
    expect(resolveVotdReference('2026-04-03', null, null, null)).toEqual(first);

    const seen = new Set<string>();
    let date = '2026-04-03';
    for (let i = 0; i < FALLBACK_REFERENCES.length; i += 1) {
      const selection = resolveVotdReference(date, null, null, null);
      if (selection?.source !== 'fallback') throw new Error('unreachable');
      seen.add(selection.poolReference);
      date = addDays(date, 1)!;
    }
    expect(seen.size).toBe(FALLBACK_REFERENCES.length);
  });

  it('returns nothing at all for an unusable date, rather than verse one', () => {
    expect(resolveVotdReference('2026-02-30', null, CONFIG, POOL)).toBeNull();
    expect(resolveVotdReference('not-a-date', null, null, null)).toBeNull();
  });

  it('every bundled fallback reference actually exists in the corpus', () => {
    // If one of these were wrong, the app's last resort would be the
    // empty state -- the one place it must never be.
    const unresolved = FALLBACK_REFERENCES.filter(
      (reference) => resolveVotdScripture(reference, 'en') === null
    );
    expect(unresolved).toEqual([]);
  });

  it('every bundled fallback reference resolves in Telugu too, the default Bible', () => {
    const unresolved = FALLBACK_REFERENCES.filter(
      (reference) => resolveVotdScripture(reference, 'te') === null
    );
    expect(unresolved).toEqual([]);
  });

  it('lists no duplicates, so the rotation really visits twelve verses', () => {
    const keys = FALLBACK_REFERENCES.map((r) => `${r.bookId}:${r.chapter}:${r.verse}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(FALLBACK_CONFIG.enabled).toBe(true);
  });
});

describe('scripture in one language', () => {
  it('resolves an English verse to its real text', () => {
    const scripture = resolveVotdScripture(
      { bookId: 'john', chapter: 3, verse: 16 },
      'en'
    );
    expect(scripture).toMatchObject({ kind: 'single', language: 'en', label: '16' });
    if (scripture?.kind !== 'single') throw new Error('unreachable');
    expect(scripture.text).toBe(getChapter('john', 3, 'en')!.verses[15]!.text);
    expect(scripture.text).toContain('God so loved the world');
  });

  it('resolves a Telugu verse to its real text, not the English one', () => {
    const telugu = resolveVotdScripture({ bookId: 'john', chapter: 3, verse: 16 }, 'te');
    const english = resolveVotdScripture({ bookId: 'john', chapter: 3, verse: 16 }, 'en');
    expect(telugu).toMatchObject({ kind: 'single', language: 'te' });
    if (telugu?.kind !== 'single' || english?.kind !== 'single') {
      throw new Error('unreachable');
    }
    expect(telugu.text).not.toBe(english.text);
    expect(telugu.text).toBe(
      getChapter('john', 3, 'te')!.verses.find((verse) => verse.number === 16)!.text
    );
    // Telugu script, not the English text mislabelled.
    expect(detectScriptLanguage(telugu.text)).toBe('te');
  });

  it('matches a merged Telugu unit by range and labels both ends (Luke 1:39-40)', () => {
    for (const verse of [39, 40]) {
      const scripture = resolveVotdScripture({ bookId: 'luke', chapter: 1, verse }, 'te');
      expect(scripture).toMatchObject({ kind: 'single', language: 'te', label: '39-40' });
    }
  });

  it('refuses a chapter the selected translation does not have (Malachi 4 in Telugu)', () => {
    // Never silently shown in English instead: the caller decides.
    expect(
      resolveVotdScripture({ bookId: 'malachi', chapter: 4, verse: 2 }, 'te')
    ).toBeNull();
    expect(
      resolveVotdScripture({ bookId: 'malachi', chapter: 4, verse: 2 }, 'en')
    ).toMatchObject({ kind: 'single', language: 'en' });
  });

  it('refuses a reference that does not exist instead of inventing one', () => {
    expect(
      resolveVotdScripture({ bookId: 'not-a-book', chapter: 1, verse: 1 }, 'en')
    ).toBeNull();
    expect(
      resolveVotdScripture({ bookId: 'john', chapter: 99, verse: 1 }, 'en')
    ).toBeNull();
    expect(
      resolveVotdScripture({ bookId: 'john', chapter: 3, verse: 999 }, 'en')
    ).toBeNull();
    expect(
      resolveVotdScripture({ bookId: 'john', chapter: 0, verse: 1 }, 'en')
    ).toBeNull();
  });
});

describe('scripture in bilingual mode', () => {
  it('pairs a verse both traditions number the same way', () => {
    const scripture = resolveVotdScripture(
      { bookId: 'john', chapter: 3, verse: 16 },
      'bilingual'
    );
    expect(scripture?.kind).toBe('paired');
    if (scripture?.kind !== 'paired') throw new Error('unreachable');
    expect(scripture.label).toBe('16');
    expect(scripture.english).toContain('God so loved the world');
    expect(detectScriptLanguage(scripture.telugu)).toBe('te');
  });

  it('pairs a merged Telugu unit as one row (Luke 1:39-40)', () => {
    const scripture = resolveVotdScripture(
      { bookId: 'luke', chapter: 1, verse: 40 },
      'bilingual'
    );
    expect(scripture).toMatchObject({ kind: 'paired', label: '39-40' });
  });

  it('reports WHY only English is available, and the two reasons differ', () => {
    // Genesis 31 exists in Telugu but is divided differently; Malachi 4
    // has no Telugu text at all. Telling a member the wrong one would be
    // telling them something false.
    const divergent = resolveVotdScripture(
      { bookId: 'genesis', chapter: 31, verse: 3 },
      'bilingual'
    );
    expect(divergent).toMatchObject({ kind: 'englishOnly', notice: 'numberingDiffers' });

    const absent = resolveVotdScripture(
      { bookId: 'malachi', chapter: 4, verse: 2 },
      'bilingual'
    );
    expect(absent).toMatchObject({ kind: 'englishOnly', notice: 'notInTranslation' });
  });

  it('shows English alone where the two traditions divide the chapter differently', () => {
    // Genesis 31 is one of the 41 divergent chapters: verse N in one is
    // not verse N in the other, so pairing is refused upstream by the M1
    // policy and must not be re-invented here.
    const scripture = resolveVotdScripture(
      { bookId: 'genesis', chapter: 31, verse: 3 },
      'bilingual'
    );
    expect(scripture?.kind).toBe('englishOnly');
    if (scripture?.kind !== 'englishOnly') throw new Error('unreachable');
    expect(scripture.english).toBe(getChapter('genesis', 31, 'en')!.verses[2]!.text);
  });

  it('shows English alone where the Telugu text genuinely does not exist', () => {
    const scripture = resolveVotdScripture(
      { bookId: 'malachi', chapter: 4, verse: 2 },
      'bilingual'
    );
    expect(scripture?.kind).toBe('englishOnly');
  });

  it('refuses an impossible reference in bilingual mode too', () => {
    expect(
      resolveVotdScripture({ bookId: 'john', chapter: 3, verse: 999 }, 'bilingual')
    ).toBeNull();
    expect(
      resolveVotdScripture({ bookId: 'not-a-book', chapter: 1, verse: 1 }, 'bilingual')
    ).toBeNull();
  });
});

describe('the printed reference', () => {
  const john316 = { bookId: 'john', chapter: 3, verse: 16 };

  it('follows the Bible language in a single-language mode', () => {
    expect(formatVotdReference(john316, '16', 'en', 'en')).toBe('John 3:16');
    expect(formatVotdReference(john316, '16', 'te', 'en')).toBe('యోహాను సువార్త 3:16');
  });

  it('follows the app language in bilingual mode, where labels are chrome', () => {
    expect(formatVotdReference(john316, '16', 'bilingual', 'en')).toBe('John 3:16');
    expect(formatVotdReference(john316, '16', 'bilingual', 'te')).toBe(
      'యోహాను సువార్త 3:16'
    );
  });

  it('prints a merged label as it was resolved', () => {
    expect(
      formatVotdReference({ bookId: 'luke', chapter: 1, verse: 39 }, '39-40', 'en', 'en')
    ).toBe('Luke 1:39-40');
  });

  it('returns nothing for an unknown book', () => {
    expect(
      formatVotdReference({ bookId: 'nope', chapter: 1, verse: 1 }, '1', 'en', 'en')
    ).toBeNull();
  });
});

describe('which script an override was typed in', () => {
  it('is Telugu as soon as any Telugu letter is present', () => {
    // A Telugu verse containing an English proper name is still Telugu,
    // and the Telugu face sets Latin properly while the reverse does not.
    expect(detectScriptLanguage('దేవుడు లోకమును')).toBe('te');
    expect(detectScriptLanguage('Paul wrote: దేవుడు')).toBe('te');
  });

  it('is English for Latin text, and for nothing at all', () => {
    expect(detectScriptLanguage('For God so loved the world')).toBe('en');
    expect(detectScriptLanguage('')).toBe('en');
  });
});

describe('the whole decision, end to end', () => {
  it('renders an override VERBATIM -- never re-resolved from the corpus', () => {
    // An override predates the bundled Bible and may be a paraphrase, a
    // different translation, or a range. Looking it up would silently
    // rewrite what an administrator wrote.
    const admin = override({
      reference: 'Isaiah 53:5 (NIV)',
      text: 'But he was pierced',
    });
    const content = resolveVerseOfTheDay('2026-04-03', admin, CONFIG, POOL, 'te', 'en');
    expect(content).toEqual({
      source: 'override',
      reference: 'Isaiah 53:5 (NIV)',
      body: { kind: 'text', language: 'en', text: 'But he was pierced' },
      imageUrl: null,
      label: null,
      // No citation: "Isaiah 53:5 (NIV)" cannot be taken apart into
      // book/chapter/label, and must not be guessed at. See
      // ../votdSharing.ts.
      citation: null,
    });
  });

  it('keeps an override image, and sets Telugu override text in Telugu', () => {
    const admin = override({
      text: 'ఆయన మన అతిక్రమములనుబట్టి గాయపరచబడెను',
      imageUrl: 'https://example.org/cross.jpg',
    });
    const content = resolveVerseOfTheDay('2026-04-03', admin, CONFIG, POOL, 'en', 'en');
    expect(content?.body).toMatchObject({ kind: 'text', language: 'te' });
    expect(content?.imageUrl).toBe('https://example.org/cross.jpg');
  });

  it('resolves an automated verse in the reader’s own Bible mode', () => {
    const telugu = resolveVerseOfTheDay('2026-04-03', null, CONFIG, POOL, 'te', 'en');
    const english = resolveVerseOfTheDay('2026-04-03', null, CONFIG, POOL, 'en', 'en');
    expect(telugu?.source).toBe('pool');
    expect(telugu?.body).toMatchObject({ kind: 'text', language: 'te' });
    expect(english?.body).toMatchObject({ kind: 'text', language: 'en' });
    // Same verse, two languages -- the mode changes the text, not the pick.
    expect(telugu?.label).toBe(english?.label);
  });

  it('keeps the Bible language and the interface language independent', () => {
    // A Telugu-reading member with an English interface, and the reverse.
    const teBibleEnUi = resolveVerseOfTheDay(
      '2026-04-03',
      null,
      CONFIG,
      POOL,
      'te',
      'en'
    );
    const teBibleTeUi = resolveVerseOfTheDay(
      '2026-04-03',
      null,
      CONFIG,
      POOL,
      'te',
      'te'
    );
    // In a single-language mode the book name belongs to the scripture, so
    // the interface language must NOT change it.
    expect(teBibleEnUi?.reference).toBe(teBibleTeUi?.reference);
    expect(teBibleEnUi?.body).toEqual(teBibleTeUi?.body);

    // In bilingual mode the labels are chrome and follow the interface.
    const bothEnUi = resolveVerseOfTheDay(
      '2026-04-03',
      null,
      CONFIG,
      POOL,
      'bilingual',
      'en'
    );
    const bothTeUi = resolveVerseOfTheDay(
      '2026-04-03',
      null,
      CONFIG,
      POOL,
      'bilingual',
      'te'
    );
    expect(bothEnUi?.reference).not.toBe(bothTeUi?.reference);
    expect(bothEnUi?.body).toEqual(bothTeUi?.body);
    expect(bothEnUi?.body.kind).toBe('paired');
  });

  it('falls back when Firestore gave nothing', () => {
    const content = resolveVerseOfTheDay('2026-04-03', null, null, null, 'te', 'en');
    expect(content?.source).toBe('fallback');
    expect(content?.body).toMatchObject({ kind: 'text', language: 'te' });
    expect(content?.imageUrl).toBeNull();
  });

  it('falls back to the bundled set when the pool names a verse that does not exist', () => {
    // Psalm 151 is not in the canon. The congregation must still get a
    // verse, and every device must still agree on which one.
    const broken = [poolEntry('bad', 0, { bookId: 'psalms', chapter: 151, verse: 1 })];
    const content = resolveVerseOfTheDay('2026-04-03', null, CONFIG, broken, 'en', 'en');
    expect(content?.source).toBe('fallback');
    expect(content).toEqual(
      resolveVerseOfTheDay('2026-04-03', null, null, null, 'en', 'en')
    );
  });

  it('gives up rather than inventing content when even the date is unusable', () => {
    expect(resolveVerseOfTheDay('2026-02-30', null, CONFIG, POOL, 'en', 'en')).toBeNull();
  });

  it('never returns blank text or a blank reference on any path', () => {
    let date = '2026-01-01';
    for (let i = 0; i < 40; i += 1) {
      for (const mode of ['en', 'te', 'bilingual'] as const) {
        for (const [config, pool] of [
          [CONFIG, POOL],
          [null, null],
          [{ ...CONFIG, enabled: false }, POOL],
        ] as const) {
          const content = resolveVerseOfTheDay(date, null, config, pool, mode, 'en');
          expect(content).not.toBeNull();
          expect(content!.reference.trim().length).toBeGreaterThan(0);
          const body = content!.body;
          const texts =
            body.kind === 'text'
              ? [body.text]
              : body.kind === 'paired'
                ? [body.english, body.telugu]
                : [body.english];
          for (const text of texts) {
            expect(text.trim().length).toBeGreaterThan(0);
            expect(text).not.toContain('undefined');
          }
        }
      }
      date = addDays(date, 1)!;
    }
  });
});
