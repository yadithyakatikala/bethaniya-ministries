import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { getStoredReadingPrefs, setStoredReadingPrefs } from './readingPrefsStorage';
import {
  DEFAULT_READING_PREFS,
  saveReadingPrefs,
  subscribeToReadingPrefs,
  type ReadingPrefs,
} from '../services/firebase/readingPrefs';

/**
 * The Bible reader's display settings, shared across the reader's
 * components.
 *
 * WHY A SEPARATE CONTEXT FROM PreferencesContext. These five values are
 * READER settings: nothing outside the reader reads them, they change
 * far more often than a language or a theme (a size step per tap), and
 * they live in their own Firestore document. Folding them into
 * PreferencesContext would re-render every screen in the app each time
 * someone nudged the font size.
 *
 * The theme is deliberately NOT here. The reader's Light / Dark / System
 * control drives `usePreferences().setThemePreference`, so there is one
 * theme preference in the app rather than two that can disagree -- see
 * ../services/firebase/userProfile.ts's ThemePreference.
 *
 * PERSISTENCE, the same two tiers PreferencesContext.tsx uses:
 *   - AsyncStorage always holds the latest value locally, so the reader
 *     opens with the right settings while signed out and offline.
 *   - When signed in, `users/{uid}/readingPrefs/reader` is subscribed to
 *     and becomes authoritative once a snapshot arrives, so settings
 *     chosen on one device follow the member to another.
 *
 * A set() applies locally and writes AsyncStorage immediately, then
 * writes Firestore best-effort: the reader must respond to a tap at
 * once, and a failed sync must not undo what the member just chose.
 */
interface ReadingPreferencesContextValue extends ReadingPrefs {
  /** True once the initial local (and, if signed in, remote) read settled. */
  isLoaded: boolean;
  setReadingPrefs: (fields: Partial<ReadingPrefs>) => Promise<void>;
}

const ReadingPreferencesContext = createContext<
  ReadingPreferencesContextValue | undefined
>(undefined);

export function ReadingPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  const [prefs, setPrefsState] = useState<ReadingPrefs>(DEFAULT_READING_PREFS);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  // Mirrors `prefs` so a setter can merge onto the CURRENT value without
  // waiting for a re-render. A useState updater callback runs during the
  // render pass, not inside the event handler, so reading the merged
  // result back out of one would read the stale value.
  const prefsRef = useRef<ReadingPrefs>(DEFAULT_READING_PREFS);
  const setPrefs = useCallback((next: ReadingPrefs) => {
    prefsRef.current = next;
    setPrefsState(next);
  }, []);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // Whichever of the two reads below settles LAST must not clobber the
  // other. Firestore wins once it has supplied a document, and an
  // explicit choice the member makes while a read is still in flight
  // wins over both -- the same guard PreferencesContext.tsx uses, and
  // for the same reason: nothing guarantees the ordering.
  const authoritativeRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredReadingPrefs();
      if (!mountedRef.current) return;
      if (!authoritativeRef.current) setPrefs(stored);
      setLocalLoaded(true);
    })();
  }, [setPrefs]);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubscribe = subscribeToReadingPrefs(
      uid,
      (remote) => {
        if (remote) {
          authoritativeRef.current = true;
          setPrefs(remote);
          void setStoredReadingPrefs(remote);
        }
        setRemoteLoaded(true);
      },
      () => setRemoteLoaded(true)
    );
    return () => {
      unsubscribe();
      setRemoteLoaded(false);
    };
  }, [uid, setPrefs]);

  const setReadingPrefs = useCallback(
    async (fields: Partial<ReadingPrefs>) => {
      authoritativeRef.current = true;
      // Merged onto the ref, so two quick taps (size up, size up) do not
      // both start from the same pre-render value.
      const merged = { ...prefsRef.current, ...fields };
      setPrefs(merged);
      await setStoredReadingPrefs(merged);
      // Firestore is best-effort and LAST. A failed cross-device sync
      // must not undo the change the member can already see on screen,
      // and it is not worth an error banner over a font size: the local
      // value stands and the next change retries the write.
      if (uid) {
        try {
          await saveReadingPrefs(uid, fields);
        } catch (error) {
          console.warn('[readingPrefs] sync failed; local value kept:', error);
        }
      }
    },
    [uid, setPrefs]
  );

  const value = useMemo<ReadingPreferencesContextValue>(
    () => ({
      ...prefs,
      isLoaded: localLoaded && (uid ? remoteLoaded : true),
      setReadingPrefs,
    }),
    [prefs, localLoaded, remoteLoaded, uid, setReadingPrefs]
  );

  return (
    <ReadingPreferencesContext.Provider value={value}>
      {children}
    </ReadingPreferencesContext.Provider>
  );
}

export function useReadingPreferences(): ReadingPreferencesContextValue {
  const ctx = useContext(ReadingPreferencesContext);
  if (!ctx) {
    throw new Error(
      'useReadingPreferences must be used within a ReadingPreferencesProvider'
    );
  }
  return ctx;
}
