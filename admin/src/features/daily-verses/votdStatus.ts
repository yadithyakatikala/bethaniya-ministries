/**
 * WHICH VERSE THE APP WILL SHOW, ON ANY DATE.
 *
 * One function, used by every panel of the Verse of the Day page: the
 * "today" card, the date preview, and the year-long schedule. Before
 * this, the preview computed its own answer and the rest of the
 * dashboard did not compute one at all, so "what will the congregation
 * actually get" was a question only one screen could answer and only for
 * one day at a time.
 *
 * ---------------------------------------------------------------------
 * THE SAME THREE STEPS THE PHONE TAKES
 * ---------------------------------------------------------------------
 *   1. SET BY HAND   a daily_verses document for that exact date, with
 *                    both a reference and text. The administrator's own
 *                    words; nothing overrides them.
 *   2. THE CHURCH'S POOL   the rotation over whatever this church has
 *                    curated, if automatic selection is on and the pool
 *                    has a usable entry.
 *   3. THE BUILT-IN YEAR   365 references the app carries itself,
 *                    rotated with their own fixed configuration.
 *
 * This mirrors mobile/src/features/daily-verses/votdResolver.ts step for
 * step. It has to: a schedule that disagrees with the phone is worse
 * than no schedule. The two are kept in step by ./votdYear.ts, which is
 * generated into both packages byte for byte, and by the golden vectors
 * both suites replay (see ./votdSelection.ts's header).
 *
 * ---------------------------------------------------------------------
 * REFERENCES, NOT TEXT
 * ---------------------------------------------------------------------
 * The dashboard never renders a verse. The Bible is bundled in the app,
 * not here, which is the whole reason the pool stores references -- and
 * the reason this module returns one. What a pastor needs from a
 * schedule is which verse and where it came from, not eight megabytes of
 * scripture in a browser tab.
 */
import { selectVerseForDate, type VersePoolEntry, type VotdConfig } from './votdSelection';
import { VOTD_YEAR_CONFIG, bundledVerseYear } from './votdYear';
import { addDays } from './votdDate';
import type { DailyVerse } from '../../types';

/** Where a day's verse comes from. The three steps above, named. */
export type VotdDaySource = 'override' | 'pool' | 'year';

export interface VotdDay {
  dateKey: string;
  source: VotdDaySource;
  /** Display reference, e.g. "John 3:16". Never verse text. */
  reference: string;
}

/**
 * Overrides indexed by date.
 *
 * Firestore can legitimately hold more than one document for a date --
 * the collection is keyed by document id, not by date -- so the FIRST in
 * the list wins, matching the order the app's own listener delivers.
 */
export function indexOverridesByDate(overrides: DailyVerse[]): Map<string, DailyVerse> {
  const byDate = new Map<string, DailyVerse>();
  for (const verse of overrides) {
    if (!byDate.has(verse.date)) byDate.set(verse.date, verse);
  }
  return byDate;
}

/** True only for an override the app would actually honour. */
function isUsableOverride(verse: DailyVerse | undefined): verse is DailyVerse {
  return Boolean(verse && verse.reference.trim() && verse.text.trim());
}

/**
 * The verse for one date, and where it came from.
 *
 * Returns null only for a date the calendar does not have -- 30 February
 * typed into the picker -- which the caller shows as "choose a date"
 * rather than as a verse.
 */
export function resolveVotdDay(
  dateKey: string,
  config: VotdConfig,
  pool: VersePoolEntry[],
  overrideByDate: Map<string, DailyVerse>
): VotdDay | null {
  const override = overrideByDate.get(dateKey);
  if (isUsableOverride(override)) {
    return { dateKey, source: 'override', reference: override.reference.trim() };
  }

  if (config.enabled) {
    const entry = selectVerseForDate(dateKey, config, pool);
    if (entry) return { dateKey, source: 'pool', reference: entry.reference };
  }

  // The app's own year. Note that this runs even when automatic
  // selection is PAUSED: pausing stops the church's pool being used, it
  // does not leave the congregation with a blank card, and saying
  // otherwise on this page would misdescribe what the phone does.
  const year = selectVerseForDate(dateKey, VOTD_YEAR_CONFIG, bundledVerseYear());
  return year ? { dateKey, source: 'year', reference: year.reference } : null;
}

/**
 * A run of consecutive days, starting at `from`.
 *
 * Built by stepping the date, not by stepping an index: the rotation
 * counts days since the epoch, so a schedule that skipped a day would
 * silently renumber the rest of the year.
 */
export function resolveVotdSchedule(
  from: string,
  days: number,
  config: VotdConfig,
  pool: VersePoolEntry[],
  overrideByDate: Map<string, DailyVerse>
): VotdDay[] {
  const schedule: VotdDay[] = [];
  let dateKey: string | null = from;
  for (let day = 0; day < days && dateKey; day += 1) {
    const resolved = resolveVotdDay(dateKey, config, pool, overrideByDate);
    if (resolved) schedule.push(resolved);
    dateKey = addDays(dateKey, 1);
  }
  return schedule;
}

/**
 * How long the cycle currently is, in days, and what is driving it.
 *
 * This is the number a church administrator actually wants: "how long
 * before a verse comes round again". It is simply the length of
 * whichever pool is in use, because the rotation visits every entry once
 * before repeating -- see ./votdSelection.ts.
 */
export interface VotdCycle {
  /** 'pool' when the church curated its own, 'year' when the app's is in use. */
  using: 'pool' | 'year';
  /** Days before a verse comes round again. */
  days: number;
}

export function votdCycle(config: VotdConfig, preparedPool: VersePoolEntry[]): VotdCycle {
  if (config.enabled && preparedPool.length > 0) {
    return { using: 'pool', days: preparedPool.length };
  }
  return { using: 'year', days: bundledVerseYear().length };
}
