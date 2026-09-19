/**
 * Firestore data layer for the automated Verse of the Day -- the
 * configuration document `settings/dailyVerse` and the reference pool
 * `verse_pool`.
 *
 * ---------------------------------------------------------------------
 * WHAT THIS IS NOT
 * ---------------------------------------------------------------------
 * It is not a replacement for `daily_verses`. That collection still holds
 * an administrator's explicit verse for a named date, it still wins over
 * the automation, and ./dailyVerses.ts is unchanged. The automation is
 * what fills in every date nobody chose by hand.
 *
 * NO VERSE TEXT IS STORED. A pool entry is a reference; the words come
 * from the Bible bundled in the mobile app. The rules refuse a `text`
 * field on a pool document for exactly that reason.
 *
 * ---------------------------------------------------------------------
 * WHY settings/dailyVerse IS WRITABLE BY A CONTENT ADMIN
 * ---------------------------------------------------------------------
 * `settings/{settingId}` is super-admin-only and stays that way;
 * firestore.rules adds a SECOND, narrower match for this one document, so
 * a content admin can configure the verse rotation without also gaining
 * the church's public identity, support email and logo. See that file.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './app';
import { logAdminAction } from './auditLog';
import {
  DEFAULT_VOTD_CONFIG,
  type VersePoolEntry,
  type VotdConfig,
} from '../../features/daily-verses/votdSelection';

const SETTINGS_COLLECTION = 'settings';
const VOTD_SETTINGS_DOC_ID = 'dailyVerse';
const VERSE_POOL_COLLECTION = 'verse_pool';

/**
 * The one timezone the app can honour. Stored so an administrator can SEE
 * which calendar the verse rolls over on, and pinned by the rules because
 * the selection uses a fixed +05:30 offset -- see
 * ../../features/daily-verses/votdDate.ts.
 */
export const VOTD_TIMEZONE = 'Asia/Kolkata';

export interface VotdConfigDocument extends VotdConfig {
  timezone: string;
  updatedAt: Date | null;
}

export const DEFAULT_VOTD_CONFIG_DOCUMENT: VotdConfigDocument = {
  ...DEFAULT_VOTD_CONFIG,
  timezone: VOTD_TIMEZONE,
  updatedAt: null,
};

/** Each field defaults independently, so a partly-written document still loads. */
export function toVotdConfigDocument(data: Record<string, unknown>): VotdConfigDocument {
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
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * The configuration, live.
 *
 * A MISSING DOCUMENT IS NOT AN ERROR: it means no administrator has ever
 * configured the rotation, and the app is running on the defaults
 * (automation ON). The page shows those defaults rather than an empty
 * form, so what it displays is what members are actually getting.
 */
export function subscribeToVotdConfig(
  onNext: (config: VotdConfigDocument) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, VOTD_SETTINGS_DOC_ID),
    (snapshot) =>
      onNext(
        snapshot.exists()
          ? toVotdConfigDocument(snapshot.data())
          : DEFAULT_VOTD_CONFIG_DOCUMENT
      ),
    onError
  );
}

export interface VotdConfigInput {
  enabled: boolean;
  seed: string;
  poolVersion: number;
}

/**
 * Writes the configuration.
 *
 * `setDoc` with merge, not `updateDoc`: the document legitimately may not
 * exist yet (see subscribeToVotdConfig above), and `updateDoc` fails on a
 * missing document. `timezone` is written every time so the stored value
 * can never drift from the one the app honours.
 */
export async function saveVotdConfig(input: VotdConfigInput): Promise<void> {
  await setDoc(
    doc(db, SETTINGS_COLLECTION, VOTD_SETTINGS_DOC_ID),
    {
      enabled: input.enabled,
      seed: input.seed.trim(),
      poolVersion: input.poolVersion,
      timezone: VOTD_TIMEZONE,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logAdminAction({
    action: 'update',
    collection: 'settings',
    documentId: VOTD_SETTINGS_DOC_ID,
    changeSummary:
      `Verse of the Day automation ${input.enabled ? 'enabled' : 'disabled'}` +
      `, seed "${input.seed.trim()}", pool version ${input.poolVersion}`,
  });
}

/**
 * Bumps `poolVersion`, which is how an administrator deliberately
 * restarts the sequence after editing the pool.
 *
 * It is also what invalidates every device's cached copy of the pool on
 * its next app open, at the cost of one document read -- see
 * mobile/src/features/daily-verses/votdPoolCache.ts. Reading the current
 * value first (rather than an increment operator) keeps the new value
 * visible in the audit-log summary.
 */
export async function bumpVotdPoolVersion(current: number): Promise<number> {
  const next = current + 1;
  await setDoc(
    doc(db, SETTINGS_COLLECTION, VOTD_SETTINGS_DOC_ID),
    { poolVersion: next, timezone: VOTD_TIMEZONE, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await logAdminAction({
    action: 'update',
    collection: 'settings',
    documentId: VOTD_SETTINGS_DOC_ID,
    changeSummary: `Verse of the Day pool version bumped to ${next}`,
  });
  return next;
}

export interface VersePoolEntryDocument extends VersePoolEntry {
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function toVersePoolEntryDocument(
  id: string,
  data: Record<string, unknown>
): VersePoolEntryDocument {
  return {
    id,
    reference: typeof data.reference === 'string' ? data.reference : '',
    bookId: typeof data.bookId === 'string' ? data.bookId : '',
    chapter: typeof data.chapter === 'number' ? data.chapter : 0,
    verse: typeof data.verse === 'number' ? data.verse : 0,
    order: typeof data.order === 'number' ? data.order : 0,
    active: data.active !== false,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
  };
}

/**
 * The whole pool, including DEACTIVATED entries -- the admin page has to
 * show what it has switched off. The rules allow that read for a content
 * admin and above only; a member sees active entries alone.
 *
 * Unordered here on purpose: ../../features/daily-verses/votdSelection.ts's
 * prepareVersePool() is the one place the order is decided, and the page
 * shows the pool in exactly the order the selection will use it.
 */
export function subscribeToVersePool(
  onNext: (entries: VersePoolEntryDocument[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, VERSE_POOL_COLLECTION),
    (snapshot) =>
      onNext(
        snapshot.docs.map((entry) => toVersePoolEntryDocument(entry.id, entry.data()))
      ),
    onError
  );
}

export interface VersePoolEntryInput {
  reference: string;
  bookId: string;
  chapter: number;
  verse: number;
  order: number;
  active: boolean;
}

/**
 * Adds a pool entry at a DETERMINISTIC document id, `bookId-chapter-verse`.
 *
 * Deliberately not `addDoc`: the id then says what the entry is, and
 * adding the same verse twice overwrites rather than creating a duplicate
 * -- which matters because a duplicated verse would be twice as likely to
 * come up and would break the "every verse once per cycle" property the
 * rotation depends on. prepareVersePool() de-duplicates defensively as
 * well; this stops the duplicate existing in the first place.
 */
export function versePoolEntryId(bookId: string, chapter: number, verse: number): string {
  return `${bookId}-${chapter}-${verse}`;
}

export async function saveVersePoolEntry(input: VersePoolEntryInput): Promise<string> {
  const id = versePoolEntryId(input.bookId, input.chapter, input.verse);
  await setDoc(
    doc(db, VERSE_POOL_COLLECTION, id),
    {
      reference: input.reference.trim(),
      bookId: input.bookId,
      chapter: input.chapter,
      verse: input.verse,
      order: input.order,
      active: input.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logAdminAction({
    action: 'create',
    collection: 'verse_pool',
    documentId: id,
    changeSummary: `Added "${input.reference.trim()}" to the verse pool`,
  });
  return id;
}

export async function setVersePoolEntryActive(
  id: string,
  reference: string,
  active: boolean
): Promise<void> {
  await updateDoc(doc(db, VERSE_POOL_COLLECTION, id), {
    active,
    updatedAt: serverTimestamp(),
  });
  await logAdminAction({
    action: 'update',
    collection: 'verse_pool',
    documentId: id,
    changeSummary: `${active ? 'Activated' : 'Deactivated'} "${reference}" in the verse pool`,
  });
}

/** `reference` is passed in because it is gone once the document is. */
export async function deleteVersePoolEntry(id: string, reference: string): Promise<void> {
  await deleteDoc(doc(db, VERSE_POOL_COLLECTION, id));
  await logAdminAction({
    action: 'delete',
    collection: 'verse_pool',
    documentId: id,
    changeSummary: `Removed "${reference}" from the verse pool`,
  });
}

/**
 * Whether an explicit override exists for a date -- what the preview
 * needs in order to say "this date is overridden" rather than showing the
 * automated verse the member will never see.
 *
 * A single document read per previewed date, by document id where the
 * daily-verse document happens to use the date as its id, and otherwise
 * null. The list page already holds every override, so the PAGE resolves
 * the override from that list; this exists for the cases that do not.
 */
export async function fetchOverrideReference(dateKey: string): Promise<string | null> {
  const snapshot = await getDoc(doc(db, 'daily_verses', dateKey));
  if (!snapshot.exists()) return null;
  const reference = snapshot.data().reference;
  return typeof reference === 'string' ? reference : null;
}
