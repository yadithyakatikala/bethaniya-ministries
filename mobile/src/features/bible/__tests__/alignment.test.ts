import {
  buildBilingualChapter,
  formatVerseForSharing,
  type VerseSpan,
} from '../alignment';
import {
  ABSENT_CHAPTERS,
  ALIGNED_CHAPTERS,
  DIVERGENT_CHAPTERS,
  MERGED_RANGE_CHAPTERS,
  TOTAL_CHAPTERS,
  alignmentFor,
} from '../versificationData';
import { BIBLE_BOOKS } from '../books';
import englishData from '../data/web-en.json';
import teluguData from '../data/irv-te.json';
import type { BibleVerse } from '../types';

/**
 * The bilingual reader's correctness net.
 *
 * THE RULE BEING DEFENDED: an English verse must never appear beside a
 * Telugu verse that is not the same verse. V1 shipped a Telugu Bible
 * whose import dropped `<range>` markers, so verse numbers skipped, and
 * which rendered SYNTHETIC placeholder text for two chapters the source
 * does not contain. Both are the kind of defect that a screenshot review
 * cannot catch and a reader would have to know scripture to notice.
 *
 * The exhaustive block below therefore runs the real policy over the real
 * bundled data for all 1189 chapters, rather than trusting a handful of
 * spot checks.
 */

const english = englishData as Record<string, Record<string, string[]>>;
const telugu = teluguData as unknown as Record<
  string,
  Record<string, [number, number, string][]>
>;

function englishVerses(order: number, chapter: number): BibleVerse[] {
  const texts = english[String(order)]?.[String(chapter)] ?? [];
  return texts.map((text, index) => ({ number: index + 1, text }));
}

function teluguSpans(order: number, chapter: number): VerseSpan[] | null {
  const raw = telugu[String(order)]?.[String(chapter)];
  if (!raw) return null;
  return raw.map(([start, end, text]) => ({ start, end, text }));
}

describe('buildBilingualChapter — the pairing policy', () => {
  const en: BibleVerse[] = [
    { number: 1, text: 'one' },
    { number: 2, text: 'two' },
    { number: 3, text: 'three' },
  ];

  it('pairs verse for verse when both translations agree', () => {
    const result = buildBilingualChapter(1, 1, en, [
      { start: 1, end: 1, text: 'ఒకటి' },
      { start: 2, end: 2, text: 'రెండు' },
      { start: 3, end: 3, text: 'మూడు' },
    ]);
    expect(result.kind).toBe('paired');
    if (result.kind !== 'paired') throw new Error('expected paired');
    expect(result.rows.map((r) => r.label)).toEqual(['1', '2', '3']);
    expect(result.rows[1]).toMatchObject({ english: 'two', telugu: 'రెండు' });
  });

  it('labels a merged range and joins the English verses it covers', () => {
    // This is the Luke 1:39-40 shape: one Telugu unit, two English verses.
    const result = buildBilingualChapter(1, 1, en, [
      { start: 1, end: 2, text: 'ఒకటి-రెండు' },
      { start: 3, end: 3, text: 'మూడు' },
    ]);
    if (result.kind !== 'paired') throw new Error('expected paired');
    expect(result.rows[0]).toMatchObject({
      label: '1-2',
      start: 1,
      end: 2,
      english: 'one two',
      telugu: 'ఒకటి-రెండు',
    });
    expect(result.rows).toHaveLength(2);
  });

  it('refuses to pair when a span reaches past the English text', () => {
    // Data drift: the classification says aligned but the spans disagree.
    // Degrading is correct; emitting a row we cannot substantiate is not.
    const result = buildBilingualChapter(1, 1, en, [{ start: 1, end: 9, text: 'x' }]);
    expect(result.kind).toBe('chapterLevel');
  });

  it('refuses to pair when the Telugu spans do not cover the whole chapter', () => {
    // Pairing here would silently hide English verse 3.
    const result = buildBilingualChapter(1, 1, en, [
      { start: 1, end: 1, text: 'ఒకటి' },
      { start: 2, end: 2, text: 'రెండు' },
    ]);
    expect(result.kind).toBe('chapterLevel');
  });

  it('shows English only, with a notice, when Telugu has no text', () => {
    const result = buildBilingualChapter(1, 1, en, null);
    expect(result).toMatchObject({ kind: 'englishOnly', notice: 'notInTranslation' });
  });

  it('never invents Telugu text for a chapter the source lacks', () => {
    const result = buildBilingualChapter(39, 4, en, null);
    if (result.kind !== 'englishOnly') throw new Error('expected englishOnly');
    expect(JSON.stringify(result)).not.toContain('placeholder');
    expect(JSON.stringify(result)).not.toContain('Development content');
  });
});

describe('the generated versification classification', () => {
  it('covers every chapter of the canon exactly once', () => {
    const canonChapters = BIBLE_BOOKS.reduce((sum, book) => sum + book.chapterCount, 0);
    expect(TOTAL_CHAPTERS).toBe(canonChapters);
    expect(TOTAL_CHAPTERS).toBe(1189);
    expect(ALIGNED_CHAPTERS + DIVERGENT_CHAPTERS + ABSENT_CHAPTERS).toBe(TOTAL_CHAPTERS);
  });

  it('reports the counts this data set actually has', () => {
    // These are assertions about the SHIPPED data. If an import changes
    // them, that is a deliberate decision that should update this test,
    // not something that should pass silently.
    expect(ALIGNED_CHAPTERS).toBe(1147);
    expect(DIVERGENT_CHAPTERS).toBe(41);
    expect(ABSENT_CHAPTERS).toBe(1);
    expect(MERGED_RANGE_CHAPTERS).toBe(63);
  });

  it('marks Malachi 4 absent — the one chapter with no Telugu text', () => {
    expect(alignmentFor(39, 4)).toBe('absent');
  });

  it('defaults an unclassified chapter to aligned', () => {
    expect(alignmentFor(1, 1)).toBe('aligned');
  });
});

describe('the shipped Telugu data itself', () => {
  it('has no gaps, overlaps, or empty verses in any chapter', () => {
    const problems: string[] = [];
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapterCount; chapter += 1) {
        const spans = teluguSpans(book.order, chapter);
        if (!spans) continue;
        let previousEnd = 0;
        for (const span of spans) {
          const where = `${book.id} ${chapter}:${span.start}`;
          if (span.end < span.start) problems.push(`${where} ends before it starts`);
          if (span.start <= previousEnd) problems.push(`${where} overlaps ${previousEnd}`);
          if (!span.text.trim()) problems.push(`${where} has empty text`);
          previousEnd = span.end;
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('preserves the merged ranges V1 dropped — Luke 1:39-40 is one unit', () => {
    // Luke is book 42. V1's import lost the <range> marker on verse 40,
    // so the reader jumped 39 -> 41 and looked like it was missing text.
    const spans = teluguSpans(42, 1);
    expect(spans).not.toBeNull();
    const merged = spans!.filter((span) => span.end > span.start);
    expect(merged.length).toBeGreaterThan(0);
    const span3940 = spans!.find((s) => s.start === 39);
    expect(span3940).toMatchObject({ start: 39, end: 40 });
    // And no verse number between 1 and the chapter's last is skipped.
    const covered = new Set<number>();
    for (const span of spans!) {
      for (let v = span.start; v <= span.end; v += 1) covered.add(v);
    }
    const last = Math.max(...covered);
    const skipped = [];
    for (let v = 1; v <= last; v += 1) if (!covered.has(v)) skipped.push(v);
    expect(skipped).toEqual([]);
  });
});

describe('exhaustive: every chapter in the canon', () => {
  it('never pairs an English verse with a Telugu verse of another number', () => {
    const violations: string[] = [];
    let paired = 0;
    let chapterLevel = 0;
    let englishOnly = 0;

    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapterCount; chapter += 1) {
        const en = englishVerses(book.order, chapter);
        const result = buildBilingualChapter(
          book.order,
          chapter,
          en,
          teluguSpans(book.order, chapter)
        );
        const where = `${book.id} ${chapter}`;

        if (result.kind === 'paired') {
          paired += 1;
          const seen = new Set<number>();
          for (const row of result.rows) {
            if (row.end < row.start) violations.push(`${where}: inverted row ${row.label}`);
            for (let v = row.start; v <= row.end; v += 1) {
              if (seen.has(v)) violations.push(`${where}: verse ${v} paired twice`);
              seen.add(v);
              // The English text in this row must be the text of a verse
              // the row actually covers -- this is the anti-mis-pairing
              // assertion.
              const expected = en.find((verse) => verse.number === v);
              if (!expected) {
                violations.push(`${where}: row ${row.label} covers absent English verse ${v}`);
              } else if (!row.english.includes(expected.text)) {
                violations.push(`${where}: row ${row.label} omits English verse ${v}`);
              }
            }
          }
          if (seen.size !== en.length) {
            violations.push(`${where}: paired ${seen.size} of ${en.length} English verses`);
          }
        } else if (result.kind === 'chapterLevel') {
          chapterLevel += 1;
          if (result.notice !== 'numberingDiffers') violations.push(`${where}: wrong notice`);
        } else {
          englishOnly += 1;
          if (result.notice !== 'notInTranslation') violations.push(`${where}: wrong notice`);
        }
      }
    }

    expect(violations).toEqual([]);
    expect(paired + chapterLevel + englishOnly).toBe(1189);
    expect(paired).toBe(ALIGNED_CHAPTERS);
    expect(chapterLevel).toBe(DIVERGENT_CHAPTERS);
    expect(englishOnly).toBe(ABSENT_CHAPTERS);
  });

  it('gives divergent chapters both sides unpaired, never a partial pairing', () => {
    // Numbers 16 is the clearest case: English runs to 50, Telugu to 35.
    const result = buildBilingualChapter(
      4,
      16,
      englishVerses(4, 16),
      teluguSpans(4, 16)
    );
    expect(result).toMatchObject({ kind: 'chapterLevel', notice: 'numberingDiffers' });
    if (result.kind !== 'chapterLevel') throw new Error('expected chapterLevel');
    expect(result.english).toHaveLength(50);
    expect(result.telugu.length).toBeGreaterThan(0);
    expect(Math.max(...result.telugu.map((s) => s.end))).toBe(35);
  });
});

describe('formatVerseForSharing', () => {
  it('produces a clean quote with its reference and translation', () => {
    expect(
      formatVerseForSharing({
        bookName: 'John',
        chapter: 3,
        label: '16',
        text: '  For God so loved the world…  ',
        translationName: 'WEB',
      })
    ).toBe('"For God so loved the world…"\n\nJohn 3:16 (WEB)');
  });

  it('keeps a merged range label intact in the reference', () => {
    expect(
      formatVerseForSharing({
        bookName: 'లూకా',
        chapter: 1,
        label: '39-40',
        text: 'text',
        translationName: 'IRV 2019',
      })
    ).toContain('లూకా 1:39-40 (IRV 2019)');
  });
});
