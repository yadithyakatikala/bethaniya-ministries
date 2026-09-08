import { Paper, Typography } from '@mui/material';

/**
 * Shared empty-state treatment for admin list pages -- replaces the bare,
 * unstyled `<Typography color="text.secondary">No X yet.</Typography>`
 * previously duplicated identically across every list page.
 */
export function AdminEmptyState({
  message,
  testId,
}: {
  message: string;
  testId: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 3, borderStyle: 'dashed', p: 4, textAlign: 'center' }}
      data-testid={testId}
    >
      <Typography color="text.secondary" sx={{ fontSize: 14 }}>
        {message}
      </Typography>
    </Paper>
  );
}
