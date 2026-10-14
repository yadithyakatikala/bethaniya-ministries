import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import type { ReactElement } from 'react';
import { theme } from '../../../theme/theme';
import { ToastProvider } from '../../../components/ui';
import { Where } from './Where';

/**
 * Renders under the app's theme, with toasts (so a "Saved" message can be
 * read) and a router (so navigation can be asserted through `location`).
 */
export function renderPlans(ui: ReactElement, path = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          {ui}
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
