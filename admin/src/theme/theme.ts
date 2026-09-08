import { createTheme } from '@mui/material/styles';

/**
 * "Vespers" MUI theme -- from the approved UI audit/visual prototype
 * (Claude Design handoff, "Bethaniya Ministries -- UI audit & proposed
 * design system"). Replaces the Day 1 placeholder palette (`#2563EB`
 * blue, no branding) with the same tokens the mobile app's
 * `mobile/src/theme/tokens.ts` uses, so both surfaces read as one
 * brand. This is the only file most of the admin's visual delta comes
 * from -- every MUI component (buttons, chips, inputs, the table/card
 * borders and radii) already reads through `theme.palette`/`typography`/
 * `shape`, so nothing else needs to change for colors, type, and radii
 * to cascade everywhere.
 *
 * Light mode only for now -- the admin has no dark-mode preference
 * today (unlike the mobile app's `usePreferences().isDark`), so adding
 * one is out of scope for this pass.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2E5347',
      dark: '#24423A',
      light: '#E4EDE7',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#A96C33',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#B3261E',
    },
    warning: {
      main: '#A06A12',
    },
    success: {
      main: '#2F7A4F',
    },
    background: {
      default: '#FAF7F1',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1F2A25',
      secondary: '#56635C',
    },
    divider: '#E3DCCE',
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Archivo", system-ui, "Segoe UI", Roboto, sans-serif',
    h1: { fontFamily: '"Newsreader", serif', fontWeight: 500 },
    h2: { fontFamily: '"Newsreader", serif', fontWeight: 500 },
    h3: { fontFamily: '"Newsreader", serif', fontWeight: 500 },
    h4: { fontFamily: '"Newsreader", serif', fontWeight: 500 },
    h5: { fontFamily: '"Newsreader", serif', fontWeight: 500 },
    h6: { fontFamily: '"Newsreader", serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 40 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
