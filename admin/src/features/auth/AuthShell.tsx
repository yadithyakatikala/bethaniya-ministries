import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { PRODUCT_NAME } from '../../theme/brand';
import { adminColors, adminFonts } from '../../theme/tokens';

/**
 * The frame around the sign-in and password-reset screens.
 *
 * On a wide screen it is two halves, the way the dashboard is: a navy half
 * that says whose site this is (the portrait with its ring of gold, the
 * name in the serif, a short gold rule) and an ivory half that holds the
 * form. On a phone the navy half becomes a band across the top and the form
 * sits beneath it, so the first thing on every screen size is the same
 * identity the person sees once they are inside.
 *
 * It carries no behaviour at all. Everything the page does -- the fields,
 * the errors, the reset flow -- stays in LoginPage.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'minmax(340px, 5fr) minmax(0, 6fr)',
        },
        gridTemplateRows: { xs: 'auto 1fr', md: '1fr' },
        bgcolor: adminColors.paper,
      }}
    >
      <Box
        component="header"
        sx={{
          bgcolor: adminColors.sidebarBg,
          color: adminColors.sidebarText,
          px: { xs: 2, sm: 4, md: 6 },
          py: { xs: 2, md: 6 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { md: 'center' },
          gap: { md: 3 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2.5 } }}>
          <Box
            component="img"
            src="/brand/maranatha-mark-192.jpg"
            alt=""
            sx={{
              width: { xs: 40, md: 88 },
              height: { xs: 40, md: 88 },
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              boxShadow: `0 0 0 2px ${adminColors.sidebarAccent}`,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="p"
              sx={{
                fontFamily: adminFonts.heading,
                fontWeight: 600,
                fontSize: { xs: '1.0625rem', md: '2rem' },
                lineHeight: 1.15,
                color: adminColors.sidebarText,
              }}
            >
              {PRODUCT_NAME}
            </Typography>
            <Typography
              variant="overline"
              component="p"
              sx={{ color: adminColors.sidebarAccent, m: 0, lineHeight: 1.4 }}
            >
              Admin
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box
            aria-hidden
            sx={{
              width: 40,
              height: 3,
              borderRadius: 2,
              bgcolor: adminColors.goldBright,
              mb: 2,
            }}
          />
          <Typography
            sx={{ color: adminColors.sidebarTextMuted, maxWidth: 360, lineHeight: 1.6 }}
          >
            Where the church team looks after what the congregation sees in the app.
          </Typography>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          display: 'grid',
          placeItems: { xs: 'start center', md: 'center' },
          px: { xs: 2, sm: 4 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>{children}</Box>
      </Box>
    </Box>
  );
}
