import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePreferences } from '../../../context/PreferencesContext';
import { primaryBibleLanguage } from '../../../context/languagePreferences';
import {
  subscribeToReadingPosition,
  type ReadingPosition,
} from '../../../services/firebase/readingPosition';

/**
 * Where the member last stopped reading, in the Bible they read now -- or null
 * (nobody signed in, nothing read yet, or the read failed).
 *
 * The saved document is written by ./useReadingPosition.ts and read here, by the
 * "Continue reading" row and by the Bible home, which opens on the testament the
 * member was last in and sets that book in bold. One listener per caller, on one
 * small document.
 */
export function useSavedReadingPosition(): ReadingPosition | null {
  const { status, user } = useAuth();
  const { bibleMode } = usePreferences();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;
  const translationId = primaryBibleLanguage(bibleMode);
  const [saved, setSaved] = useState<ReadingPosition | null>(null);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToReadingPosition(uid, translationId, setSaved, () => setSaved(null));
  }, [uid, translationId]);

  // DERIVED rather than cleared in an effect, so signing out hides it on the
  // very next render instead of one frame later.
  return uid ? saved : null;
}
