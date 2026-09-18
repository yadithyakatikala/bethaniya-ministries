import { describe, expect, it } from 'vitest';
import { ADMIN_MIN_TOUCH_TARGET, adminColors, adminFonts, adminRadii } from '../tokens';
import { theme } from '../theme';

/**
 * The admin's half of the design system.
 *
 * WHY THESE ASSERTIONS EXIST. The two apps are separate builds with no
 * shared package, so the tokens are written twice. They had drifted: the
 * dashboard was still on `#A96C33` after the mobile app darkened its
 * accent to `#8F5A26` to clear the 4.5:1 AA minimum, and on a
 * `borderRadius` of 10 against the mobile app's 12. Nothing caught
 * either, because nothing compared them.
 *
 * The values below are copied deliberately from
 * mobile/src/theme/tokens.ts. If that file changes, this test fails and
 * someone has to decide -- which is the point.
 */
const MOBILE_LIGHT = {
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

describe('the admin palette does not drift from the mobile one', () => {
  it.each(Object.entries(MOBILE_LIGHT))(
    '%s matches the mobile light token',
    (key, value) => {
      expect(adminColors[key as keyof typeof MOBILE_LIGHT]).toBe(value);
    }
  );

  it('shares the mobile radii and touch minimum', () => {
    expect(adminRadii.control).toBe(12);
    expect(adminRadii.card).toBe(16);
    expect(ADMIN_MIN_TOUCH_TARGET).toBe(44);
  });
});

describe('the admin palette meets WCAG AA', () => {
  const pairs: [string, keyof typeof adminColors, keyof typeof adminColors][] = [
    ['body text on paper', 'ink', 'paper'],
    ['body text on surface', 'ink', 'surface'],
    ['secondary text on surface', 'inkMuted', 'surface'],
    ['placeholder on surface', 'inkSubtle', 'surface'],
    ['button label', 'onPrimary', 'primary'],
    ['success chip', 'success', 'successTint'],
    ['warning chip', 'warning', 'warningTint'],
    ['error chip', 'danger', 'dangerTint'],
    ['info chip', 'info', 'infoTint'],
    ['accent on surface', 'accent', 'surface'],
    // The sidebar is an inverted surface, so its own pairs need checking
    // separately from the light ones.
    ['sidebar label', 'sidebarText', 'sidebarBg'],
    ['sidebar muted label', 'sidebarTextMuted', 'sidebarBg'],
    ['sidebar selected label', 'sidebarSelectedText', 'sidebarSelectedBg'],
    ['sidebar avatar initial', 'sidebarAvatarText', 'sidebarAvatarBg'],
  ];

  it.each(pairs)('%s', (_name, fg, bg) => {
    expect(contrastRatio(adminColors[fg], adminColors[bg])).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    );
  });

  it('keeps a disabled label readable', () => {
    expect(
      contrastRatio(adminColors.disabledInk, adminColors.disabledSurface)
    ).toBeGreaterThanOrEqual(3);
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

  it('gives cards a border and no shadow, matching the mobile Card', () => {
    const card = theme.components?.MuiCard?.styleOverrides?.root as {
      boxShadow?: string;
      borderRadius?: number;
    };
    expect(card.boxShadow).toBe('none');
    expect(card.borderRadius).toBe(adminRadii.card);
  });
});
