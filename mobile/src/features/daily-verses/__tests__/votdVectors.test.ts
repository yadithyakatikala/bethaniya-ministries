import { readFileSync } from 'fs';
import { join } from 'path';
import {
  prepareVersePool,
  selectVerseForDate,
  type VersePoolEntry,
} from '../votdSelection';

/**
 * The golden vectors -- 324 (pool, seed, poolVersion, date) -> verse
 * answers, checked against this implementation.
 *
 * WHY A FIXTURE AND NOT JUST MORE UNIT TESTS. The admin dashboard has to
 * compute the same answer as the phone: its date-preview exists so a
 * pastor can see what the congregation will get, and a preview that
 * disagrees with the app is worse than no preview. The two builds share
 * no package, so the algorithm is written twice -- exactly the situation
 * the M3 design tokens are in, where ../../../theme/__tests__ guards the
 * copy.
 *
 * A colour drifting is visible. An ALGORITHM drifting is not: it just
 * quietly shows a different verse. So the guard here is stronger than a
 * value-by-value comparison -- both suites replay the same vectors, and
 * admin/src/features/daily-verses/__tests__/votdSelection.test.ts reads
 * THIS file from disk. If either implementation changes, one of the two
 * fails.
 *
 * To regenerate after a DELIBERATE algorithm change, see this file's
 * sibling test: the fixture is data, not something to hand-edit.
 */
interface Vectors {
  pools: Record<string, VersePoolEntry[]>;
  preparedIds: Record<string, string[]>;
  vectors: {
    pool: string;
    seed: string;
    poolVersion: number;
    date: string;
    expectedId: string | null;
  }[];
}

const FIXTURE: Vectors = JSON.parse(
  readFileSync(join(__dirname, 'votd-vectors.json'), 'utf8')
) as Vectors;

describe('the golden vectors', () => {
  it('covers every pool shape and a run of consecutive days', () => {
    expect(Object.keys(FIXTURE.pools).sort()).toEqual([
      'seven',
      'twelve',
      'withInactive',
    ]);
    expect(FIXTURE.vectors.length).toBeGreaterThanOrEqual(300);
  });

  it('prepares each pool into the order the index is taken against', () => {
    for (const [name, pool] of Object.entries(FIXTURE.pools)) {
      expect(prepareVersePool(pool).map((entry) => entry.id)).toEqual(
        FIXTURE.preparedIds[name]
      );
    }
  });

  it('reproduces every recorded answer', () => {
    const mismatches: string[] = [];
    for (const vector of FIXTURE.vectors) {
      const chosen = selectVerseForDate(
        vector.date,
        { enabled: true, seed: vector.seed, poolVersion: vector.poolVersion },
        FIXTURE.pools[vector.pool]!
      );
      const actual = chosen?.id ?? null;
      if (actual !== vector.expectedId) {
        mismatches.push(
          `${vector.pool} seed=${vector.seed} v${vector.poolVersion} ${vector.date}: ` +
            `expected ${vector.expectedId}, got ${actual}`
        );
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
    expect(mismatches).toHaveLength(0);
  });
});
