import type { ReactNode } from 'react';
import { Paper } from '@mui/material';

/**
 * Bordered card wrapper for admin data tables -- gives every list page's
 * table the same outlined-card treatment DashboardPage.tsx's stat cards
 * and recent-activity panel already use (Paper variant="outlined",
 * borderRadius 3), instead of a bare <Table> sitting directly on the
 * page background with no edge at all.
 */
export function AdminTableCard({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      {children}
    </Paper>
  );
}
