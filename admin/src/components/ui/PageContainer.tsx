import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { adminLayout } from '../../theme/tokens';

export type PageWidth = keyof typeof adminLayout.pageMaxWidth;

/**
 * The one wrapper every admin page sits in.
 *
 * Before this, 25 pages each wrote their own `<Box sx={{ p: 4 }}>` and
 * their own `maxWidth`, so the content edge moved from page to page and
 * nothing on a phone had a gutter smaller than 32px. Now the gutter,
 * the measure and the vertical rhythm are decided here, once:
 *
 *   narrow   forms and single-document editors (reads at ~75 characters)
 *   default  lists and settings
 *   wide     the dashboard and the day-by-day plan editor
 *
 * `testId` carries each page's existing data-testid, so the tests that
 * locate a page by it keep working.
 */
export function PageContainer({
  children,
  width = 'default',
  testId,
}: {
  children: ReactNode;
  width?: PageWidth;
  testId?: string;
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: adminLayout.pageMaxWidth[width],
        mx: 'auto',
        px: { xs: 2, sm: 3, md: 5 },
        py: { xs: 3, md: 4.5 },
      }}
    >
      {children}
    </Box>
  );
}
