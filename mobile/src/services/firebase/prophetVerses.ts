/**
 * The Prophet Verse -- a SEPARATE content system from the Verse of the
 * Day, with its own collection, its own permissions and its own admin
 * page. Nothing here reads or writes `daily_verses`.
 *
 * ---------------------------------------------------------------------
 * WHAT COUNTS AS "THE CURRENT ONE"
 * ---------------------------------------------------------------------
 * A record qualifies when BOTH are true:
 *
 *     published == true        an administrator has published it
 *     publishAt <= now         its scheduled moment has arrived
 *
 * Among the records that qualify, THE MOST RECENTLY SCHEDULED ONE WINS
 * -- the largest `publishAt`. If two share the same `publishAt` to the
 * millisecond, the tie is broken by DOCUMENT ID DESCENDING, which is
 * Firestore's own implicit `__name__` ordering (it follows the direction
 * of the last explicit orderBy). Stating it that way means the app needs
 * no local tie-breaking pass and still has a rule that is written down
 * and testable.
 *
 * `publishAt` IS A FIRESTORE TIMESTAMP, not a "YYYY-MM-DD" string. It
 * names an instant, so it is compared with <=; `daily_verses.date` names
 * a calendar day, so it is matched exactly. The two fields answer
 * different questions and deliberately have different types.
 *
 * ---------------------------------------------------------------------
 * READ COST
 * ---------------------------------------------------------------------
 * One document read per app open: `limit(1)` on an indexed query, not a
 * listener, and never the whole collection. The history stays on the
 * server -- a phone has no reason to download every prophet verse the
 * church has ever published. Needs the composite index declared for
 * `prophet_verses` in /firestore.indexes.json (published ASC, publishAt
 * DESC).
 *
 * ---------------------------------------------------------------------
 * THE SCHEDULE IS ENFORCED ON THE SERVER, AND THAT NEEDS CARE
 * ---------------------------------------------------------------------
 * firestore.rules gates the read on `resource.data.publishAt <=
 * request.time` -- the SERVER's clock -- so a member cannot see
 * tomorrow's scheduled verse by winding their phone forward. The query
 * below has to supply its own bound, and the only clock it has is the
 * device's.
 *
 * If the device's clock runs FAST, the query can ask for a record the
 * rules will not yet allow, and Firestore then rejects the whole query
 * rather than returning fewer rows. That is why a denial is retried once
 * with a bound five minutes earlier: the normal case stays instant, and
 * a device with a fast clock shows a newly due verse up to five minutes
 * late instead of showing nothing at all. A slow clock needs no
 * handling; it simply asks for less than it is allowed.
 */
import {
  type FirestoreError,
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from './app';

export const PROPHET_VERSES_COLLECTION = 'prophet_verses';

/**
 * How far back the retry bound is moved when the device's clock is ahead
 * of the server's. Five minutes is generous for NTP-less phone drift and
 * is the worst-case lateness it can cause.
 */
export const CLOCK_SKEW_ALLOWANCE_MS = 5 * 60 * 1000;

export interface ProphetVerse {
  id: string;
  title: string;
  reference: string;
  text: string;
  attribution: string | null;
  /** Always an external https url, or null. Never a Storage path. */
  imageUrl: string | null;
  publishAt: Date | null;
}

export function toProphetVerse(
  id: string,
  data: Record<string, unknown>
): ProphetVerse | null {
  const { title, reference, text } = data;
  // A record missing its own words is not something to render half of.
  if (typeof title !== 'string' || title.trim().length === 0) return null;
  if (typeof text !== 'string' || text.trim().length === 0) return null;

  const publishAt = data.publishAt;
  return {
    id,
    title: title.trim(),
    reference: typeof reference === 'string' ? reference.trim() : '',
    text: text.trim(),
    attribution:
      typeof data.attribution === 'string' && data.attribution.trim().length > 0
        ? data.attribution.trim()
        : null,
    // An http:// url would render as a broken image on Android, which
    // blocks cleartext by default; the rules refuse to store one, and this
    // refuses to trust one that predates them.
    imageUrl:
      typeof data.imageUrl === 'string' && data.imageUrl.startsWith('https://')
        ? data.imageUrl
        : null,
    publishAt:
      publishAt instanceof Timestamp
        ? publishAt.toDate()
        : publishAt instanceof Date
          ? publishAt
          : null,
  };
}

function currentQuery(notAfter: Date) {
  return query(
    collection(db, PROPHET_VERSES_COLLECTION),
    where('published', '==', true),
    where('publishAt', '<=', Timestamp.fromDate(notAfter)),
    // Most recently scheduled first; ties fall to document id descending
    // via Firestore's implicit __name__ ordering. See this file's header.
    orderBy('publishAt', 'desc'),
    limit(1)
  );
}

async function firstOf(notAfter: Date): Promise<ProphetVerse | null> {
  const snapshot = await getDocs(currentQuery(notAfter));
  const [first] = snapshot.docs;
  return first ? toProphetVerse(first.id, first.data()) : null;
}

/**
 * The prophet verse to show right now, or null when the church has not
 * published one yet.
 *
 * `now` is injectable so the schedule can be tested without faking
 * global time -- fake timers interact badly with the React Native test
 * renderer in this project (see HomeScreen.test.tsx's note). Production
 * callers pass nothing.
 */
export async function fetchCurrentProphetVerse(
  now: Date = new Date()
): Promise<ProphetVerse | null> {
  try {
    return await firstOf(now);
  } catch (error) {
    const code = (error as FirestoreError | undefined)?.code;
    // M6 BUG 4, the part that is a deployment mistake rather than a code
    // one. Without the composite index this file's header names, the query
    // fails with 'failed-precondition' -- and the caller turns any failure
    // into the section simply not rendering, which is indistinguishable
    // from "the church has published nothing". Someone then goes looking
    // in the admin dashboard for a verse that is saved and correct. Say
    // which it is, once, where a developer will see it.
    if (code === 'failed-precondition') {
      console.warn(
        `[prophetVerses] the query was rejected, which usually means the ` +
          `composite index for '${PROPHET_VERSES_COLLECTION}' ` +
          `(published ASC, publishAt DESC) has not been deployed. See ` +
          `/firestore.indexes.json.`,
        error
      );
    }
    // Only a denial is worth retrying with an earlier bound; anything
    // else (offline, deadline exceeded, a missing index) would fail the
    // same way twice.
    if (code !== 'permission-denied') throw error;
    return firstOf(new Date(now.getTime() - CLOCK_SKEW_ALLOWANCE_MS));
  }
}
