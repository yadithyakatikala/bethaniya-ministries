import { usePreferences } from '../context/PreferencesContext';
import {
  darkTokens,
  highlightTints,
  lightTokens,
  radii,
  readingScale,
  spacing,
  typographyFor,
  MIN_TOUCH_TARGET,
  type TypeScale,
} from './tokens';

/**
 * Single entry point for the shared theme, wired to
 * usePreferences().isDark.
 *
 * `type` replaces M3's predecessor `typography`, which was a frozen
 * constant with font families baked in. It could not be: the serif roles
 * resolve to a different face for Telugu, and every line height gets
 * Telugu's extra leading (see tokens.ts's TELUGU_LINE_HEIGHT_BOOST). So
 * the scale is now derived from the active APP language -- the interface
 * language, not the Bible's, because these roles style chrome.
 *
 *   const { colors, type, spacing } = useTheme();
 *   <Text style={[type.title, { color: colors.ink }]}>…</Text>
 *
 * Scripture is the exception: a verse must be set in the language of the
 * VERSE, which the caller knows and this hook does not. Pass it
 * explicitly through `scriptureStyle()` from ./tokens, or use
 * `useScriptureType()` below for the reader's current settings.
 */
export function useTheme() {
  const { isDark, appLanguage } = usePreferences();
  return {
    colors: isDark ? darkTokens : lightTokens,
    spacing,
    radii,
    /** The semantic type scale for the active app language. */
    type: typographyFor(appLanguage),
    /** Reading-experience steps M4's controls bind to. */
    reading: readingScale,
    /** Verse-highlight backgrounds for the active palette. */
    highlights: isDark ? highlightTints.dark : highlightTints.light,
    minTouchTarget: MIN_TOUCH_TARGET,
    isDark,
  };
}

/**
 * The type scale for an explicit script, ignoring the app language.
 *
 * For the places that render text whose language is known and is NOT the
 * interface language -- a Telugu verse under an English interface, an
 * English verse under a Telugu one. Bilingual scripture renders its two
 * sides as separate Text nodes, so each side calls this with its own
 * language and gets the matching serif.
 */
export function useTypographyFor(language: 'en' | 'te'): TypeScale {
  return typographyFor(language);
}
