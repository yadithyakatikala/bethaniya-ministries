import { usePreferences } from '../context/PreferencesContext';
import { darkTokens, lightTokens, radii, spacing, typography } from './tokens';

/**
 * Single entry point for the shared theme, wired to the existing
 * usePreferences().isDark (the same source every screen used before this
 * change -- see PreferencesContext.tsx). Screens that used to write
 * `const colors = isDark ? darkColors : lightColors` with their own local
 * palette now write `const { colors } = useTheme()`.
 */
export function useTheme() {
  const { isDark } = usePreferences();
  return {
    colors: isDark ? darkTokens : lightTokens,
    spacing,
    radii,
    typography,
    isDark,
  };
}
