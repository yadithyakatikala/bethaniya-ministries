import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type { BibleLanguage, BibleMode } from '../features/bible/types';
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_BIBLE_MODE,
  migrateAndLoadLanguagePreferences,
  setStoredAppLanguage,
  setStoredBibleMode,
} from './languagePreferences';
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
import { requestNotificationPermissionsAsync } from '../services/notifications/notificationService';

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
  /**
   * The INTERFACE language. Drives every translated string via
   * ../i18n/useTranslation.ts. Defaults to 'en'.
   */
  appLanguage: BibleLanguage;
  /**
   * What the Bible reader shows -- one translation, or both paired
   * through the M1 alignment policy. Defaults to 'te'. Changing it never
   * touches `appLanguage`, and vice versa.
   */
  bibleMode: BibleMode;
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
  setAppLanguage: (language: BibleLanguage) => Promise<void>;
  setBibleMode: (mode: BibleMode) => Promise<void>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { status, user } = useAuth();
  const uid = status === 'authenticated' ? (user?.uid ?? null) : null;

  // Seeded from the product defaults so the first frame is already
  // correct -- English interface, Telugu Bible -- rather than flashing
  // one language before the AsyncStorage read resolves.
  const [appLanguage, setAppLanguageState] =
    useState<BibleLanguage>(DEFAULT_APP_LANGUAGE);
  const [bibleMode, setBibleModeState] = useState<BibleMode>(DEFAULT_BIBLE_MODE);
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
    appLanguage: false,
    bibleMode: false,
    theme: false,
    notifications: false,
  });

  // Local (AsyncStorage) load -- runs once, independent of auth state, so
  // preferences are available immediately for a signed-out/offline user.
  useEffect(() => {
    void (async () => {
      // Migrates a V1 install on the way through -- see
      // ./languagePreferences.ts for why that is idempotent.
      const [languages, theme, notifications] = await Promise.all([
        migrateAndLoadLanguagePreferences(),
        getStoredThemePreference(),
        getStoredNotificationsEnabled(),
      ]);
      if (!mountedRef.current) return;
      if (!firestoreFieldSetRef.current.appLanguage) {
        setAppLanguageState(languages.appLanguage);
      }
      if (!firestoreFieldSetRef.current.bibleMode) {
        setBibleModeState(languages.bibleMode);
      }
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
        // The V2 fields are authoritative when present. V1's single
        // `languagePreference` only SEEDS the Bible mode, and only for an
        // account that has never run V2 -- it must never be allowed to
        // set the interface language, or a Telugu-Bible member would get
        // a Telugu interface they never chose. See
        // ./languagePreferences.ts.
        if (profile.appLanguage) {
          firestoreFieldSetRef.current.appLanguage = true;
          setAppLanguageState(profile.appLanguage);
          void setStoredAppLanguage(profile.appLanguage);
        }
        if (profile.bibleMode) {
          firestoreFieldSetRef.current.bibleMode = true;
          setBibleModeState(profile.bibleMode);
          void setStoredBibleMode(profile.bibleMode);
        } else if (profile.languagePreference) {
          firestoreFieldSetRef.current.bibleMode = true;
          setBibleModeState(profile.languagePreference);
          void setStoredBibleMode(profile.languagePreference);
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
      appLanguage,
      bibleMode,
      themePreference,
      isDark: themePreference === 'dark',
      notificationsEnabled,
      isLoaded: localLoaded && (uid ? firestoreLoaded : true),
      // Marking the refs here too (not just in the Firestore-snapshot
      // handler above) means an explicit choice the user makes while the
      // one-time local-load effect is still in flight can never be
      // clobbered when that effect's read finally resolves -- see
      // firestoreFieldSetRef's doc comment.
      setAppLanguage: async (language: BibleLanguage) => {
        firestoreFieldSetRef.current.appLanguage = true;
        setAppLanguageState(language);
        await setStoredAppLanguage(language);
        // Writes ONLY appLanguage. The Bible mode is a separate field and
        // a separate decision; this must not touch it.
        if (uid) await updateOwnProfile(uid, { appLanguage: language });
      },
      setBibleMode: async (mode: BibleMode) => {
        firestoreFieldSetRef.current.bibleMode = true;
        setBibleModeState(mode);
        await setStoredBibleMode(mode);
        if (uid) {
          // Mirrors V1's field alongside the V2 one when the mode is a
          // single language, so an older client still reads something it
          // understands. 'bilingual' is left out of the mirror rather
          // than written as a value V1 would misread.
          await updateOwnProfile(
            uid,
            mode === 'bilingual'
              ? { bibleMode: mode }
              : { bibleMode: mode, languagePreference: mode }
          );
        }
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
        // Actually asks the OS for permission when the user turns this on
        // -- added during the V1 production-readiness audit, after this
        // toggle was found to only ever flip a stored boolean, never call
        // requestNotificationPermissionsAsync() (services/firebase/
        // notificationService.ts), so the OS permission prompt the user
        // needs to see in order to ever receive anything never fired.
        // Best-effort: a denial or unsupported platform isn't a failure
        // this toggle needs to react to (see that function's own doc
        // comment -- it never throws).
        if (enabled) void requestNotificationPermissionsAsync();
      },
    }),
    [
      appLanguage,
      bibleMode,
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
