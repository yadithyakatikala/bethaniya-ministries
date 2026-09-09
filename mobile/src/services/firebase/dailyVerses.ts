/**
 * Real-time listener for today's daily verse -- the mobile-side half of
 * Day 5's "Mobile: Real-time listener on daily_verses collection" plan
 * item.
 *
 * Unlike announcements, daily_verses has no `published` field to filter
 * on (see admin/src/types/index.ts's DailyVerse doc comment and
 * firestore.rules' existing daily_verses rule -- every signed-in role can
 * read every daily verse document). What the Home Screen needs is
 * specifically *today's* verse, so the query filters by
 * `date == todayDateString()` instead -- same "filter server-side, not
 * just in the UI" shape ../announcements.ts uses, applied to the field
 * that actually matters for this collection. `date` is a plain
 * "YYYY-MM-DD" string (see admin/src/types/index.ts), so this is a plain
 * equality query on a single field -- Firestore auto-indexes every
 * field's equality AND ascending/descending order by default, so this
 * needs no entry in firestore.indexes.json at all. A `daily_verses`
 * composite-index entry existed there from Day 1 through a production
 * deploy attempt, which is exactly what surfaced the mistake: Firestore
 * rejects a composite index declaration that names only one field
 * ("this index is not necessary, configure using single field index
 * controls"). It's been removed; every daily_verses query (this file
 * and admin/src/services/firebase/dailyVerses.ts) has always worked off
 * Firestore's automatic single-field indexes.
 */
import {
  type FirestoreError,
  type Unsubscribe,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from './app';

export interface TodaysDailyVerse {
  id: string;
  reference: string;
  text: string;
  imageUrl: string | null;
  date: string;
}

/** Local calendar date as "YYYY-MM-DD" -- matches the format admin writes (see admin/src/features/daily-verses/validation.ts). */
export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTodaysDailyVerse(id: string, data: Record<string, unknown>): TodaysDailyVerse {
  return {
    id,
    reference: typeof data.reference === 'string' ? data.reference : '',
    text: typeof data.text === 'string' ? data.text : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    date: typeof data.date === 'string' ? data.date : '',
  };
}

/**
 * `onNext` receives `null` when no daily verse is set for today (the
 * Home Screen's empty state -- see DailyVerseCard.tsx), or the verse
 * itself. Timestamps aren't part of TodaysDailyVerse -- the Home Screen
 * doesn't display created/updated times (unlike the admin dashboard's
 * DailyVerse type, which is unrelated to this mobile-side type).
 */
export function subscribeToTodaysDailyVerse(
  onNext: (verse: TodaysDailyVerse | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'daily_verses'), where('date', '==', todayDateString()));
  return onSnapshot(
    q,
    (snapshot) => {
      const [first] = snapshot.docs;
      onNext(first ? toTodaysDailyVerse(first.id, first.data()) : null);
    },
    onError
  );
}

/**
 * Every daily verse ever set, newest date first -- backs the standalone
 * Daily Verse screen's archive (see ../../features/daily-verses/
 * DailyVerseScreen.tsx). Same collection and permission as
 * subscribeToTodaysDailyVerse above (firestore.rules already allows any
 * signed-in role to read every daily_verses document -- see that
 * function's doc comment), just without the `date == today` filter;
 * ordered by `date` descending -- a single-field sort, covered by
 * Firestore's automatic index for that field, no entry in
 * firestore.indexes.json needed (see this file's top comment).
 */
export function subscribeToDailyVerseArchive(
  onNext: (verses: TodaysDailyVerse[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'daily_verses'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onNext(snapshot.docs.map((d) => toTodaysDailyVerse(d.id, d.data()))),
    onError
  );
}
