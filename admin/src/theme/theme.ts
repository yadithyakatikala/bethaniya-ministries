import { createTheme } from '@mui/material/styles';
import {
  ADMIN_MIN_TOUCH_TARGET,
  adminColors,
  adminFonts,
  adminRadii,
  adminShadows,
} from './tokens';

/**
 * The Maranatha admin MUI theme.
 *
 * Every visual value comes from ./tokens.ts. MUI components read
 * `palette` / `typography` / `shape`, and this file overrides the
 * components the dashboard uses, so a page restyles by being rendered --
 * not by being edited. That is how the whole site moved onto one design
 * at once: pages were then touched only for layout, never for colour.
 *
 * What the design says, in one place:
 *   * NAVY is structure: the rail, primary buttons, selected states.
 *   * IVORY is the ground; white cards sit on it with a hairline edge and
 *     no shadow. Only things that float (menus, dialogs) cast one.
 *   * GOLD is an accent: the focus ring, links, the tab indicator, the
 *     progress fill, and the marker on the selected navigation item.
 *   * Controls are 44px tall (WCAG 2.5.5) with 8px corners; cards 12px.
 *   * Input edges are 3:1 against their surface (WCAG 1.4.11).
 *
 * Light mode only, as before: there is no dark-mode preference to read,
 * and adding one is a product decision rather than a token change.
 */

const focusRing = `2px solid ${adminColors.accent}`;

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
      hover: 'rgba(15, 27, 48, 0.045)',
      selected: adminColors.primaryTint,
      disabled: adminColors.disabledInk,
      disabledBackground: adminColors.disabledSurface,
      focus: adminColors.primaryTint,
    },
  },
  shape: {
    borderRadius: adminRadii.control,
  },
  typography: {
    fontFamily: adminFonts.interface,
    // A descending serif ramp for headings, the interface face for
    // everything else. Pages use h2 for their title (see PageHeader), h3
    // for a section, h4 for a card; h5/h6 are the small ones.
    h1: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1.625rem',
      lineHeight: 1.25,
      letterSpacing: '-0.005em',
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
      fontSize: '1.1875rem',
      lineHeight: 1.35,
    },
    h5: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '1.0625rem',
      lineHeight: 1.4,
    },
    h6: {
      fontFamily: adminFonts.heading,
      fontWeight: 600,
      fontSize: '0.9375rem',
      lineHeight: 1.4,
    },
    body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
    body2: { fontSize: '0.84375rem', lineHeight: 1.5 },
    subtitle1: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.45 },
    subtitle2: { fontWeight: 600, fontSize: '0.84375rem', lineHeight: 1.45 },
    caption: { fontWeight: 500, fontSize: '0.75rem', lineHeight: 1.4 },
    overline: {
      fontWeight: 700,
      fontSize: '0.6875rem',
      lineHeight: 1.4,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
    },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: adminColors.paper,
          color: adminColors.ink,
        },
        '::selection': { backgroundColor: adminColors.accentTint },
        // A visible focus indicator on everything keyboard-reachable that
        // MUI does not already outline itself. `:where` keeps the
        // specificity at zero so any component can still override it.
        ':where(a, button, [role="button"], [tabindex]):focus-visible': {
          outline: focusRing,
          outlineOffset: 2,
        },
        // People who ask their system for less motion get none.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: adminRadii.control,
          // 44, not 40: the same minimum the mobile app enforces, and the
          // WCAG 2.5.5 figure. A dashboard is used on laptops with
          // trackpads and on tablets in a church office, not only with a
          // mouse.
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          paddingInline: 18,
          '&.Mui-focusVisible': { outline: focusRing, outlineOffset: 2 },
        },
        sizeSmall: { minHeight: 36, paddingInline: 12 },
        sizeLarge: { minHeight: 48, paddingInline: 24 },
      },
      // MUI 9 removed the per-colour override keys (containedPrimary and
      // friends); a combination of variant and colour is a `variants` entry.
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            '&:hover': { backgroundColor: adminColors.primaryHover },
            '&:active': { backgroundColor: adminColors.primaryPressed },
          },
        },
        {
          props: { variant: 'outlined', color: 'primary' },
          style: {
            borderColor: adminColors.borderStrong,
            color: adminColors.primary,
            '&:hover': {
              borderColor: adminColors.primary,
              backgroundColor: adminColors.primaryTint,
            },
          },
        },
        {
          props: { variant: 'text', color: 'primary' },
          style: {
            color: adminColors.primary,
            '&:hover': { backgroundColor: adminColors.primaryTint },
          },
        },
        {
          props: { variant: 'outlined', color: 'error' },
          style: { borderColor: adminColors.danger },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: ADMIN_MIN_TOUCH_TARGET,
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          borderRadius: adminRadii.control,
          '&.Mui-focusVisible': { outline: focusRing, outlineOffset: 2 },
        },
        sizeSmall: { minWidth: 36, minHeight: 36 },
      },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: {
        root: { color: adminColors.accent, fontWeight: 600 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: adminColors.border },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: adminRadii.card,
          border: `1px solid ${adminColors.border}`,
          // Borders first, no shadow: cards are quiet on the ivory ground.
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6,
        },
        sizeSmall: { height: 24, fontSize: '0.75rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: adminRadii.control,
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          backgroundColor: adminColors.surface,
          // Hover darkens the edge; focus thickens it in gold. Both are
          // changes of colour AND weight, never colour alone.
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: adminColors.ink,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: adminColors.accent,
            borderWidth: 2,
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: adminColors.danger,
          },
          '&.Mui-disabled': { backgroundColor: adminColors.disabledSurface },
        },
        notchedOutline: { borderColor: adminColors.borderStrong },
        input: {
          // The default MUI placeholder is 42% opaque black, which
          // measures about 2.9:1 -- under the AA minimum. `inkSubtle` is
          // the token tuned to stay above 4.5:1 while still reading as a
          // placeholder.
          '&::placeholder': { color: adminColors.inkSubtle, opacity: 1 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: adminColors.inkMuted,
          '&.Mui-focused': { color: adminColors.accent },
          '&.Mui-error': { color: adminColors.danger },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        // MUI indents helper text 14px under an outlined input to line up
        // with the label; flush-left reads cleaner under a full-width field.
        root: { marginLeft: 0, marginRight: 0, marginTop: 6 },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: { color: adminColors.borderStrong },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: { color: adminColors.borderStrong },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: adminColors.borderStrong, opacity: 1 },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: adminRadii.card,
          boxShadow: adminShadows.menu,
          border: `1px solid ${adminColors.border}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 40,
          '&.Mui-selected': {
            backgroundColor: adminColors.primaryTint,
            fontWeight: 600,
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: { root: { overflowX: 'auto' } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${adminColors.border}`,
          paddingBlock: 14,
          paddingInline: 16,
        },
        head: {
          backgroundColor: adminColors.surfaceRaised,
          color: adminColors.inkMuted,
          fontWeight: 700,
          fontSize: '0.6875rem',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          paddingBlock: 10,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 0 },
        },
        hover: {
          '&:hover': { backgroundColor: 'rgba(15, 27, 48, 0.03)' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: adminRadii.card,
          boxShadow: adminShadows.floating,
          // Never wider than the viewport minus a gutter on a phone.
          margin: 16,
          width: 'calc(100% - 32px)',
          maxWidth: 560,
        },
      },
    },
    MuiDialogTitle: {
      defaultProps: { variant: 'h4' as const },
      styleOverrides: { root: { paddingBottom: 8 } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '8px 24px 20px', gap: 4 } },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          borderBottom: `1px solid ${adminColors.border}`,
        },
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          backgroundColor: adminColors.goldBase,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: ADMIN_MIN_TOUCH_TARGET,
          textTransform: 'none',
          fontWeight: 600,
          color: adminColors.inkMuted,
          '&.Mui-selected': { color: adminColors.ink },
          '&.Mui-focusVisible': { outline: focusRing, outlineOffset: -2 },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderColor: adminColors.borderStrong,
          color: adminColors.inkMuted,
          '&.Mui-selected': {
            backgroundColor: adminColors.primaryTint,
            color: adminColors.primary,
            '&:hover': { backgroundColor: adminColors.primaryTint },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: adminRadii.control, alignItems: 'center' },
      },
      // Each severity is its status colour on its tint, with a hairline
      // edge in the same colour: a banner is never a colour alone.
      variants: [
        {
          props: { severity: 'success', variant: 'standard' },
          style: {
            backgroundColor: adminColors.successTint,
            color: adminColors.success,
            border: `1px solid ${adminColors.success}33`,
          },
        },
        {
          props: { severity: 'warning', variant: 'standard' },
          style: {
            backgroundColor: adminColors.warningTint,
            color: adminColors.warning,
            border: `1px solid ${adminColors.warning}33`,
          },
        },
        {
          props: { severity: 'error', variant: 'standard' },
          style: {
            backgroundColor: adminColors.dangerTint,
            color: adminColors.danger,
            border: `1px solid ${adminColors.danger}33`,
          },
        },
        {
          props: { severity: 'info', variant: 'standard' },
          style: {
            backgroundColor: adminColors.infoTint,
            color: adminColors.info,
            border: `1px solid ${adminColors.info}33`,
          },
        },
      ],
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: adminColors.primary,
          color: adminColors.sidebarText,
          borderRadius: adminRadii.control,
          boxShadow: adminShadows.floating,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: 3,
          backgroundColor: adminColors.surfaceSunken,
        },
        bar: { borderRadius: 3, backgroundColor: adminColors.goldBase },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: adminColors.border } },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: adminColors.surfaceSunken },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        root: { fontSize: '0.8125rem', color: adminColors.inkMuted },
        separator: { color: adminColors.inkSubtle },
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
