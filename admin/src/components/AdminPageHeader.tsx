import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Shared page-header row (title + optional primary action) -- the same
 * `<Box sx={{display:'flex', justifyContent:'space-between', ...}}>` +
 * `<Typography variant="h5">` markup was duplicated, pixel-for-pixel,
 * across AnnouncementsListPage, SongsListPage, DailyVersesListPage,
 * EventsListPage, NotificationsPage, SettingsPage, and UsersPage.
 */
export function AdminPageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        mb: 3,
      }}
    >
      <Typography variant="h5" component="h1">
        {title}
      </Typography>
      {action}
    </Box>
  );
}
