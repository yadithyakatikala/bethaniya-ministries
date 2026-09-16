import { APP_CREATED_NOTICE, SEED_PLANS } from '../seedPlans';
import { BIBLE_BOOKS } from '../../bible/books';

/**
 * The five starter reading plans, as data.
 *
 * These assertions exist for two reasons. The first is the tester
 * requirement: exactly five plans must be available in V1. The second
 * matters more -- these plans are APP-CREATED, not authored by Bethaniya
 * Ministries (no official church material was found; see
 * /PLANS_SOURCES.md), so the tests pin the things that keep that honest:
 * every plan says so in its description, every scripture reference points
 * at a real book and a chapter that book actually has, and no scripture
 * TEXT is reproduced in the seed data.
 */
describe('SEED_PLANS', () => {
  it('provides exactly five plans', () => {
    expect(SEED_PLANS).toHaveLength(5);
  });

  it('gives every plan a unique, slug-shaped id', () => {
    const ids = SEED_PLANS.map((seed) => seed.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('declares in every description that the plan is app-created', () => {
    // A member opening a seeded plan must be able to tell the church has
    // not written it yet.
    for (const { plan } of SEED_PLANS) {
      expect(plan.description).toContain(APP_CREATED_NOTICE);
    }
  });

  it('never claims to be authored or endorsed by the church', () => {
    const everything = JSON.stringify(SEED_PLANS);
    for (const claim of [
      'Bethaniya Ministries presents',
      'official',
      'authored by',
      'endorsed',
      'Pastor',
    ]) {
      expect(everything).not.toContain(claim);
    }
  });

  it('has dayCount matching the number of days actually supplied', () => {
    for (const { id, plan, days } of SEED_PLANS) {
      expect(`${id}: ${days.length}`).toBe(`${id}: ${plan.dayCount}`);
    }
  });

  it('numbers days from 1 with no gaps or duplicates', () => {
    for (const { id, days } of SEED_PLANS) {
      const numbers = days.map((day) => day.dayNumber);
      expect(`${id}: ${numbers.join(',')}`).toBe(
        `${id}: ${days.map((_, index) => index + 1).join(',')}`
      );
    }
  });

  it('fills in every field the Plans data model requires', () => {
    for (const { plan, days } of SEED_PLANS) {
      expect(plan.title.length).toBeGreaterThan(0);
      expect(plan.description.length).toBeGreaterThan(0);
      expect(plan.category.length).toBeGreaterThan(0);
      // No cover images: inventing church imagery is not this script's job.
      expect(plan.coverImageUrl).toBeNull();
      for (const day of days) {
        expect(day.title.length).toBeGreaterThan(0);
        expect(day.scriptureReference.length).toBeGreaterThan(0);
        expect(day.devotional.length).toBeGreaterThan(0);
        expect(day.prayerPrompt.length).toBeGreaterThan(0);
      }
    }
  });

  // --- Every reference must be real -------------------------------------
  // The devotional text is app-written, but a wrong scripture reference
  // would send a member to the wrong passage, so each one is checked
  // against the canon metadata in ../../bible/books.ts.

  /** "Psalm 23", "Luke 1:1-25", "Isaiah 7:14; Matthew 1:18-25" -> parts. */
  function parseReferences(reference: string) {
    return reference.split(';').map((part) => {
      const match = part
        .trim()
        .match(/^((?:[1-3]\s)?[A-Za-z][A-Za-z\s]*?)\s+(\d+)(?::[\d\s,-]+)?$/);
      if (!match) throw new Error(`unparseable reference: "${part.trim()}"`);
      return { book: match[1].trim(), chapter: Number(match[2]) };
    });
  }

  /** books.ts uses the plural "Psalms"; references are cited "Psalm 23". */
  const ALIASES: Record<string, string> = { Psalm: 'Psalms' };

  it('cites only real books, at chapters those books have', () => {
    const byName = new Map(BIBLE_BOOKS.map((book) => [book.name, book]));

    for (const { id, days } of SEED_PLANS) {
      for (const day of days) {
        for (const { book, chapter } of parseReferences(day.scriptureReference)) {
          const resolved = byName.get(ALIASES[book] ?? book);
          expect(`${id} day ${day.dayNumber}: ${book}`).toBe(
            `${id} day ${day.dayNumber}: ${resolved ? book : 'UNKNOWN BOOK'}`
          );
          expect(
            `${id} day ${day.dayNumber}: ${book} ${chapter} of ${resolved?.chapterCount}`
          ).toBe(
            `${id} day ${day.dayNumber}: ${book} ${
              chapter >= 1 && chapter <= (resolved?.chapterCount ?? 0)
                ? chapter
                : 'OUT OF RANGE'
            } of ${resolved?.chapterCount}`
          );
        }
      }
    }
  });

  it('reproduces no scripture text -- only references', () => {
    // The plan screens render the reference and let the Bible module
    // supply the verses from its own licensed datasets, so no verse text
    // should ever be pasted into this file.
    for (const { days } of SEED_PLANS) {
      for (const day of days) {
        // A quoted sentence of scripture would be far longer than this.
        expect(day.scriptureReference.length).toBeLessThan(40);
        // And no Telugu/other-script scripture text got in here either.
        expect(day.devotional).not.toMatch(/[ఀ-౿]/);
      }
    }
  });

  it('covers a useful spread of durations', () => {
    // 5, 7, 7, 10 and 14 days -- a member with a spare week and one with a
    // spare fortnight both have something.
    const durations = SEED_PLANS.map((seed) => seed.plan.dayCount).sort((a, b) => a - b);
    expect(durations).toEqual([5, 7, 7, 10, 14]);
  });
});
