import { describe, expect, it } from 'vitest';
import { currentProphetVerseId, stateOf } from '../state';
import type { ProphetVerseRecord } from '../../../services/firebase/prophetVerses';

/**
 * The publication rule, stated once and tested here.
 *
 * "Which prophet verse is showing" is not something a member can debug,
 * and it is not something an administrator can work out by looking at the
 * app -- so the rule has to be written down somewhere it can fail loudly.
 * This mirrors mobile/src/services/firebase/prophetVerses.ts; if the two
 * disagree, the admin page marks a different record than the app shows.
 */
const NOW = new Date('2026-04-05T12:00:00.000Z');

function record(partial: Partial<ProphetVerseRecord> = {}): ProphetVerseRecord {
  return {
    id: 'p1',
    title: 'A word',
    reference: 'Isaiah 43:19',
    text: 'Behold.',
    attribution: null,
    imageUrl: null,
    published: true,
    publishAt: new Date('2026-04-01T06:00:00.000Z'),
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe('the three states', () => {
  it('calls an unpublished record a draft, whatever its schedule says', () => {
    expect(stateOf(record({ published: false }), NOW)).toBe('draft');
    expect(
      stateOf(record({ published: false, publishAt: new Date('2020-01-01') }), NOW)
    ).toBe('draft');
  });

  it('calls a published record with a future moment scheduled', () => {
    expect(
      stateOf(record({ publishAt: new Date('2026-04-06T00:00:00.000Z') }), NOW)
    ).toBe('scheduled');
  });

  it('calls a published record whose moment has passed showing', () => {
    expect(stateOf(record(), NOW)).toBe('showing');
  });

  it('treats a record with no moment at all as scheduled, never as showing', () => {
    // A malformed document must not appear to be live.
    expect(stateOf(record({ publishAt: null }), NOW)).toBe('scheduled');
  });

  it('counts the exact moment as arrived', () => {
    expect(stateOf(record({ publishAt: NOW }), NOW)).toBe('showing');
  });
});

describe('which one the app is showing', () => {
  it('is nothing when nothing qualifies', () => {
    expect(currentProphetVerseId([], NOW)).toBeNull();
    expect(currentProphetVerseId([record({ published: false })], NOW)).toBeNull();
    expect(
      currentProphetVerseId([record({ publishAt: new Date('2099-01-01') })], NOW)
    ).toBeNull();
  });

  it('is the most recently scheduled one that is due', () => {
    const older = record({ id: 'old', publishAt: new Date('2026-03-01T00:00:00.000Z') });
    const newer = record({ id: 'new', publishAt: new Date('2026-04-04T00:00:00.000Z') });
    const future = record({
      id: 'future',
      publishAt: new Date('2026-05-01T00:00:00.000Z'),
    });
    expect(currentProphetVerseId([older, newer, future], NOW)).toBe('new');
  });

  it('ignores a draft even when its moment is the most recent', () => {
    const live = record({ id: 'live', publishAt: new Date('2026-03-01T00:00:00.000Z') });
    const draft = record({
      id: 'draft',
      published: false,
      publishAt: new Date('2026-04-04T00:00:00.000Z'),
    });
    expect(currentProphetVerseId([live, draft], NOW)).toBe('live');
  });

  it('breaks an exact tie by document id DESCENDING, as Firestore does', () => {
    // The app's query orders by publishAt desc and limit(1), so Firestore's
    // implicit __name__ ordering follows in the same direction. Matching it
    // here is what keeps this page honest.
    const at = new Date('2026-04-01T06:00:00.000Z');
    const a = record({ id: 'aaa', publishAt: at });
    const z = record({ id: 'zzz', publishAt: at });
    expect(currentProphetVerseId([a, z], NOW)).toBe('zzz');
    expect(currentProphetVerseId([z, a], NOW)).toBe('zzz');
  });

  it('does not depend on the order the records arrived in', () => {
    const older = record({ id: 'old', publishAt: new Date('2026-03-01T00:00:00.000Z') });
    const newer = record({ id: 'new', publishAt: new Date('2026-04-04T00:00:00.000Z') });
    expect(currentProphetVerseId([older, newer], NOW)).toBe(
      currentProphetVerseId([newer, older], NOW)
    );
  });
});
