/**
 * The two Firestore documents the automated Verse of the Day reads:
 * `settings/dailyVerse` (the configuration) and `verse_pool` (the
 * references). Both are ONE-TIME FETCHES, not listeners -- see "Read
 * cost" below.
 *
 * NEITHER HOLDS SCRIPTURE. The pool stores references
 * (`bookId`/`chapter`/`verse`); the text comes from the bundled corpus
 * through ../../features/bible/dataSource.ts. Duplicating 31,102 verses
 * into Firestore would cost money to store and to read, and would give
 * the app a second, divergent Bible.
 *
 * ---------------------------------------------------------------------
 * READ COST (Spark plan -- 50,000 document reads a day, shared by the
 * whole app)
 * ---------------------------------------------------------------------
 * A listener on the pool would re-read every entry on every edit for
 * every open app. Instead:
 *
 *   * the configuration is ONE document read per app open;
 *   * the pool is fetched at most ONCE PER DEVICE PER DAY, and only when
 *     the cached copy is for a different `poolVersion` or a different
 *     canonical date -- see ../../features/daily-verses/votdPoolCache.ts.
 *
 * So a member who opens the app six times in a day costs six reads plus
 * one pool fetch, and an administrator who bumps `poolVersion`
 * invalidates every device's cache on that device's next single-document
 * read. That is why `poolVersion` is worth its own field rather than
 * being inferred.
 *
 * Keep the pool modest. Sixty entries is two months of unrepeated
 * verses; three hundred is a year. The cost is linear in pool size, once
 * a day, per device.
 *
 * ---------------------------------------------------------------------
 * THE OVERRIDE PATH IS UNCHANGED
 * ---------------------------------------------------------------------
 * `daily_verses` -- an administrator's explicit verse for one date --
 * still comes from ./dailyVerses.ts's existing real-time listener, which
 * already handles rolling over at midnight. It stays a listener because
 * it is a single document and because a verse published for today should
 * appear on the congregation's phones without waiting for a restart.
 * M5 only changes WHICH date it asks for: the canonical Indian one.
 */
import {
  type FirestoreError,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './app';
import {
  DEFAULT_VOTD_CONFIG,
  type VersePoolEntry,
  type VotdConfig,
} from '../../features/daily-verses/votdSelection';

export const SETTINGS_COLLECTION = 'settings';
/** The configuration document id. `settings/church` is a different,
 * super-admin-only document and is untouched by any of this. */
export const VOTD_SETTINGS_DOC_ID = 'dailyVerse';
export const VERSE_POOL_COLLECTION = 'verse_pool';

/**
 * The canonical timezone, stored in the configuration document so an
 * administrator can SEE which calendar the verse rolls over on.
 *
 * It is deliberately not adjustable. The selection uses a fixed +05:30
 * offset (see ../../features/daily-verses/votdDate.ts) because Hermes
 * may ship without a timezone database, so honouring an arbitrary value
 * here would mean promising something the app cannot deliver. The rules
 * pin the field to this string for the same reason.
 */
export const VOTD_TIMEZONE = 'Asia/Kolkata';

/** The configuration as stored, including the documentation-only field. */
export interface VotdConfigDocument extends VotdConfig {
  timezone: string;
}

/**
 * Each field is validated and defaulted INDEPENDENTLY, so a document
 * half-written by an older admin build still yields a usable
 * configuration rather than dropping the whole thing.
 */
export function toVotdConfig(data: Record<string, unknown>): VotdConfigDocument {
  return {
    enabled:
      typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_VOTD_CONFIG.enabled,
    seed:
      typeof data.seed === 'string' && data.seed.length > 0
        ? data.seed
        : DEFAULT_VOTD_CONFIG.seed,
    poolVersion:
      typeof data.poolVersion === 'number' &&
      Number.isInteger(data.poolVersion) &&
      data.poolVersion >= 1
        ? data.poolVersion
        : DEFAULT_VOTD_CONFIG.poolVersion,
    timezone: typeof data.timezone === 'string' ? data.timezone : VOTD_TIMEZONE,
  };
}

/**
 * The configuration, or the defaults when no administrator has ever
 * saved one.
 *
 * A MISSING DOCUMENT MEANS AUTOMATION IS ON. That is the migration
 * story: an existing install picks up the automated verse without anyone
 * having to configure anything, while every explicit `daily_verses`
 * override an administrator has already written continues to win. See
 * ../../features/daily-verses/votdResolver.ts for the priority.
 */
export async function fetchVotdConfig(): Promise<VotdConfigDocument> {
  const snapshot = await getDoc(doc(db, SETTINGS_COLLECTION, VOTD_SETTINGS_DOC_ID));
  return snapshot.exists()
    ? toVotdConfig(snapshot.data())
    : { ...DEFAULT_VOTD_CONFIG, timezone: VOTD_TIMEZONE };
}

/**
 * One pool document, or null when it is not a usable reference.
 *
 * Returning null rather than a coerced entry matters: a document with a
 * missing `bookId` would otherwise become a silent hole in the rotation
 * that every device would have to agree about. Dropping it here means
 * every device drops it, and the sequence stays identical everywhere.
 */
export function toVersePoolEntry(
  id: string,
  data: Record<string, unknown>
): VersePoolEntry | null {
  const { bookId, chapter, verse } = data;
  if (typeof bookId !== 'string' || bookId.length === 0) return null;
  if (typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1)
    return null;
  if (typeof verse !== 'number' || !Number.isInteger(verse) || verse < 1) return null;

  return {
    id,
    reference:
      typeof data.reference === 'string' && data.reference.length > 0
        ? data.reference
        : `${bookId} ${chapter}:${verse}`,
    bookId,
    chapter,
    verse,
    // A document written before `order` existed sorts last-but-stable:
    // prepareVersePool() breaks the tie by id, so the order is still
    // total and still identical on every device.
    order: typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0,
    active: data.active !== false,
  };
}

/**
 * Every ACTIVE pool entry.
 *
 * Filtered server-side on `active`, which Firestore covers with its
 * automatic single-field index -- no entry in firestore.indexes.json,
 * and no reads charged for the entries an administrator has switched
 * off. The ordering is applied locally by prepareVersePool(), not by
 * Firestore: pairing `where('active','==',true)` with `orderBy('order')`
 * would need a composite index for no benefit, since the selection has
 * to sort defensively anyway.
 */
export async function fetchVersePool(): Promise<VersePoolEntry[]> {
  const snapshot = await getDocs(
    query(collection(db, VERSE_POOL_COLLECTION), where('active', '==', true))
  );
  return snapshot.docs
    .map((entry) => toVersePoolEntry(entry.id, entry.data()))
    .filter((entry): entry is VersePoolEntry => entry !== null);
}

export interface VotdAutomation {
  config: VotdConfigDocument;
  pool: VersePoolEntry[];
}

/**
 * Whether a failed read is worth retrying, or whether the device should
 * settle for the bundled fallback.
 *
 * 'permission-denied' and 'unauthenticated' are not transient: a signed-
 * out member will never be allowed to read these, so retrying only
 * spends reads. Anything else (offline, deadline exceeded) may succeed
 * later.
 */
export function isTransientVotdError(error: unknown): boolean {
  const code = (error as FirestoreError | undefined)?.code;
  return code !== 'permission-denied' && code !== 'unauthenticated';
}
