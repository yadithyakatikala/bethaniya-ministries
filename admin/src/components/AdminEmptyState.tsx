import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { adminColors, adminRadii } from '../theme/tokens';

/**
 * Shared empty-state treatment for admin list pages -- what a list says
 * when there is nothing in it yet. `message` and `testId` are the original
 * props; the rest are optional so a page can say more than "nothing here":
 * what the thing is for, and the one action that fills it.
 *
 * An empty state is not an error and does not look like one: dashed edge,
 * a quiet icon, plain words.
 */
export function AdminEmptyState({
  message,
  testId,
  title,
  icon,
  action,
}: {
  message: string;
  testId: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        border: `1px dashed ${adminColors.borderStrong}`,
        borderRadius: `${adminRadii.card}px`,
        bgcolor: adminColors.surface,
        px: 3,
        py: { xs: 4, sm: 6 },
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {icon ? (
        <Box
          aria-hidden
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: adminColors.accentTint,
            color: adminColors.accent,
            mb: 0.5,
          }}
        >
          {icon}
        </Box>
      ) : null}
      {title ? (
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
      ) : null}
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        {message}
      </Typography>
      {action ? <Box sx={{ mt: 1.5 }}>{action}</Box> : null}
    </Box>
  );
}
