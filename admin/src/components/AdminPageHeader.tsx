import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { adminColors } from '../theme/tokens';

export interface Crumb {
  label: string;
  /** Omit on the last crumb: it is the current page. */
  to?: string;
}

/**
 * The header at the top of every admin page: an optional breadcrumb trail,
 * an optional eyebrow, the title in the serif, a short gold rule beneath
 * it, an optional sentence of explanation, and the page's primary actions
 * on the right (wrapping beneath on a narrow screen).
 *
 * The title is the page's only `<h1>`. `action` keeps its original name so
 * the seven pages that already passed it did not have to change; the new
 * props are all optional.
 *
 * The gold rule is the one place the brand metal appears in every page
 * header. It is 40 points wide, 3 tall and decorative (aria-hidden).
 */
export function AdminPageHeader({
  title,
  action,
  subtitle,
  eyebrow,
  breadcrumbs,
}: {
  title: string;
  action?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  breadcrumbs?: Crumb[];
}) {
  return (
    <Box component="header" sx={{ mb: { xs: 3, md: 4 } }}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs
          aria-label="Breadcrumb"
          sx={{ mb: 1.5 }}
          data-testid="page-breadcrumbs"
        >
          {breadcrumbs.map((crumb) =>
            crumb.to ? (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.to}
                underline="hover"
                sx={{ fontWeight: 500 }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography
                key={crumb.label}
                aria-current="page"
                sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}
              >
                {crumb.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {eyebrow ? (
            <Typography
              variant="overline"
              component="p"
              sx={{ color: adminColors.accent, m: 0, mb: 0.5 }}
            >
              {eyebrow}
            </Typography>
          ) : null}
          <Typography variant="h2" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          <Box
            aria-hidden
            sx={{
              width: 40,
              height: 3,
              mt: 1.25,
              borderRadius: 2,
              bgcolor: adminColors.goldBase,
            }}
          />
          {subtitle ? (
            <Typography
              color="text.secondary"
              sx={{ mt: 1.5, maxWidth: 680 }}
              data-testid="page-subtitle"
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action ? (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {action}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
