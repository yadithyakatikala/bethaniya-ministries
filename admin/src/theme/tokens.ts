/**
 * The admin's design tokens: deep navy for structure, warm ivory for the
 * ground, restrained gold for emphasis.
 *
 * HOW THIS RELATES TO THE MOBILE APP. The two apps are separate builds
 * with no shared package. Until the admin redesign this file copied the
 * mobile palette value for value, and a test pinned every copy. The
 * redesign gives the dashboard its OWN structural palette on purpose --
 * navy rail, ivory ground, gold marks -- because an operator's tool and a
 * congregation's reading app do different jobs and do not need to look
 * identical. What must NOT drift is meaning:
 *
 *   * the four status colours (success, warning, danger, info) and their
 *     tints are still the mobile values, and ./__tests__/tokens.test.ts
 *     still pins them, so "red means something is wrong" is the same in
 *     both surfaces;
 *   * the brand gold is still the mobile accent (`accent` below equals
 *     mobile's light-palette `brandGold.base`), so the metal reads as the
 *     same metal.
 *
 * GOLD IS AN ACCENT, NOT A FILL. It appears as: the marker beside the
 * selected navigation item, a short rule under a page title, the focus
 * ring, links and small labels, and the fill of a progress bar. It is never
 * a page, card or button background. Buttons are navy.
 *
 * Every foreground/background pair a component uses is asserted against
 * WCAG AA in ./__tests__/tokens.test.ts. Input borders are held to the
 * 3:1 non-text minimum (WCAG 1.4.11) -- the MUI default is under 2:1.
 */

export const adminColors = {
  // --- Ground. Warm ivory rather than white: a screen used for hours
  // reads softer, and white cards sit on it without needing shadows.
  paper: '#F7F4EC',
  surface: '#FFFFFF',
  surfaceRaised: '#F1EDE2',
  surfaceSunken: '#E9E4D6',
  /** Decorative hairlines (dividers, card edges). NOT for input edges. */
  border: '#E3DDCD',
  /** The edge of an input, select or checkbox: 3:1 against the surface. */
  borderStrong: '#8C8573',

  // --- Ink.
  ink: '#131A28',
  inkMuted: '#465065',
  inkSubtle: '#5B6579',

  // --- Navy, the structural colour. Primary buttons are navy.
  primary: '#0F1B30',
  primaryHover: '#1A2B49',
  primaryPressed: '#070F1D',
  primaryTint: '#E8ECF3',
  onPrimary: '#FFFFFF',

  // --- Gold.
  /** Text-safe gold on light surfaces -- the mobile accent, unchanged. */
  accent: '#8F5A26',
  accentTint: '#F6EEDD',
  /** Decorative metal on light surfaces (rules, ribbons). Not for text. */
  goldBase: '#B9863C',
  /** Gold on the navy rail. */
  goldBright: '#DCA766',

  // --- Status. Shared meaning with the mobile app; values pinned.
  success: '#1F6B43',
  successTint: '#E6F0E9',
  warning: '#7D5200',
  warningTint: '#F9F0DD',
  danger: '#B3261E',
  dangerTint: '#FBEAE8',
  info: '#1C5570',
  infoTint: '#E6EEF3',

  // --- Archived is neither good news nor bad: a quiet warm grey.
  archived: '#4F4A3C',
  archivedTint: '#ECE8DC',

  disabledInk: '#6F747B',
  disabledSurface: '#ECE8DC',

  // --- The navigation rail, an inverted surface. Every pair is asserted.
  sidebarBg: '#0F1B30',
  sidebarBorder: '#21314F',
  sidebarText: '#F5F1E7',
  sidebarTextMuted: '#AEB8CB',
  sidebarSelectedBg: '#1B2D4E',
  sidebarSelectedText: '#FFFFFF',
  sidebarAccent: '#DCA766',
  sidebarAvatarBg: '#F5F1E7',
  sidebarAvatarText: '#0F1B30',
} as const;

/**
 * Font stacks.
 *
 * Hind Guntur for the interface because it covers Telugu as well as
 * Latin, and this dashboard edits Telugu church content. Noto Serif for
 * headings, matching the mobile app's English editorial voice -- the
 * admin UI is English-only, so the serif is safe here in a way it is not
 * for the mobile app's Telugu interface (see that app's tokens.ts).
 */
export const adminFonts = {
  interface: "'Hind Guntur', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  heading: "'Noto Serif', Georgia, 'Times New Roman', serif",
} as const;

/**
 * Corner radii. Deliberately modest: small controls, slightly larger
 * cards. The previous 12/16 read as soft and toy-like on a dense data
 * screen, and every nested rounded box compounds it.
 */
export const adminRadii = {
  control: 8,
  card: 12,
  pill: 999,
} as const;

/** Minimum interactive height, matching the mobile app's 44dp rule. */
export const ADMIN_MIN_TOUCH_TARGET = 44;

/**
 * Layout constants shared by the shell and the page wrappers, so the
 * rail width and the content measure are defined once.
 */
export const adminLayout = {
  sidebarWidth: 264,
  /** Max content width by page kind: forms read narrow, tables run wide. */
  pageMaxWidth: { narrow: 760, default: 1120, wide: 1360 },
  /** The breakpoint at which the rail becomes permanent. */
  railBreakpoint: 'md',
} as const;

/** Soft, low shadows -- reserved for things that float (menus, dialogs). */
export const adminShadows = {
  floating: '0 12px 32px rgba(15, 27, 48, 0.18)',
  menu: '0 8px 24px rgba(15, 27, 48, 0.16)',
} as const;
