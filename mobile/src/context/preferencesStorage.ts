/**
 * Local-only AsyncStorage helpers for theme and notification preferences
 * -- the theme/notifications equivalent of
 * ../features/bible/languagePreference.ts's language helpers (same
 * shape: one AsyncStorage key per preference, a validating getter that
 * falls back to a default, a plain setter). Kept as a separate module
 * rather than added to languagePreference.ts, since that file is scoped
 * to the Bible feature (its own doc comment: "Day 8 scope") and
 * pre-dates Settings/theme entirely -- PreferencesContext.tsx imports
 * *both* this module (theme/notifications) and languagePreference.ts
 * (language) rather than this file re-implementing language storage too.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '../services/firebase/userProfile';

const THEME_KEY = 'theme_preference';
const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled_preference';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

/** Returns the saved theme, or null if nothing valid is stored (the
 * caller -- PreferencesContext -- falls back to the system color scheme
 * in that case, not a hardcoded default, since there's no single
 * "correct" default theme the way English is the default Bible
 * language). */
export async function getStoredThemePreference(): Promise<ThemePreference | null> {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  return isThemePreference(raw) ? raw : null;
}

export async function setStoredThemePreference(theme: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

/** Returns the saved value, or null if nothing valid is stored yet
 * (caller defaults to true -- notifications on by default). */
export async function getStoredNotificationsEnabled(): Promise<boolean | null> {
  const raw = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export async function setStoredNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
}
