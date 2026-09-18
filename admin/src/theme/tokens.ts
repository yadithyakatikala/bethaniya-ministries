/**
 * The admin's copy of the Maranatha design tokens.
 *
 * WHY A COPY. The two apps are separate builds with no shared package,
 * so the values are written twice on purpose. What is NOT on purpose is
 * the two copies drifting, and they had: this dashboard was still using
 * `#A96C33` for its accent after the mobile app darkened it to `#8F5A26`
 * to reach the 4.5:1 AA minimum, and a `borderRadius` of 10 against the
 * mobile app's 12/16. Both are corrected here, and
 * ./__tests__/tokens.test.ts asserts the values that must match
 * mobile/src/theme/tokens.ts so the next drift fails a test.
 *
 * Only the tokens this dashboard actually paints are duplicated. The
 * mobile reading-experience tokens (verse sizes, line-height steps,
 * reading measure) have no admin equivalent and are deliberately absent.
 */

export const adminColors = {
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
  warning: '#7D5200',
  warningTint: '#F9F0DD',
  danger: '#B3261E',
  dangerTint: '#FBEAE8',
  info: '#1C5570',
  infoTint: '#E6EEF3',
  disabledInk: '#6F747B',
  disabledSurface: '#F0F0EC',

  // --- The sidebar, an inverted surface.
  // A dark navigation rail against light content is a deliberate
  // dashboard device, and with the ink/paper identity it is the same
  // near-black as the mobile app's dark ground -- it used to be the V1
  // Vespers green (#1F2A25 with #2E5347 selection), which now reads as a
  // different product beside the rest of the palette. Every pair below
  // is asserted in ./__tests__/tokens.test.ts.
  sidebarBg: '#16181C',
  sidebarBorder: '#2F3338',
  sidebarText: '#F4F5F6',
  sidebarTextMuted: '#A2A8AF',
  sidebarSelectedBg: '#2A2E34',
  sidebarSelectedText: '#FFFFFF',
  sidebarAvatarBg: '#F4F5F6',
  sidebarAvatarText: '#16181C',
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

export const adminRadii = {
  control: 12,
  card: 16,
} as const;

/** Minimum interactive height, matching the mobile app's 44dp rule. */
export const ADMIN_MIN_TOUCH_TARGET = 44;
