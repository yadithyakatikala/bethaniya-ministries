import { useState, type ReactNode } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const DRAWER_WIDTH = 250;

/**
 * Shared admin dashboard shell -- Day 13's "Refinement: Sidebar
 * navigation, responsive layout" plan item
 * (FINAL_ARCHITECTURE_SPECIFICATION.md's Day 13 section). Before this,
 * only DashboardPage.tsx had any navigation links at all (a plain button
 * row), and no other admin page linked anywhere; every other page was
 * only reachable by typing its URL directly or coming from
 * DashboardPage. This wraps every authenticated route in App.tsx with
 * one persistent, always-current navigation surface instead.
 *
 * Purely additive: no existing page component's own internals, tests,
 * or data-testids change -- App.tsx wraps each route's element in this
 * layout (see that file), and DashboardPage.tsx's redundant button row
 * (now duplicating this sidebar's own links) is removed there as the
 * same Day 13 "Admin dashboard polished" refinement, but every other
 * page (AnnouncementsListPage, EventsListPage, etc.) is completely
 * untouched.
 *
 * Restyled for the approved "Vespers" direction (see the UI audit and
 * its visual prototype) -- a branded dark-evergreen sidebar with the
 * signed-in user/role at the bottom, in place of the plain MUI default
 * drawer. The responsive-drawer mechanism itself (two CSS-only-visible
 * Drawers -- see the original doc comment below) and every nav
 * link/testid are unchanged, so AdminLayout.test.tsx's assertions still
 * hold.
 *
 * Responsive via MUI's own documented "responsive drawer" recipe --
 * https://mui.com/material-ui/react-drawer/#responsive-drawer -- two
 * Drawers whose visibility is controlled purely by each one's own
 * `sx.display` breakpoint object (CSS media queries), not
 * useMediaQuery()/window.matchMedia(). jsdom (this project's test
 * environment) does not implement matchMedia by default, and using
 * useMediaQuery would have required a new polyfill in
 * admin/src/test/setup.ts just to keep App.test.tsx (which renders the
 * full app, including this layout) from crashing -- the CSS-only
 * approach avoids that entirely while producing the identical visual
 * result: a permanent drawer at the `sm` breakpoint and up, a
 * hamburger-triggered temporary drawer below it.
 */
const NAV_ITEMS: { label: string; path: string; testId: string }[] = [
  { label: 'Dashboard', path: '/', testId: 'sidebar-dashboard-link' },
  {
    label: 'Announcements',
    path: '/announcements',
    testId: 'sidebar-announcements-link',
  },
  { label: 'Daily Verses', path: '/daily-verses', testId: 'sidebar-daily-verses-link' },
  { label: 'Songs', path: '/songs', testId: 'sidebar-songs-link' },
  { label: 'Events', path: '/events', testId: 'sidebar-events-link' },
  { label: 'Community', path: '/community', testId: 'sidebar-community-link' },
  { label: 'Plans', path: '/plans', testId: 'sidebar-plans-link' },
  {
    label: 'Notifications',
    path: '/notifications',
    testId: 'sidebar-notifications-link',
  },
  { label: 'Users', path: '/users', testId: 'sidebar-users-link' },
  { label: 'Settings', path: '/settings', testId: 'sidebar-settings-link' },
];

const SIDEBAR_BG = '#1F2A25';
const SIDEBAR_BORDER = '#31403A';
const SIDEBAR_TEXT_MUTED = '#9AA8A1';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: SIDEBAR_BG,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 2.5 }}>
        <Avatar
          sx={{
            bgcolor: '#8FC0AC',
            color: '#132018',
            fontWeight: 700,
            width: 34,
            height: 34,
          }}
        >
          B
        </Avatar>
        <Typography
          sx={{ color: '#fff', fontFamily: 'Newsreader, serif', fontWeight: 600 }}
        >
          Bethaniya Admin
        </Typography>
      </Box>
      <Divider sx={{ borderColor: SIDEBAR_BORDER }} />
      <List sx={{ px: 1.5, py: 1.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={location.pathname === item.path}
            data-testid={item.testId}
            onClick={onNavigate}
            sx={{
              borderRadius: 2,
              mb: 0.25,
              color: SIDEBAR_TEXT_MUTED,
              '&.Mui-selected': {
                bgcolor: '#2E5347',
                color: '#fff',
                '&:hover': { bgcolor: '#2E5347' },
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <ListItemText
              primary={
                <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>
                  {item.label}
                </Typography>
              }
            />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ borderColor: SIDEBAR_BORDER }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 2 }}>
        <Avatar
          sx={{
            bgcolor: '#8FC0AC',
            color: '#132018',
            fontWeight: 700,
            width: 30,
            height: 30,
            fontSize: 13,
          }}
        >
          {(user?.email ?? 'A').charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
            {user?.email ?? 'Signed in'}
          </Typography>
          <Typography sx={{ color: SIDEBAR_TEXT_MUTED, fontSize: 11.5 }}>
            {role ?? 'Role pending'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          display: { xs: 'block', sm: 'none' },
          bgcolor: SIDEBAR_BG,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            data-testid="sidebar-menu-button"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, fontFamily: 'Newsreader, serif' }}>
            Bethaniya Admin
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Narrow viewports only -- see doc comment above for why this is
          CSS-only visibility, not useMediaQuery. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, border: 'none' },
        }}
        data-testid="sidebar-temporary-drawer"
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      {/* `sm` breakpoint and up. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
          },
        }}
        data-testid="sidebar-permanent-drawer"
      >
        <SidebarContent />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, sm: 0 },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
        data-testid="admin-layout-content"
      >
        {children}
      </Box>
    </Box>
  );
}
