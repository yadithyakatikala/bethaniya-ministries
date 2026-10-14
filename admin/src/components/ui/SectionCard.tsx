import { useId, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Paper, Typography } from '@mui/material';
import { adminColors, adminRadii } from '../../theme/tokens';

/**
 * A titled block on a page: a white card on the ivory ground, a serif
 * heading, an optional sentence under it, and optionally one link or one
 * action on the right of the heading.
 *
 * It is the one card the dashboard's panels, the Verse of the Day's tabs and
 * the Prophet verse's "showing now" box all use. Before, each of them wrote
 * its own `Paper` with its own radius (some three times the card radius) and
 * its own heading size, so the same kind of block looked different from page
 * to page.
 *
 * It is a labelled `<section>`: the heading names the region, so a screen
 * reader can jump between them. `accent` adds the gold bar down the left
 * edge, kept for the one card on a page that answers the question the page
 * exists for ("what is showing now").
 */
export function SectionCard({
  title,
  description,
  testId,
  link,
  action,
  accent = false,
  children,
}: {
  title: string;
  /** One or two sentences under the heading. */
  description?: ReactNode;
  testId?: string;
  /** Where "see all" goes. */
  link?: { to: string; label: string };
  /** A control for the right of the heading (a button). */
  action?: ReactNode;
  accent?: boolean;
  children?: ReactNode;
}) {
  const generated = useId();
  const titleId = `${testId ?? generated}-title`;
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby={titleId}
      data-testid={testId}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: `${adminRadii.card}px`,
        bgcolor: adminColors.surface,
        borderColor: adminColors.border,
        ...(accent ? { borderLeft: `4px solid ${adminColors.goldBase}` } : null),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: description ? 0.5 : 1.5,
        }}
      >
        <Typography id={titleId} variant="h5" component="h2">
          {title}
        </Typography>
        {link ? (
          <Link
            component={RouterLink}
            to={link.to}
            underline="hover"
            sx={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            {link.label}
          </Link>
        ) : null}
        {action ?? null}
      </Box>
      {description ? (
        <Typography
          variant="body2"
          component="div"
          sx={{ color: adminColors.inkMuted, mb: 2, maxWidth: 680 }}
        >
          {description}
        </Typography>
      ) : null}
      {children}
    </Paper>
  );
}
