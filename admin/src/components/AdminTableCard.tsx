import type { ReactNode } from 'react';
import { Paper } from '@mui/material';
import { adminRadii } from '../theme/tokens';

/**
 * Bordered card wrapper for admin data tables: a white surface with a
 * hairline edge and the card radius, clipping its table so the header
 * band's corners follow the card's. The table inside scrolls sideways on
 * its own `TableContainer` on a narrow screen -- the page never does.
 */
export function AdminTableCard({ children }: { children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: `${adminRadii.card}px`, overflow: 'hidden' }}
    >
      {children}
    </Paper>
  );
}
