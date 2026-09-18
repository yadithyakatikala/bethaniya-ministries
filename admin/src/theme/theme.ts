import { createTheme } from '@mui/material/styles';
import { ADMIN_MIN_TOUCH_TARGET, adminColors, adminFonts, adminRadii } from './tokens';

/**
 * The Maranatha MUI theme.
 *
 * Every visual value comes from ./tokens.ts, which is the admin's copy
 * of the mobile design tokens -- see that file for why there are two
 * copies and what had drifted between them.
 *
 * This is still the only file most of the admin's visual delta comes
 * from: MUI components read `palette` / `typography` / `shape`, so
 * colour, type and radii cascade without touching a page. M3 adds the
 * semantic status colours, the real type scale (the theme previously
 * declared a font family and six heading families and nothing else), and
 * component defaults that enforce the 44px target and the placeholder
 * contrast the brief asks for.
 *
 * Light mode only, as before: the dashboard has no dark-mode preference
 * to read, unlike the mobile app's usePreferences().isDark. Adding one
 * is a product decision, not a token change.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: adminColors.primary,
      dark: adminColors.primaryPressed,
      light: adminColors.primaryTint,
      contrastText: adminColors.onPrimary,
    },
    secondary: {
      main: adminColors.accent,
      light: adminColors.accentTint,
      contrastText: adminColors.onPrimary,
    },
    error: { main: adminColors.danger, light: adminColors.dangerTint },
    warning: { main: adminColors.warning, light: adminColors.warningTint },
    info: { main: adminColors.info, light: adminColors.infoTint },
    success: { main: adminColors.success, light: adminColors.successTint },
    background: {
      default: adminColors.paper,
      paper: adminColors.surface,
    },
    text: {
      primary: adminColors.ink,
      secondary: adminColors.inkMuted,
      disabled: adminColors.disabledInk,
    },
    divider: adminColors.border,
    action: {
      disabled: adminColors.disabledInk,
      disabledBackground: adminColors.disabledSurface,
    },
  },
  shape: {
    borderRadius: adminRadii.control,
  },
  typography: {
    fontFamily: adminFonts.interface,
    // The same ramp as the mobile type scale, so a heading means the
    // same thing in both surfaces.
    h1: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1.625rem',
      lineHeight: 1.25,
    },
    h3: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1.375rem',
      lineHeight: 1.3,
    },
    h4: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.3,
    },
    h5: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.35,
    },
    h6: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.4,
    },
    body1: { fontSize: '0.96875rem', lineHeight: 1.48 },
    body2: { fontSize: '0.84375rem', lineHeight: 1.48 },
    subtitle1: { fontWeight: 600, fontSize: '0.96875rem' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
    caption: { fontWeight: 500, fontSize: '0.75rem' },
    overline: {
      fontWeight: 700,
      fontSize: '0.71875rem',
      letterSpacing: '0.9px',
      textTransform: 'uppercase',
    },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: adminRadii.control,
          // 44, not 40: the same minimum the mobile app enforces, and the
          // WCAG 2.5.5 figure. A dashboard is used on laptops with
          // trackpads and on tablets in a church office, not only with a
          // mouse.
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          paddingInline: 18,
        },
        sizeSmall: { minHeight: 36, paddingInline: 12 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: ADMIN_MIN_TOUCH_TARGET,
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          borderRadius: adminRadii.control,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: adminRadii.card,
          border: `1px solid ${adminColors.border}`,
          // Borders first, no shadow -- the same rule as the mobile Card,
          // so the two surfaces read as one product.
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: adminRadii.control,
          minHeight: ADMIN_MIN_TOUCH_TARGET,
        },
        notchedOutline: { borderColor: adminColors.border },
        input: {
          // The default MUI placeholder is 42% opaque black, which
          // measures about 2.9:1 -- under the AA minimum. `inkSubtle` is
          // the token tuned to stay above 4.5:1 while still reading as a
          // placeholder.
          '&::placeholder': { color: adminColors.inkSubtle, opacity: 1 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: adminColors.inkMuted },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: adminColors.ink,
          color: adminColors.onPrimary,
          fontSize: '0.8125rem',
        },
      },
    },
  },
});
