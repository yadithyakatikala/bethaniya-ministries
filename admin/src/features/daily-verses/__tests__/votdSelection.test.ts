import { describe, expect, it } from 'vitest';
// Read as raw text through Vite rather than with `fs`: this package's
// TypeScript is deliberately browser-only (tsconfig.app.json's
// `types: ["vite/client"]`), and pulling in Node's types just to read one
// fixture would weaken that boundary for every file.
import fixtureText from '../../../../../mobile/src/features/daily-verses/__tests__/votd-vectors.json?raw';
import {
  INDIA_UTC_OFFSET_MINUTES,
  addDays,
  daysSinceEpoch,
  indiaDateKey,
  isDateKey,
} from '../votdDate';
import {
  DEFAULT_VOTD_CONFIG,
  prepareVersePool,
  selectVerseForDate,
  type VersePoolEntry,
} from '../votdSelection';

/**
 * THE CROSS-PACKAGE GUARD.
 *
 * ./votdDate.ts and ./votdSelection.ts are mirrors of the mobile app's
 * copies. The admin dashboard's date preview exists so a pastor can see
 * what the congregation will get, and a preview that disagrees with the
 * app is worse than no preview at all -- but the two packages share no
 * code, so the algorithm is written twice.
 *
 * A COLOUR DRIFTING IS VISIBLE. AN ALGORITHM DRIFTING IS NOT: it just
 * quietly shows a different verse. So this file does not compare the two
 * sources; it replays the SAME golden vectors the mobile suite replays,
 * read from the mobile package on disk. Change either implementation and
 * one of the two suites fails.
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

const FIXTURE = JSON.parse(fixtureText) as Vectors;

describe('the mirrored selection algorithm', () => {
  it('reads the mobile package’s own golden vectors', () => {
    expect(FIXTURE.vectors.length).toBeGreaterThanOrEqual(300);
    expect(Object.keys(FIXTURE.pools).sort()).toEqual([
      'seven',
      'twelve',
      'withInactive',
    ]);
  });

  it('prepares each pool into the same order the app does', () => {
    for (const [name, pool] of Object.entries(FIXTURE.pools)) {
      expect(prepareVersePool(pool).map((entry) => entry.id)).toEqual(
        FIXTURE.preparedIds[name]
      );
    }
  });

  it('reproduces every recorded answer, exactly as the app does', () => {
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

  it('agrees with the app on the DEFAULT configuration too', () => {
    // A different default seed in one package would mean the preview and
    // the app disagreed on every date from the moment of installation.
    expect(DEFAULT_VOTD_CONFIG).toEqual({
      enabled: true,
      seed: 'maranatha',
      poolVersion: 1,
    });
  });
});

describe('the mirrored canonical date', () => {
  it('rolls over at midnight in India, not at midnight UTC', () => {
    expect(indiaDateKey(new Date('2026-03-14T18:29:59.000Z'))).toBe('2026-03-14');
    expect(indiaDateKey(new Date('2026-03-14T18:30:00.000Z'))).toBe('2026-03-15');
  });

  it('reads an instant through a fixed +05:30 offset, never the host zone', () => {
    // A pastor previewing from another country must see the date the
    // congregation is on, not the date their own laptop is on. The
    // implementation only ever reads getUTC* fields after shifting by this
    // offset, so the host zone cannot enter into it. The mobile suite
    // demonstrates that directly by swapping TZ, which needs Node's own
    // API -- deliberately not available to this browser-only package.
    expect(INDIA_UTC_OFFSET_MINUTES).toBe(330);
    expect(indiaDateKey(new Date('2026-03-14T20:00:00.000Z'))).toBe('2026-03-15');
    expect(indiaDateKey(new Date('2025-12-31T18:30:00.000Z'))).toBe('2026-01-01');
  });

  it('counts and steps days the same way the app does', () => {
    expect(daysSinceEpoch('1970-01-01')).toBe(0);
    expect(daysSinceEpoch('2026-02-30')).toBeNull();
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(isDateKey('2026-3-14')).toBe(false);
  });
});
