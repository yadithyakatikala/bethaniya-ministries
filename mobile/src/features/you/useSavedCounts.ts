import { useEffect, useState } from 'react';
import { subscribeToPrayers } from '../../services/firebase/prayers';
import { fetchSavedMediaIds } from '../../services/firebase/media';
import { subscribeToStartedPlanCount } from '../../services/firebase/plans';
import {
  subscribeToBookmarks,
  subscribeToHighlights,
  subscribeToVerseNotes,
} from '../../services/firebase/readerAnnotations';

export interface SavedCounts {
  notes: number | null;
  highlights: number | null;
  bookmarks: number | null;
  plans: number | null;
  media: number | null;
  journal: number | null;
}

const UNKNOWN: SavedCounts = {
  notes: null,
  highlights: null,
  bookmarks: null,
  plans: null,
  media: null,
  journal: null,
};

/**
 * The numbers on the Saved tab's rows: how many notes, highlights,
 * bookmarks, started plans, saved posts and journal entries the member has.
 *
 * Each is `null` until it is known, and stays `null` if it cannot be read --
 * the row then simply shows no number rather than a wrong one. All of it is
 * the member's own private data (owner-only rules), counted from small
 * collections: four listeners that send only changes, and one read of the
 * saved-media ids. A count that fails to load is silent: it is a convenience
 * on a row, not content.
 */
export function useSavedCounts(uid: string | null): SavedCounts {
  const [counts, setCounts] = useState<SavedCounts>(UNKNOWN);

  useEffect(() => {
    if (!uid) return undefined;
    const set = (key: keyof SavedCounts) => (value: number) =>
      setCounts((current) => ({ ...current, [key]: value }));
    let active = true;

    const unsubscribers = [
      subscribeToVerseNotes(
        uid,
        (notes) => set('notes')(notes.length),
        () => undefined
      ),
      subscribeToHighlights(
        uid,
        (highlights) => set('highlights')(highlights.length),
        () => undefined
      ),
      subscribeToBookmarks(
        uid,
        (bookmarks) => set('bookmarks')(bookmarks.length),
        () => undefined
      ),
      subscribeToStartedPlanCount(uid, set('plans'), () => undefined),
      subscribeToPrayers(
        uid,
        (prayers) => set('journal')(prayers.length),
        () => undefined
      ),
    ];
    fetchSavedMediaIds(uid)
      .then((ids) => {
        if (active) set('media')(ids.size);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      for (const unsubscribe of unsubscribers) unsubscribe?.();
    };
  }, [uid]);

  // Signed out (or before the member is known): nothing is counted.
  return uid ? counts : UNKNOWN;
}
