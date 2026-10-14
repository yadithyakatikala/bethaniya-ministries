import type { ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from '../theme/theme';
import { ToastProvider } from './ui';

/**
 * Everything every screen needs above the router: the design-system theme,
 * the baseline styles, and the toast queue.
 *
 * The toast queue sits ABOVE the router on purpose. A page that saves and
 * then navigates away ("Plan saved", then back to the list) raises its
 * toast just before its route unmounts; a provider inside the route would
 * be unmounted with it and the message would vanish unseen.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
