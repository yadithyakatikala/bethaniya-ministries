import type { ReactNode } from 'react';
import { Paper } from '@mui/material';
import { adminRadii } from '../theme/tokens';

/**
 * Bordered card wrapper for admin data tables: a white surface with a
 * hairline edge and the card radius, clipping its table so the header
 * band's corners follow the card's.
 *
 * ON A NARROW SCREEN THE TABLE SCROLLS, ITS COLUMNS DO NOT SHRINK. A table
 * left to fit a phone gives each column whatever is left over, and a column
 * of titles ends up a few characters wide, one letter to a line (the reading
 * plans list did exactly that). So the table has a floor -- 640 points unless
 * a page says otherwise -- and below that the card's own `TableContainer`
 * scrolls sideways while the page itself never does. The cut-off column on
 * the right edge is the cue that there is more to swipe to.
 *
 * Long words inside a cell should wrap with `overflow-wrap: break-word`, not
 * `anywhere`: `anywhere` lets the browser treat a single letter as the
 * narrowest the column may be, which hands it permission to crush the column
 * all over again.
 */
export function AdminTableCard({
  children,
  minTableWidth = 640,
}: {
  children: ReactNode;
  /** The narrowest the table may be before the card scrolls, in points. */
  minTableWidth?: number;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: `${adminRadii.card}px`,
        overflow: 'hidden',
        '& .MuiTable-root': { minWidth: minTableWidth },
      }}
    >
      {children}
    </Paper>
  );
}
