import { describe, expect, it } from 'vitest';
import {
  ADMIN_MIN_TOUCH_TARGET,
  adminColors,
  adminFonts,
  adminLayout,
  adminRadii,
} from '../tokens';
import { theme } from '../theme';

/**
 * The admin's half of the design system.
 *
 * WHAT IS PINNED TO THE MOBILE APP, AND WHAT IS NOT. The two apps are
 * separate builds with no shared package, so tokens are written twice. The
 * dashboard used to copy the whole mobile palette and this test pinned every
 * value. The redesign gives the dashboard its own structural palette --
 * navy, ivory, gold -- on purpose (see ../tokens.ts), so the surface and
 * ink values are no longer compared. What stays pinned is MEANING:
 *
 *   * the four status colours and their tints, so green/amber/red/blue
 *     mean the same thing in the dashboard and in the app;
 *   * the brand gold (`accent`), so the metal is the same metal.
 *
 * If mobile/src/theme/tokens.ts changes one of these, this test fails and
 * someone has to decide -- which is the point.
 */
const MOBILE_SHARED = {
  accent: '#8F5A26',
  success: '#1F6B43',
  successTint: '#E6F0E9',
  warning: '#7D5200',
  warningTint: '#F9F0DD',
  danger: '#B3261E',
  dangerTint: '#FBEAE8',
  info: '#1C5570',
  infoTint: '#E6EEF3',
} as const;

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
/** WCAG 1.4.11: the boundary of an input, and other meaningful graphics. */
const AA_NON_TEXT = 3;

describe('what the admin shares with the mobile app', () => {
  it.each(Object.entries(MOBILE_SHARED))(
    '%s matches the mobile light token',
    (key, value) => {
      expect(adminColors[key as keyof typeof MOBILE_SHARED]).toBe(value);
    }
  );

  it('keeps the 44px touch minimum the mobile app enforces', () => {
    expect(ADMIN_MIN_TOUCH_TARGET).toBe(44);
  });
});

describe('the admin has its own structural palette', () => {
  it('uses navy for structure and gold only as an accent', () => {
    // Gold must never become the fill of a button or the primary colour.
    expect(theme.palette.primary.main).toBe(adminColors.primary);
    expect(adminColors.primary).not.toBe(adminColors.accent);
    expect(adminColors.primary).not.toBe(adminColors.goldBase);
    expect(adminColors.primary).not.toBe(adminColors.goldBright);
    // The contained-primary variant is where a button's hover and pressed
    // colours live; both are navy, never gold.
    const variants = (theme.components?.MuiButton?.variants ?? []) as {
      props: { variant?: string; color?: string };
      style: { '&:hover'?: { backgroundColor?: string } };
    }[];
    const contained = variants.find(
      (v) => v.props.variant === 'contained' && v.props.color === 'primary'
    );
    expect(contained?.style['&:hover']?.backgroundColor).toBe(adminColors.primaryHover);
  });

  it('puts the page on a warm ivory ground with white cards', () => {
    expect(adminColors.paper).toBe('#F7F4EC');
    expect(adminColors.surface).toBe('#FFFFFF');
    expect(adminColors.paper).not.toBe(adminColors.surface);
  });

  it('uses modest radii', () => {
    expect(adminRadii.control).toBe(8);
    expect(adminRadii.card).toBe(12);
  });

  it('keeps a readable content measure and a fixed-width rail', () => {
    expect(adminLayout.sidebarWidth).toBeGreaterThanOrEqual(240);
    expect(adminLayout.pageMaxWidth.narrow).toBeLessThan(
      adminLayout.pageMaxWidth.default
    );
    expect(adminLayout.pageMaxWidth.default).toBeLessThan(adminLayout.pageMaxWidth.wide);
  });
});

describe('the admin palette meets WCAG AA', () => {
  const textPairs: [string, keyof typeof adminColors, keyof typeof adminColors][] = [
    ['body text on paper', 'ink', 'paper'],
    ['body text on surface', 'ink', 'surface'],
    ['body text on a raised panel', 'ink', 'surfaceRaised'],
    ['secondary text on paper', 'inkMuted', 'paper'],
    ['secondary text on surface', 'inkMuted', 'surface'],
    ['secondary text on a raised panel', 'inkMuted', 'surfaceRaised'],
    ['placeholder on surface', 'inkSubtle', 'surface'],
    ['placeholder on paper', 'inkSubtle', 'paper'],
    ['placeholder on a raised panel', 'inkSubtle', 'surfaceRaised'],
    ['button label', 'onPrimary', 'primary'],
    ['button label on hover', 'onPrimary', 'primaryHover'],
    ['navy on its tint', 'primary', 'primaryTint'],
    ['gold text on surface', 'accent', 'surface'],
    ['gold text on paper', 'accent', 'paper'],
    ['gold text on a raised panel', 'accent', 'surfaceRaised'],
    ['gold text on its tint', 'accent', 'accentTint'],
    ['success chip', 'success', 'successTint'],
    ['warning chip', 'warning', 'warningTint'],
    ['error chip', 'danger', 'dangerTint'],
    ['info chip', 'info', 'infoTint'],
    ['archived chip', 'archived', 'archivedTint'],
    ['success text on surface', 'success', 'surface'],
    ['warning text on surface', 'warning', 'surface'],
    ['error text on surface', 'danger', 'surface'],
    ['error text on paper', 'danger', 'paper'],
    ['info text on surface', 'info', 'surface'],
    // The rail is an inverted surface, so its own pairs need checking.
    ['rail label', 'sidebarText', 'sidebarBg'],
    ['rail muted label', 'sidebarTextMuted', 'sidebarBg'],
    ['rail muted label when selected', 'sidebarTextMuted', 'sidebarSelectedBg'],
    ['rail selected label', 'sidebarSelectedText', 'sidebarSelectedBg'],
    ['rail avatar initial', 'sidebarAvatarText', 'sidebarAvatarBg'],
    ['rail gold label', 'sidebarAccent', 'sidebarBg'],
  ];

  it.each(textPairs)('%s', (_name, fg, bg) => {
    expect(contrastRatio(adminColors[fg], adminColors[bg])).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    );
  });

  const nonTextPairs: [string, keyof typeof adminColors, keyof typeof adminColors][] = [
    ['an input edge on a white surface', 'borderStrong', 'surface'],
    ['an input edge on the ivory ground', 'borderStrong', 'paper'],
    ['the focus ring on the ivory ground', 'accent', 'paper'],
    ['the focus ring on a white surface', 'accent', 'surface'],
    ['the tab indicator on a white surface', 'goldBase', 'surface'],
    ['the rail marker on the selected item', 'sidebarAccent', 'sidebarSelectedBg'],
    ['a disabled label on its field', 'disabledInk', 'disabledSurface'],
  ];

  it.each(nonTextPairs)('%s', (_name, fg, bg) => {
    expect(contrastRatio(adminColors[fg], adminColors[bg])).toBeGreaterThanOrEqual(
      AA_NON_TEXT
    );
  });
});

describe('the MUI theme reads from the tokens', () => {
  it('takes its palette from adminColors rather than its own literals', () => {
    expect(theme.palette.primary.main).toBe(adminColors.primary);
    expect(theme.palette.secondary.main).toBe(adminColors.accent);
    expect(theme.palette.error.main).toBe(adminColors.danger);
    expect(theme.palette.warning.main).toBe(adminColors.warning);
    expect(theme.palette.info.main).toBe(adminColors.info);
    expect(theme.palette.success.main).toBe(adminColors.success);
    expect(theme.palette.background.default).toBe(adminColors.paper);
    expect(theme.palette.background.paper).toBe(adminColors.surface);
    expect(theme.palette.divider).toBe(adminColors.border);
  });

  it('uses the self-hosted families, not a remote one', () => {
    // index.html used to pull Newsreader and Archivo from
    // fonts.googleapis.com on every page load. Both names are gone.
    expect(theme.typography.fontFamily).toBe(adminFonts.interface);
    expect(theme.typography.fontFamily).toContain('Hind Guntur');
    expect(theme.typography.h1.fontFamily).toContain('Noto Serif');
    for (const family of [theme.typography.fontFamily, theme.typography.h1.fontFamily]) {
      expect(String(family)).not.toContain('Archivo');
      expect(String(family)).not.toContain('Newsreader');
    }
  });

  it('defines a descending heading ramp', () => {
    const sizes = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((variant) =>
      parseFloat(String(theme.typography[variant].fontSize))
    );
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]!).toBeLessThan(sizes[i - 1]!);
    }
  });

  it('holds buttons and icon buttons to the 44px minimum', () => {
    const button = theme.components?.MuiButton?.styleOverrides?.root as {
      minHeight?: number;
    };
    const iconButton = theme.components?.MuiIconButton?.styleOverrides?.root as {
      minHeight?: number;
    };
    expect(button.minHeight).toBe(ADMIN_MIN_TOUCH_TARGET);
    expect(iconButton.minHeight).toBe(ADMIN_MIN_TOUCH_TARGET);
  });

  it('overrides the MUI placeholder, whose default is under AA', () => {
    // MUI's default placeholder is 42% opaque black -- about 2.9:1.
    const input = theme.components?.MuiOutlinedInput?.styleOverrides?.input as {
      '&::placeholder'?: { color?: string; opacity?: number };
    };
    expect(input['&::placeholder']?.color).toBe(adminColors.inkSubtle);
    expect(input['&::placeholder']?.opacity).toBe(1);
  });

  it('draws input edges at the 3:1 non-text contrast, not the MUI default', () => {
    const outline = theme.components?.MuiOutlinedInput?.styleOverrides
      ?.notchedOutline as { borderColor?: string };
    expect(outline.borderColor).toBe(adminColors.borderStrong);
  });

  it('gives cards a border and no shadow', () => {
    const card = theme.components?.MuiCard?.styleOverrides?.root as {
      boxShadow?: string;
      borderRadius?: number;
    };
    expect(card.boxShadow).toBe('none');
    expect(card.borderRadius).toBe(adminRadii.card);
  });

  it('honours a request for reduced motion', () => {
    const baseline = theme.components?.MuiCssBaseline?.styleOverrides as Record<
      string,
      unknown
    >;
    expect(baseline['@media (prefers-reduced-motion: reduce)']).toBeDefined();
  });

  it('gives keyboard focus a visible indicator', () => {
    const baseline = theme.components?.MuiCssBaseline?.styleOverrides as Record<
      string,
      { outline?: string }
    >;
    const rule = baseline[':where(a, button, [role="button"], [tabindex]):focus-visible'];
    expect(rule?.outline).toContain(adminColors.accent);
  });
});
