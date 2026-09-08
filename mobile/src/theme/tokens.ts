/**
 * Vespers design tokens -- from the approved UI audit/prototype
 * (Claude Design handoff, "Bethaniya Ministries -- UI audit & proposed
 * design system"). One shared module replaces the seven per-screen
 * lightColors/darkColors objects that used to duplicate the same
 * Tailwind-grey palette (see NotificationCenterScreen, SettingsScreen,
 * ChaptersListScreen, BooksListScreen, ChapterScreen, BibleSearchScreen,
 * DailyVerseCard, ProfileScreen -- all migrated to useTheme() from
 * ./useTheme in this same change).
 *
 * Dark mode is re-pitched, not inverted: a green-black ground, a lifted
 * sage primary, and a softened live red, per the audit's own dark
 * palette.
 *
 * `background`/`text`/`secondaryText` are kept as aliases of
 * `paper`/`ink`/`inkMuted` so every migrated screen's existing
 * `colors.background` / `colors.text` / `colors.secondaryText` /
 * `colors.border` JSX references keep working unchanged.
 */
export interface ThemeColors {
  paper: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  ink: string;
  inkMuted: string;
  primary: string;
  primaryPressed: string;
  primaryTint: string;
  accent: string;
  live: string;
  liveTint: string;
  danger: string;
  success: string;
  /** @deprecated alias of `paper` -- kept so pre-existing screens don't need a JSX rewrite */
  background: string;
  /** @deprecated alias of `ink` -- kept so pre-existing screens don't need a JSX rewrite */
  text: string;
  /** @deprecated alias of `inkMuted` -- kept so pre-existing screens don't need a JSX rewrite */
  secondaryText: string;
}

const lightBase = {
  paper: '#FAF7F1',
  surface: '#FFFFFF',
  surfaceRaised: '#FAF7F1',
  border: '#E3DCCE',
  ink: '#1F2A25',
  inkMuted: '#56635C',
  primary: '#2E5347',
  primaryPressed: '#24423A',
  primaryTint: '#E4EDE7',
  accent: '#A96C33',
  live: '#C0392B',
  liveTint: '#FBEAE7',
  danger: '#B3261E',
  success: '#2F7A4F',
};

const darkBase = {
  paper: '#141A17',
  surface: '#1E2622',
  surfaceRaised: '#27302B',
  border: '#35403A',
  ink: '#F2F5F2',
  inkMuted: '#A9B5AE',
  primary: '#8FC0AC',
  primaryPressed: '#7AAE97',
  primaryTint: '#27302B',
  accent: '#DDA76B',
  live: '#FF6B5A',
  liveTint: '#3B211D',
  danger: '#FF6B5A',
  success: '#8FC0AC',
};

export const lightTokens: ThemeColors = {
  ...lightBase,
  background: lightBase.paper,
  text: lightBase.ink,
  secondaryText: lightBase.inkMuted,
};

export const darkTokens: ThemeColors = {
  ...darkBase,
  background: darkBase.paper,
  text: darkBase.ink,
  secondaryText: darkBase.inkMuted,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  chip: 6,
  control: 12,
  card: 16,
  sheet: 22,
} as const;

/**
 * Font family names the Vespers typography uses, once bundled -- see
 * ./fonts.ts and mobile/assets/fonts/README.md for exactly which files
 * are still needed and how loading them in is wired up. Referencing
 * these names below is safe today even though the files aren't bundled
 * yet: React Native silently falls back to the platform system font for
 * an unregistered family name, so every screen keeps rendering
 * correctly on system fonts right now and picks up the real faces the
 * moment ./fonts.ts's loader is turned on, with no further token
 * changes needed.
 */
export const fontFamilies = {
  headingRegular: 'Newsreader-Regular',
  headingMedium: 'Newsreader-Medium',
  headingSemiBold: 'Newsreader-SemiBold',
  headingItalic: 'Newsreader-Italic',
  interfaceRegular: 'Archivo-Regular',
  interfaceMedium: 'Archivo-Medium',
  interfaceSemiBold: 'Archivo-SemiBold',
  interfaceBold: 'Archivo-Bold',
  teluguRegular: 'NotoSansTelugu-Regular',
  teluguSemiBold: 'NotoSansTelugu-SemiBold',
} as const;

/** Type scale -- sizes/weights/line-heights from the approved Vespers direction. */
export const typography = {
  headingXl: {
    fontFamily: fontFamilies.headingMedium,
    fontSize: 28,
    fontWeight: '500' as const,
    lineHeight: 34,
  },
  heading: {
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  title: {
    fontFamily: fontFamilies.headingSemiBold,
    fontSize: 19,
    fontWeight: '600' as const,
    lineHeight: 25,
  },
  scripture: {
    fontFamily: fontFamilies.headingRegular,
    fontSize: 19,
    fontWeight: '400' as const,
    lineHeight: 31,
  },
  body: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 25,
  },
  bodySmall: {
    fontFamily: fontFamilies.interfaceRegular,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  label: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
  },
  meta: {
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 12.5,
    fontWeight: '500' as const,
  },
} as const;
