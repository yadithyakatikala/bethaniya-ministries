import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  getLanguagePreference,
  setLanguagePreference as persistLanguagePreference,
} from '../features/bible/languagePreference';
import type { BibleLanguage } from '../features/bible/types';
import {
  subscribeToOwnProfile,
  updateOwnProfile,
  type ThemePreference,
} from '../services/firebase/userProfile';
import {
  getStoredNotificationsEnabled,
  getStoredThemePreference,
  setStoredNotificationsEnabled,
  setStoredThemePreference,
} from './preferencesStorage';
import { useAuth } from './AuthContext';

/**
 * App-wide user preferences (language / theme / notifications) -- Day 9.
 *
 * Replaces the Day 8 pattern of every screen calling `useColorScheme()`
 * directly (see DailyVerseCard.tsx, BooksListScreen.tsx,
 * ChaptersListScreen.tsx, ChapterScreen.tsx's Day 8 doc comments) with one
 * shared source of truth, so an explicit theme choice in Settings actually
 * affects every screen, not just the screen that set it.
 *
 * Two-tier persistence, per FINAL_ARCHITECTURE_SPECIFICATION.md's Day 9
 * plan ("sync to Firestore ... AsyncStorage as offline fallback"):
 *   - AsyncStorage always holds the latest value locally (via
 *     ../features/bible/languagePreference.ts for language, and
 *     ./preferencesStorage.ts for theme/notifications) -- works signed out
 *     and offline.
 *   - When signed in, the same /users/{uid} document Profile edits also
 *     writes (see ../services/firebase/userProfile.ts) is subscribed to
 *     and treated as the source of truth once loaded, so a preference set
 *     on one device is picked up on another. A set*() call updates local
 *     state + AsyncStorage immediately (works offline / before the
 *     Firestore write resolves) and additionally, when signed in, calls
 *     updateOwnProfile() -- if that call fails (offline, emulator down),
 *     the local value still stands; the caller (Settings screen) decides
 *     how to surface that failure.
 *
 * Theme has no stored default of its own the way language defaults to
 * 'en' -- until the user (or their synced profile) has ever set one, the
 * *system* color scheme is used, exactly matching Day 8's per-screen
 * `useColorScheme() === 'dark'` behavior. `isDark` is exposed directly so
 * every migrated screen's diff is a one-line swap:
 * `useColorScheme() === 'dark'` -> `usePreferences().isDark`.
 */
interface PreferencesContextValue {
  languagePreference: BibleLanguage;
  themePreference: ThemePreference;
  isDark: boolean;
  notificationsEnabled: boolean;
  /** True once the initial AsyncStorage (and, if signed in, first
   * Firestore snapshot) read has completed. Screens that only care about
   * "what theme/language to render right now" don't need this -- the
   * values above are always usable immediately (seeded from the system
   * scheme / sensible defaults) -- but Settings shows a brief loading
   * state with it rather than flashing default toggle positions. */
  isLoaded: boolean;
  setLanguagePreference: (language: BibleLanguage) => Promise<void>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  // 'te' matches languagePreference.ts's DEFAULT_LANGUAGE -- avoids a
  // one-frame flash of English before the AsyncStorage read resolves.
  const [languagePreference, setLanguagePreferenceState] = useState<BibleLanguage>('te');
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    systemScheme === 'dark' ? 'dark' : 'light'
  );
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [firestoreLoaded, setFirestoreLoaded] = useState(false);

  // Guards against a slower earlier AsyncStorage read overwriting a
  // faster-resolving later one if this ever re-mounts quickly (e.g. Fast
  // Refresh) -- the same "ignore a stale in-flight result" shape used by
  // ../features/bible/ChapterScreen.tsx's loaders, adapted for an effect
  // with no dependency-driven re-run.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // Firestore is authoritative once it has supplied a value for a given
  // field, *regardless of which effect below finishes first*: a real
  // Firestore snapshot is typically slower than a local AsyncStorage read,
  // but nothing guarantees that ordering (an emulator/cache-first snapshot
  // can resolve fast; AsyncStorage's own read is still asynchronous). This
  // ref is checked by the local-load effect below before it applies a
  // value, so whichever finishes second never clobbers a field Firestore
  // already set -- each field is tracked independently, since a brand-new
  // profile document legitimately has some/none of these fields yet, and
  // local storage should still be free to seed exactly those.
  const firestoreFieldSetRef = useRef({
    language: false,
    theme: false,
    notifications: false,
  });

  // Local (AsyncStorage) load -- runs once, independent of auth state, so
  // preferences are available immediately for a signed-out/offline user.
  useEffect(() => {
    void (async () => {
      const [language, theme, notifications] = await Promise.all([
        getLanguagePreference(),
        getStoredThemePreference(),
        getStoredNotificationsEnabled(),
      ]);
      if (!mountedRef.current) return;
      if (!firestoreFieldSetRef.current.language) setLanguagePreferenceState(language);
      if (theme && !firestoreFieldSetRef.current.theme) setThemePreferenceState(theme);
      if (notifications !== null && !firestoreFieldSetRef.current.notifications) {
        setNotificationsEnabledState(notifications);
      }
      setLocalLoaded(true);
    })();
  }, []);

  // Firestore sync -- only while signed in. Firestore is treated as the
  // most-authoritative source once a snapshot arrives: it both updates
  // local state and writes through to AsyncStorage, so the very next
  // offline/signed-out app open still has the last-synced value.
  useEffect(() => {
    // Nothing to subscribe to while signed out -- `isLoaded` below already
    // treats firestoreLoaded as irrelevant when there's no uid, so there's
    // no state to reset here; the cleanup below resets it for the *next*
    // sign-in instead (see its comment).
    if (!uid) return undefined;
    const unsubscribe = subscribeToOwnProfile(
      uid,
      (profile) => {
        if (!profile) {
          setFirestoreLoaded(true);
          return;
        }
        if (profile.languagePreference) {
          firestoreFieldSetRef.current.language = true;
          setLanguagePreferenceState(profile.languagePreference);
          void persistLanguagePreference(profile.languagePreference);
        }
        if (profile.themePreference) {
          firestoreFieldSetRef.current.theme = true;
          setThemePreferenceState(profile.themePreference);
          void setStoredThemePreference(profile.themePreference);
        }
        if (profile.notificationsEnabled !== null) {
          firestoreFieldSetRef.current.notifications = true;
          setNotificationsEnabledState(profile.notificationsEnabled);
          void setStoredNotificationsEnabled(profile.notificationsEnabled);
        }
        setFirestoreLoaded(true);
      },
      () => setFirestoreLoaded(true)
    );
    return () => {
      unsubscribe();
      // Reset before the next run of this effect (a different uid signing
      // in, or signing out) so a stale `true` from this uid's session
      // never makes isLoaded look true for a new uid's not-yet-arrived
      // snapshot.
      setFirestoreLoaded(false);
    };
  }, [uid]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      languagePreference,
      themePreference,
      isDark: themePreference === 'dark',
      notificationsEnabled,
      isLoaded: localLoaded && (uid ? firestoreLoaded : true),
      setLanguagePreference: async (language: BibleLanguage) => {
        // Marking the ref here too (not just in the Firestore-snapshot
        // handler above) means an explicit choice the user makes while
        // the one-time local-load effect is still in flight can never be
        // clobbered when that effect's AsyncStorage read finally resolves
        // -- see firestoreFieldSetRef's doc comment.
        firestoreFieldSetRef.current.language = true;
        setLanguagePreferenceState(language);
        await persistLanguagePreference(language);
        if (uid) await updateOwnProfile(uid, { languagePreference: language });
      },
      setThemePreference: async (theme: ThemePreference) => {
        firestoreFieldSetRef.current.theme = true;
        setThemePreferenceState(theme);
        await setStoredThemePreference(theme);
        if (uid) await updateOwnProfile(uid, { themePreference: theme });
      },
      setNotificationsEnabled: async (enabled: boolean) => {
        firestoreFieldSetRef.current.notifications = true;
        setNotificationsEnabledState(enabled);
        await setStoredNotificationsEnabled(enabled);
        if (uid) await updateOwnProfile(uid, { notificationsEnabled: enabled });
      },
    }),
    [
      languagePreference,
      themePreference,
      notificationsEnabled,
      localLoaded,
      firestoreLoaded,
      uid,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
}
