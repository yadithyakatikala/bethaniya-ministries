import { createTheme } from '@mui/material/styles';

/**
 * Base MUI theme (Day 1 placeholder).
 * Real church branding (primary/secondary colors, logo) gets wired in once
 * provided — see FINAL_ARCHITECTURE_SPECIFICATION.md Section F ("Content & Branding").
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563EB' },
    secondary: { main: '#7C3AED' },
  },
});
