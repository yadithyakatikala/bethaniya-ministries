import { Box, Skeleton } from '@mui/material';

/**
 * Placeholder rows shown while a list loads, in the shape of the list.
 * A skeleton tells the reader what is coming and keeps the page from
 * jumping when it arrives; a lone spinner does neither.
 *
 * Marked `aria-busy` with a text alternative so a screen reader hears that
 * content is loading rather than an empty region.
 */
export function TableSkeleton({
  rows = 5,
  testId = 'table-skeleton',
  label = 'Loading',
}: {
  rows?: number;
  testId?: string;
  label?: string;
}) {
  return (
    <Box
      data-testid={testId}
      role="status"
      aria-busy="true"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={52} animation="wave" />
      ))}
    </Box>
  );
}
