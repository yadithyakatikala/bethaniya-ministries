/**
 * =====================================================================
 * HOW THE VERSE OF THE DAY IS CHOSEN
 * =====================================================================
 * Deterministically, from three inputs and nothing else:
 *
 *     the date        the canonical Indian calendar date (./votdDate.ts)
 *     the seed        an admin-chosen string
 *     the poolVersion an admin-chosen integer
 *
 * The same three inputs always produce the same verse, on every device,
 * with no server and no stored "today's pick". Two members opening the
 * app in different countries see the same verse because they compute the
 * same answer, not because something told them.
 *
 * There is NO Math.random() here, and there cannot be: a random pick
 * would give two members different verses on the same day, and would
 * give the same member a different verse each time the app reloaded.
 *
 * ---------------------------------------------------------------------
 * THE ALGORITHM: A SEEDED FULL-CYCLE ROTATION
 * ---------------------------------------------------------------------
 * Given a pool of `n` active entries in a stable order:
 *
 *     offset = hash(seed | poolVersion) mod n
 *     stride = the first value >= 1 derived from the same hash that is
 *              COPRIME with n
 *     index  = (offset + daysSinceEpoch(date) * stride) mod n
 *
 * Why a rotation rather than simply hashing the date:
 *
 *   * Because `stride` is coprime with `n`, stepping by it visits every
 *     entry exactly once before repeating. A congregation gets all `n`
 *     verses over `n` days -- no verse twice in a fortnight while
 *     another never appears, which is what a plain date-hash does.
 *   * Consecutive days can never collide (for n > 1), because the step
 *     between them is `stride`, which is never 0 mod n.
 *   * It is still position-independent in time: you can compute any
 *     past or future date directly, which is what the admin's date
 *     preview needs.
 *
 * Changing the seed changes BOTH the starting point and the stride, so
 * it genuinely reshuffles the sequence rather than merely rotating it.
 * Changing poolVersion does the same, which is what makes it a
 * deliberate "start the cycle again differently" control after the pool
 * has been edited.
 *
 * ---------------------------------------------------------------------
 * THE POOL ORDER IS NOT FIRESTORE'S ORDER
 * ---------------------------------------------------------------------
 * Entries are sorted here, by `order` then by id, before anything is
 * computed. Firestore hands back documents in whatever order it likes;
 * if the index were taken against that, two devices could legitimately
 * disagree about today's verse. Sorting is what makes the pool an
 * ordered list rather than a set.
 *
 * =====================================================================
 * THIS FILE IS A MIRROR
 * =====================================================================
 * The identical module lives at
 * mobile/src/features/daily-verses/votdSelection.ts. The two packages share no
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
import { daysSinceEpoch } from './votdDate';

/** One entry of the automated pool -- a REFERENCE, never verse text. */
export interface VersePoolEntry {
  id: string;
  /** Display reference, e.g. "John 3:16". Not an identifier. */
  reference: string;
  /** Canonical book slug from ./bibleStructure.ts -- never a localized name. */
  bookId: string;
  chapter: number;
  verse: number;
  /** Sort position. Ties are broken by id, so the order is total. */
  order: number;
  active: boolean;
}

export interface VotdConfig {
  /** When false the automated pool is not consulted at all. */
  enabled: boolean;
  seed: string;
  poolVersion: number;
}

export const DEFAULT_VOTD_CONFIG: VotdConfig = {
  enabled: true,
  seed: 'maranatha',
  poolVersion: 1,
};

/**
 * FNV-1a, 32-bit.
 *
 * Chosen because it is four lines, has no dependency, and is completely
 * specified -- which for this purpose matters more than avalanche
 * quality. The requirement is "the same string always gives the same
 * number, on every JS engine", and `>>> 0` keeps it in unsigned 32-bit
 * range so Hermes and V8 cannot disagree about sign.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // The FNV prime, 16777619, multiplied without losing the low bits to
    // float rounding.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * Sorts the pool into the total order the index is taken against, and
 * drops anything that cannot be a verse of the day.
 *
 * DUPLICATES: two entries pointing at the same verse would make that
 * verse twice as likely and would break the "each verse once per cycle"
 * property. The first one in sort order wins, so the result is the same
 * on every device regardless of what Firestore returned.
 */
export function prepareVersePool(entries: VersePoolEntry[]): VersePoolEntry[] {
  const active = entries.filter(
    (entry) =>
      entry.active &&
      typeof entry.bookId === 'string' &&
      entry.bookId.length > 0 &&
      Number.isInteger(entry.chapter) &&
      entry.chapter >= 1 &&
      Number.isInteger(entry.verse) &&
      entry.verse >= 1
  );

  const sorted = [...active].sort((a, b) =>
    a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order
  );

  const seen = new Set<string>();
  return sorted.filter((entry) => {
    const key = `${entry.bookId}:${entry.chapter}:${entry.verse}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The stride: the first candidate at or above 1 that is coprime with
 * `n`, which is what makes the rotation visit every entry.
 *
 * Bounded by `n` iterations because among any `n` consecutive integers
 * at least one is coprime with `n` (1 always is), so this always
 * terminates -- and returns 1 in the degenerate case rather than
 * looping.
 */
export function strideFor(hash: number, n: number): number {
  if (n <= 1) return 1;
  const start = (hash % (n - 1)) + 1;
  for (let i = 0; i < n; i += 1) {
    const candidate = ((start + i - 1) % (n - 1)) + 1;
    if (gcd(candidate, n) === 1) return candidate;
  }
  return 1;
}

/**
 * The index into a PREPARED pool for one date, or null when there is
 * nothing to choose from or the date is unusable.
 */
export function selectPoolIndex(
  dateKey: string,
  config: VotdConfig,
  poolSize: number
): number | null {
  if (poolSize <= 0) return null;
  const day = daysSinceEpoch(dateKey);
  if (day === null) return null;

  const hash = fnv1a32(`${config.seed}|${config.poolVersion}`);
  const offset = hash % poolSize;
  const stride = strideFor(hash, poolSize);

  // `day` can be negative for dates before 1970; the extra `+ poolSize`
  // keeps the result non-negative, since JS's % is a remainder, not a
  // modulus.
  const raw = (offset + day * stride) % poolSize;
  return ((raw % poolSize) + poolSize) % poolSize;
}

/**
 * The pool entry for one date. Sorts, filters and de-duplicates the pool
 * first, so callers can hand over whatever Firestore gave them.
 */
export function selectVerseForDate(
  dateKey: string,
  config: VotdConfig,
  entries: VersePoolEntry[]
): VersePoolEntry | null {
  if (!config.enabled) return null;
  const pool = prepareVersePool(entries);
  const index = selectPoolIndex(dateKey, config, pool.length);
  return index === null ? null : (pool[index] ?? null);
}
