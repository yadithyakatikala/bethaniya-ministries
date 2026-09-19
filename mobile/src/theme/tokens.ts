/**
 * The Maranatha design tokens.
 *
 * =====================================================================
 * WHAT CHANGED IN M3, AND WHY
 * =====================================================================
 * V1 shipped the green "Vespers" palette and a `typography` export that
 * NO SCREEN EVER IMPORTED. The audit found 118 hardcoded `fontSize`
 * literals across 33 files using 22 distinct sizes between 10.5 and 28,
 * and `fontFamily` appearing in exactly zero screens -- the whole app
 * rendered on the platform system font. So there was a type scale on
 * paper and an accidental one in practice.
 *
 * M3 replaces both halves:
 *
 *   * The identity is now ink-on-paper, matching the portrait the brand
 *     is built from. Black and white is the PRIMARY identity, not the
 *     whole palette: success, warning, error, info and live keep real,
 *     separately-tuned hues, because a reader must be able to tell "this
 *     is live now" from "this failed to save" without reading the text.
 *   * Type is semantic. Every role below has one definition, and screens
 *     spread a role instead of inventing a size.
 *
 * =====================================================================
 * COLOUR IS CHECKED, NOT EYEBALLED
 * =====================================================================
 * Every foreground/background pair this palette actually paints is run
 * through real WCAG 2.1 arithmetic in ./__tests__/contrast.test.ts.
 * Text pairs must clear 4.5:1, meaningful non-text pairs (an input
 * outline, a selected border) 3:1. The tuning that produced these values
 * fixed three things the V1 palette got wrong:
 *
 *   * placeholders -- there was no token for them, so screens reused
 *     `inkMuted` or an ad-hoc grey. `inkSubtle` exists and clears 4.5:1.
 *   * disabled states -- `AppButton` faded the whole control to
 *     `opacity: 0.5`, which took its label under 3:1. `disabledInk` and
 *     `disabledSurface` are real tokens that stay readable.
 *   * borders -- one `border` token did both invisible hairlines and
 *     input outlines. Now `border` is the decorative hairline and
 *     `borderStrong` is the one that has to be seen (3.1-3.5:1).
 */
import type { TextStyle } from 'react-native';

/**
 * The two scripts the type system resolves a face for.
 *
 * Structurally identical to `BibleLanguage` in
 * ../features/bible/types.ts, and deliberately declared here instead of
 * imported: the theme layer must not depend on a feature module.
 * ./__tests__/typography.test.ts asserts the two stay in step.
 */
export type ScriptLanguage = 'en' | 'te';

export interface ThemeColors {
  /** The page. */
  paper: string;
  /** A card or sheet sitting on the page. */
  surface: string;
  /** A panel sitting on a card -- inputs, inset rows, code-ish blocks. */
  surfaceRaised: string;
  /** Decorative hairline. Low contrast BY DESIGN -- see `borderStrong`. */
  border: string;
  /**
   * A border that carries meaning and therefore has to be visible: an
   * input outline, a selected chip, a focus ring. Clears the 3:1 WCAG
   * 1.4.11 minimum for non-text UI in both palettes.
   */
  borderStrong: string;
  /** Primary text. */
  ink: string;
  /** Secondary text -- captions, metadata, help sentences. */
  inkMuted: string;
  /** Placeholders and the faintest readable text. Still clears 4.5:1. */
  inkSubtle: string;
  /**
   * The brand's action colour: near-black in light mode, near-white in
   * dark. This is the "black and white primary identity" -- a filled
   * button, a selected tab, an active chip.
   */
  primary: string;
  primaryPressed: string;
  /** A wash of `primary` for selected rows and quiet chips. */
  primaryTint: string;
  /**
   * Text/icon colour for content sitting ON `primary`. NOT always white:
   * `primary` inverts between the palettes, so a hardcoded white label
   * is unreadable in one of them. This was a real V1 defect -- the
   * primary button's label measured 2.04:1 in dark mode.
   */
  onPrimary: string;
  /**
   * The one warm editorial note: verse numbers, scripture references,
   * the Daily Verse label. Keeps the reading surfaces from being pure
   * greyscale without introducing a second brand colour.
   */
  accent: string;
  accentTint: string;

  // --- Semantic status. Five distinguishable hues, each with a tint for
  // --- quiet badges and an on- colour for solid fills.
  success: string;
  successTint: string;
  onSuccess: string;
  warning: string;
  warningTint: string;
  onWarning: string;
  danger: string;
  dangerTint: string;
  onDanger: string;
  info: string;
  infoTint: string;
  onInfo: string;
  /** Live broadcast. Shares `danger`'s hue but is a separate token so the
   *  two can diverge without one silently restyling the other. */
  live: string;
  liveTint: string;
  onLive: string;

  /** A disabled control's label. Muted but still readable. */
  disabledInk: string;
  /** A disabled control's fill. */
  disabledSurface: string;

  /** @deprecated alias of `paper` -- kept so pre-M3 screens keep working */
  background: string;
  /** @deprecated alias of `ink` */
  text: string;
  /** @deprecated alias of `inkMuted` */
  secondaryText: string;
}

const lightBase = {
  paper: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceRaised: '#F3F3EF',
  border: '#D0D0C8',
  borderStrong: '#868B87',
  ink: '#101114',
  inkMuted: '#55595F',
  inkSubtle: '#6B7077',
  primary: '#16181C',
  primaryPressed: '#000000',
  primaryTint: '#EDEDE9',
  onPrimary: '#FFFFFF',
  accent: '#8F5A26',
  accentTint: '#F6EFE6',
  success: '#1F6B43',
  successTint: '#E6F0E9',
  onSuccess: '#FFFFFF',
  warning: '#7D5200',
  warningTint: '#F9F0DD',
  onWarning: '#FFFFFF',
  danger: '#B3261E',
  dangerTint: '#FBEAE8',
  onDanger: '#FFFFFF',
  info: '#1C5570',
  infoTint: '#E6EEF3',
  onInfo: '#FFFFFF',
  live: '#B3261E',
  liveTint: '#FBEAE8',
  onLive: '#FFFFFF',
  disabledInk: '#6F747B',
  disabledSurface: '#F0F0EC',
};

/**
 * Dark mode is re-pitched, not inverted. A near-black ground with a
 * near-white primary keeps the ink/paper identity, and every status hue
 * is lifted rather than reused: the light palette's `success` (#1F6B43)
 * on a dark ground would measure 1.6:1.
 */
const darkBase = {
  paper: '#0E0F11',
  surface: '#16181B',
  surfaceRaised: '#1F2226',
  border: '#383C42',
  borderStrong: '#616770',
  ink: '#F4F5F6',
  inkMuted: '#AAB0B7',
  inkSubtle: '#868C93',
  primary: '#F4F5F6',
  primaryPressed: '#FFFFFF',
  primaryTint: '#23262A',
  // Dark ink, not white: dark-mode `primary` is near-white.
  onPrimary: '#0E0F11',
  accent: '#DCA766',
  accentTint: '#241D14',
  success: '#74C595',
  successTint: '#152219',
  onSuccess: '#0E0F11',
  warning: '#E2B667',
  warningTint: '#241E12',
  onWarning: '#0E0F11',
  danger: '#FF7A6A',
  dangerTint: '#2C1917',
  onDanger: '#0E0F11',
  info: '#83B9D8',
  infoTint: '#13212A',
  onInfo: '#0E0F11',
  live: '#FF7A6A',
  liveTint: '#2C1917',
  onLive: '#0E0F11',
  disabledInk: '#767C83',
  disabledSurface: '#1B1E21',
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

/**
 * The spacing scale. A 4dp base, plus the semantic names screens
 * actually reach for -- `screen` existed as the literal `padding: 20` in
 * a dozen containers and was not on the old scale at all.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,

  /** Horizontal gutter on a full screen. */
  screen: 20,
  /** Padding inside a card. */
  card: 16,
  /** Gap between top-level sections of a screen. */
  section: 24,
  /** Gap between rows of a list. */
  row: 12,
  /** Gap between a label and the control it names. */
  field: 8,
} as const;

export const radii = {
  chip: 6,
  control: 12,
  card: 16,
  sheet: 22,
  /** A fully rounded pill -- badges, avatars. */
  pill: 999,
} as const;

/**
 * The smallest touch target the app ships, in dp.
 *
 * 44 is the WCAG 2.5.5 / platform-guideline figure. It is a token rather
 * than a literal because ./__tests__ asserts against it, so a control
 * that drops below it fails a test instead of shipping.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * =====================================================================
 * FONT FAMILIES
 * =====================================================================
 * Three bundled OFL 1.1 families -- see scripts/fetch-fonts.py for the
 * pinned sources, the asserted hashes, and the coverage measurements
 * that decided them. The short version:
 *
 *   INTERFACE -- Hind Guntur, which covers Telugu AND Latin in one
 *   family. That matters more than it sounds: React Native cannot fall
 *   back between fonts inside one Text node in any controlled way, and
 *   the Telugu UI catalogue contains 26 Latin letters ('YouTube',
 *   'you@example.com', the product name). A Telugu-only interface face
 *   would have left those words without glyphs, mid-label.
 *
 *   SCRIPTURE -- Noto Serif for English, Noto Serif Telugu for Telugu.
 *   Siblings from one design programme, so bilingual stacked verses read
 *   as one typeface. Safe to pick by language because scripture nodes
 *   are single-script: the WEB English text is pure ASCII and the Telugu
 *   IRV text contains no Latin at all, both verified against the
 *   bundled data.
 */
export const fontFamilies = {
  interfaceRegular: 'HindGuntur-Regular',
  interfaceMedium: 'HindGuntur-Medium',
  interfaceSemiBold: 'HindGuntur-SemiBold',
  interfaceBold: 'HindGuntur-Bold',
  serifEnRegular: 'NotoSerif-Regular',
  serifEnSemiBold: 'NotoSerif-SemiBold',
  serifTeRegular: 'NotoSerifTelugu-Regular',
  serifTeSemiBold: 'NotoSerifTelugu-SemiBold',
} as const;

/** The serif face for a given script and weight. */
export function serifFor(
  language: ScriptLanguage,
  weight: 'regular' | 'semiBold' = 'regular'
): string {
  if (language === 'te') {
    return weight === 'semiBold'
      ? fontFamilies.serifTeSemiBold
      : fontFamilies.serifTeRegular;
  }
  return weight === 'semiBold'
    ? fontFamilies.serifEnSemiBold
    : fontFamilies.serifEnRegular;
}

/**
 * Telugu needs more leading than Latin at the same size.
 *
 * Telugu stacks vowel signs above and below the base consonant, so a
 * line height tuned on Latin ascenders/descenders clips them. Measured
 * against the bundled faces, ~12% extra is enough to clear the marks
 * without opening the paragraph up so far that it stops reading as one
 * block. Applied by `typographyFor()` and by the reading tokens, so no
 * screen has to remember it.
 */
export const TELUGU_LINE_HEIGHT_BOOST = 0.12;

function withTeluguLeading<T extends TextStyle>(style: T, language: ScriptLanguage): T {
  if (language !== 'te' || typeof style.lineHeight !== 'number') return style;
  return {
    ...style,
    lineHeight: Math.round(style.lineHeight * (1 + TELUGU_LINE_HEIGHT_BOOST)),
  };
}

/**
 * =====================================================================
 * THE TYPE SCALE
 * =====================================================================
 * Semantic roles, one definition each. Sizes are a deliberate ramp
 * rather than the 22 accidental values the audit found.
 *
 * `fontWeight` is set alongside `fontFamily` on purpose: the family
 * already carries the weight (Android picks the file, not a synthetic
 * weight), and the numeric value keeps the style readable and keeps iOS
 * from synthesising a different one.
 */
export interface TypeScale {
  /** Brand moments only -- the sign-in wordmark. */
  display: TextStyle;
  /** A screen's own title where the screen owns its header. */
  headline: TextStyle;
  /** Card titles, book and chapter headings. */
  title: TextStyle;
  /** Lead paragraphs, a devotional body, a prayer. */
  bodyLarge: TextStyle;
  /** Default running text. */
  body: TextStyle;
  /** Dense secondary text -- list subtitles, help sentences. */
  bodySmall: TextStyle;
  /** Buttons, selector options, form labels. */
  label: TextStyle;
  /** Metadata, timestamps, counts. */
  caption: TextStyle;
  /** Tracked uppercase section headers. */
  overline: TextStyle;
  /** Verse text. See also `readingScale` for the reader's own controls. */
  scripture: TextStyle;
  /** "Genesis 1:1" -- a reference, not scripture. */
  scriptureReference: TextStyle;
}

/**
 * The type scale for a script.
 *
 * ---------------------------------------------------------------------
 * WHY THE EDITORIAL SERIF IS ENGLISH-ONLY
 * ---------------------------------------------------------------------
 * The obvious design -- serif headings in both languages -- is broken,
 * and measuring it is the only way to see that. Noto Serif Telugu
 * contains NO Latin letters, and the Telugu UI catalogue contains 27
 * characters it therefore cannot draw: the product name, 'YouTube',
 * 'Google', 'you@example.com', 'CC BY-SA'. A Telugu heading reading
 * "{app}కి స్వాగతం" would have rendered the Telugu and dropped
 * "Maranatha" to a fallback face mid-sentence.
 *
 * So the heading roles take the serif only where it is provably safe --
 * the English catalogue is 62 characters and Noto Serif covers all of
 * them -- and Hind Guntur, which covers both scripts, everywhere else.
 * Telugu headings are therefore set in the interface family one weight
 * up. The two languages read with slightly different voices, which is
 * the honest cost of there being no OFL serif that covers Telugu AND
 * Latin. ./__tests__/typography.test.ts asserts the rule directly.
 *
 * SCRIPTURE is the exception, and the reason the serif is here at all:
 * a verse is single-script and its language is known, so
 * `scriptureStyle()` takes the matching serif in both languages.
 *
 * FIRESTORE CONTENT -- a song's lyrics, a prayer, an event description,
 * a daily verse -- is of UNKNOWN script and must use an interface role
 * (`bodyLarge`), never a serif one, for exactly the reason above.
 */
export function typographyFor(language: ScriptLanguage): TypeScale {
  /** The heading face: serif for English, interface family for Telugu. */
  const headingFamily =
    language === 'en' ? fontFamilies.serifEnSemiBold : fontFamilies.interfaceSemiBold;

  const scale: TypeScale = {
    display: {
      fontFamily: headingFamily,
      fontSize: 32,
      fontWeight: '600',
      lineHeight: 38,
      letterSpacing: -0.4,
    },
    headline: {
      fontFamily: headingFamily,
      fontSize: 26,
      fontWeight: '600',
      lineHeight: 32,
      letterSpacing: -0.2,
    },
    title: {
      fontFamily: headingFamily,
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 26,
    },
    bodyLarge: {
      fontFamily: fontFamilies.interfaceRegular,
      fontSize: 17,
      fontWeight: '400',
      lineHeight: 26,
    },
    body: {
      fontFamily: fontFamilies.interfaceRegular,
      fontSize: 15.5,
      fontWeight: '400',
      lineHeight: 23,
    },
    bodySmall: {
      fontFamily: fontFamilies.interfaceRegular,
      fontSize: 13.5,
      fontWeight: '400',
      lineHeight: 20,
    },
    label: {
      fontFamily: fontFamilies.interfaceSemiBold,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
    },
    caption: {
      fontFamily: fontFamilies.interfaceMedium,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    overline: {
      fontFamily: fontFamilies.interfaceBold,
      fontSize: 11.5,
      fontWeight: '700',
      lineHeight: 15,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    scripture: {
      fontFamily: serifFor(language, 'regular'),
      fontSize: 19,
      fontWeight: '400',
      lineHeight: 31,
    },
    scriptureReference: {
      fontFamily: fontFamilies.interfaceSemiBold,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      letterSpacing: 0.2,
    },
  };

  return Object.fromEntries(
    Object.entries(scale).map(([role, style]) => [
      role,
      withTeluguLeading(style, language),
    ])
  ) as unknown as TypeScale;
}

/**
 * =====================================================================
 * BIBLE READING TOKENS -- the foundation M4 consumes
 * =====================================================================
 * M3 does not build the reader. It establishes the values the reader
 * will change, so that "font size", "line height" and "reading width"
 * are named, bounded steps rather than free numbers invented later.
 *
 * Steps rather than continuous ranges on purpose: a reader control with
 * six named sizes is testable and cannot produce an unreadable value,
 * and the persisted preference is a short key rather than a float.
 */
export const readingScale = {
  /** Verse-text size steps, smallest to largest. */
  size: { xs: 16, sm: 17.5, md: 19, lg: 21, xl: 23.5, xxl: 26 },
  defaultSize: 'md',

  /**
   * Line height as a MULTIPLIER of the size step, so changing size keeps
   * the chosen density. Telugu gets TELUGU_LINE_HEIGHT_BOOST on top --
   * see `readingLineHeight()`.
   */
  lineHeight: { compact: 1.45, normal: 1.62, relaxed: 1.8 },
  defaultLineHeight: 'normal',

  /**
   * Maximum width of the text column, in dp. A full-bleed line on a
   * tablet runs past the ~60-75 characters an eye tracks comfortably,
   * which is the single biggest difference between "a page of text" and
   * "a reading experience".
   */
  measure: { narrow: 480, normal: 620, wide: 820 },
  defaultMeasure: 'normal',

  /** Vertical gap between verses, by density. */
  verseGap: { compact: 6, normal: 12, relaxed: 20 },
  /** Vertical gap between paragraphs / poetry stanzas. */
  paragraphGap: { compact: 12, normal: 20, relaxed: 28 },
  /** Width reserved for the verse number, wide enough for "39-40". */
  verseNumberColumn: 34,
} as const;

export type ReadingSize = keyof typeof readingScale.size;
export type ReadingDensity = keyof typeof readingScale.lineHeight;
export type ReadingMeasure = keyof typeof readingScale.measure;

/**
 * The reader's scripture typeface choice (M4).
 *
 * Two options, because two is what the bundled families honestly offer
 * for BOTH scripts:
 *
 *   'serif'  Noto Serif / Noto Serif Telugu -- the editorial default,
 *            and what a printed Bible looks like.
 *   'sans'   Hind Guntur, the interface family. Chosen by readers who
 *            find a serif harder at small sizes, and the only bundled
 *            sans that covers Telugu as well as Latin.
 *
 * There is no third "system font" option: the point of bundling fonts
 * (see scripts/fetch-fonts.py) is that the reader renders identically on
 * every device, and a runtime-resolved system face for Telugu is exactly
 * the per-glyph fallback M3 removed.
 */
export type ReadingFont = 'serif' | 'sans';

/** The scripture face for a script and the reader's font choice. */
export function scriptureFontFamily(
  language: ScriptLanguage,
  font: ReadingFont = 'serif'
): string {
  return font === 'sans' ? fontFamilies.interfaceRegular : serifFor(language, 'regular');
}

/** The resolved line height in dp for a size step, density and script. */
export function readingLineHeight(
  size: ReadingSize,
  density: ReadingDensity,
  language: ScriptLanguage
): number {
  const base = readingScale.size[size] * readingScale.lineHeight[density];
  return Math.round(language === 'te' ? base * (1 + TELUGU_LINE_HEIGHT_BOOST) : base);
}

/** A complete verse-text style for the reader's current settings. */
export function scriptureStyle(
  language: ScriptLanguage,
  size: ReadingSize = readingScale.defaultSize as ReadingSize,
  density: ReadingDensity = readingScale.defaultLineHeight as ReadingDensity,
  font: ReadingFont = 'serif'
): TextStyle {
  return {
    fontFamily: scriptureFontFamily(language, font),
    fontSize: readingScale.size[size],
    fontWeight: '400',
    lineHeight: readingLineHeight(size, density, language),
  };
}

/**
 * Highlight colours for M4's verse highlighting.
 *
 * Four hues, each a background the body `ink` still reads on -- a
 * highlight that forces its own text colour would fight the theme, and
 * one tuned only for light mode would be a solid block in dark mode.
 * Asserted in ./__tests__/contrast.test.ts like everything else.
 *
 * ALL FOUR SIT AT THE SAME LIGHTNESS ON PURPOSE (they differ by ~1.05:1
 * from each other), so a highlighted page keeps its rhythm. The
 * consequence M4 has to handle: hue alone does not distinguish them for
 * a colour-blind reader, so the reader's highlight picker must NAME each
 * colour rather than showing four swatches.
 */
export const highlightTints = {
  light: {
    yellow: '#FBF1C7',
    green: '#DFEEE2',
    blue: '#DFE9F2',
    pink: '#F7E3E8',
  },
  dark: {
    yellow: '#3A3218',
    green: '#1B2E22',
    blue: '#1A2833',
    pink: '#33202A',
  },
} as const;

export type HighlightColor = keyof typeof highlightTints.light;
