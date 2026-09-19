/**
 * The canonical Verse-of-the-Day date.
 *
 * =====================================================================
 * WHY NOT THE DEVICE'S DATE
 * =====================================================================
 * Until M5 the mobile app asked the DEVICE what day it was
 * (`todayDateString()` in mobile/src/services/firebase/dailyVerses.ts,
 * which
 * reads `new Date().getFullYear()` and friends in whatever zone the
 * phone happens to be in). That is fine for a church whose members are
 * all in one place and wrong the moment one of them travels: a member in
 * London would see tomorrow's verse at 18:30 their time, and a member in
 * California would still be on yesterday's verse at breakfast.
 *
 * The verse of the day is a CHURCH fact, not a device fact. This church
 * is in India, so the canonical date is the Indian calendar date, and
 * everyone sees the same verse at the same moment worldwide.
 *
 * =====================================================================
 * WHY A FIXED OFFSET RATHER THAN Intl / A TZ DATABASE
 * =====================================================================
 * India Standard Time is UTC+05:30 and has no daylight saving. It has
 * not observed DST since 1945, and the offset has never changed since.
 * So the whole conversion is one addition, which means:
 *
 *   - no dependency, and nothing to keep up to date;
 *   - no reliance on the JS engine shipping a full ICU database, which
 *     Hermes builds do not always have (a `timeZone: 'Asia/Kolkata'`
 *     formatter can throw or silently fall back to UTC there);
 *   - a function that is trivially testable at the minute boundaries
 *     that actually matter.
 *
 * ./__tests__/votdDate.test.ts cross-checks this against `Intl` where
 * the runtime does provide it, so the shortcut is verified rather than
 * merely asserted.
 *
 * =====================================================================
 * THIS FILE IS A MIRROR
 * =====================================================================
 * The identical module lives at
 * mobile/src/features/daily-verses/votdDate.ts. The two packages share no
 * code, and the admin dashboard needs the same answer as the phone,
 * because its date preview exists so a pastor can see what the
 * congregation will get -- a preview that disagrees with the app is worse
 * than no preview at all.
 *
 * A COLOUR DRIFTING IS VISIBLE; AN ALGORITHM DRIFTING IS NOT. It just
 * quietly shows a different verse. So the guard is stronger than reading
 * the two files side by side: __tests__/votdSelection.test.ts here
 * replays the SAME golden vectors that the mobile suite does, read from
 * mobile/src/features/daily-verses/__tests__/votd-vectors.json on disk.
 * Change either implementation and one of the two suites fails.
 *
 * Edit BOTH copies, or neither.
 */

/** India Standard Time, in minutes east of UTC. Constant since 1945. */
export const INDIA_UTC_OFFSET_MINUTES = 5 * 60 + 30;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** A calendar date in the canonical zone, as "YYYY-MM-DD". */
export type DateKey = string;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

/**
 * The Indian calendar date for a moment in time, as "YYYY-MM-DD".
 *
 * Shifting the instant by the offset and then reading the UTC fields is
 * what keeps this free of the host's own zone: `getUTCFullYear()` and
 * friends never consult the device's settings, where `getFullYear()`
 * always would.
 */
export function indiaDateKey(now: Date = new Date()): DateKey {
  const shifted = new Date(now.getTime() + INDIA_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Days since 1970-01-01 for a date key -- the sequence number the
 * selection algorithm advances by.
 *
 * Parsed as UTC midnight deliberately: the key already IS a calendar
 * date in the canonical zone, so re-interpreting it in the device's zone
 * (which `new Date("2026-03-01")` does NOT do, but
 * `new Date(2026, 2, 1)` would) could shift it by a day.
 *
 * Returns null for anything that is not a well-formed, real date, so a
 * corrupt value cannot silently become day zero.
 */
export function daysSinceEpoch(dateKey: string): number | null {
  if (!isDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  const utc = Date.UTC(year, month - 1, day);
  const parsed = new Date(utc);
  // Rejects 2026-02-30 and friends, which Date.UTC would happily roll
  // over into March.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utc / MS_PER_DAY);
}

/** The date key `days` days after `dateKey` -- used by the admin's date preview. */
export function addDays(dateKey: DateKey, days: number): DateKey | null {
  const base = daysSinceEpoch(dateKey);
  if (base === null) return null;
  return indiaDateKeyFromUtcDays(base + days);
}

function indiaDateKeyFromUtcDays(utcDays: number): DateKey {
  const date = new Date(utcDays * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
