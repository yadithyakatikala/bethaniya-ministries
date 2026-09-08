import { useState, type ReactNode } from 'react';
import {
  AppBar,
  Box,
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

const DRAWER_WIDTH = 240;

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
  {
    label: 'Notifications',
    path: '/notifications',
    testId: 'sidebar-notifications-link',
  },
  { label: 'Users', path: '/users', testId: 'sidebar-users-link' },
  { label: 'Settings', path: '/settings', testId: 'sidebar-settings-link' },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <List>
      {NAV_ITEMS.map((item) => (
        <ListItemButton
          key={item.path}
          component={RouterLink}
          to={item.path}
          selected={location.pathname === item.path}
          data-testid={item.testId}
          onClick={onNavigate}
        >
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, display: { xs: 'block', sm: 'none' } }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            data-testid="sidebar-menu-button"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
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
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
        data-testid="sidebar-temporary-drawer"
      >
        <NavList onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      {/* `sm` breakpoint and up. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        data-testid="sidebar-permanent-drawer"
      >
        <Toolbar />
        <NavList />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, sm: 0 },
        }}
        data-testid="admin-layout-content"
      >
        {children}
      </Box>
    </Box>
  );
}
