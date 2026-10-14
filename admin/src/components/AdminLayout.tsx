import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '../theme/brand';
import { adminColors, adminFonts, adminLayout } from '../theme/tokens';
import { useAuthStore } from '../store/authStore';
import { useUnsavedChanges } from '../store/unsavedChangesStore';
import { ConfirmDialog } from './ui';
import { ROLE_LABELS } from '../types';
import { NAV_GROUPS, isNavItemActive } from './navigation';

const DRAWER_WIDTH = adminLayout.sidebarWidth;

function BrandLockup() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2.5 }}>
      <Box
        component="img"
        src="/brand/maranatha-mark-192.jpg"
        alt=""
        width={40}
        height={40}
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          objectFit: 'cover',
          // A thin ring of the brand gold: the metal, as a line.
          boxShadow: `0 0 0 1.5px ${adminColors.sidebarAccent}`,
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          sx={{
            fontFamily: adminFonts.heading,
            fontWeight: 600,
            fontSize: '1.0625rem',
            lineHeight: 1.2,
            color: adminColors.sidebarText,
          }}
        >
          {PRODUCT_NAME}
        </Typography>
        <Typography
          variant="overline"
          component="p"
          sx={{ color: adminColors.sidebarAccent, m: 0, lineHeight: 1.3 }}
        >
          Admin
        </Typography>
      </Box>
    </Box>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: adminColors.sidebarBg,
        color: adminColors.sidebarText,
      }}
    >
      <BrandLockup />

      <Box
        component="nav"
        aria-label="Main"
        sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2 }}
      >
        {NAV_GROUPS.map((group, index) => (
          <Box key={group.label ?? `group-${index}`} sx={{ mt: group.label ? 2 : 0 }}>
            {group.label ? (
              <Typography
                variant="overline"
                component="p"
                sx={{ color: adminColors.sidebarTextMuted, px: 1.5, pb: 0.5, m: 0 }}
              >
                {group.label}
              </Typography>
            ) : null}
            <List disablePadding>
              {group.items.map((item) => {
                const selected = isNavItemActive(item.path, location.pathname);
                return (
                  <ListItemButton
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    selected={selected}
                    aria-current={selected ? 'page' : undefined}
                    data-testid={item.testId}
                    onClick={onNavigate}
                    sx={{
                      position: 'relative',
                      borderRadius: 1,
                      mb: 0.25,
                      py: 0.875,
                      color: adminColors.sidebarTextMuted,
                      '&:hover': { bgcolor: adminColors.sidebarSelectedBg },
                      // The selected item is carried by a fill, a heavier
                      // label AND a gold marker on its left edge -- the
                      // fill alone is a difference too slight to rely on.
                      '&.Mui-selected': {
                        bgcolor: adminColors.sidebarSelectedBg,
                        color: adminColors.sidebarSelectedText,
                        '&:hover': { bgcolor: adminColors.sidebarSelectedBg },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 8,
                          bottom: 8,
                          width: 3,
                          borderRadius: '0 3px 3px 0',
                          bgcolor: adminColors.sidebarAccent,
                        },
                      },
                      '&.Mui-focusVisible': {
                        outline: `2px solid ${adminColors.sidebarAccent}`,
                        outlineOffset: -2,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }} aria-hidden>
                      <item.Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontSize: 13.5,
                            fontWeight: selected ? 700 : 500,
                            lineHeight: 1.3,
                          },
                        },
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          borderTop: `1px solid ${adminColors.sidebarBorder}`,
          px: 2,
          py: 1.75,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            sx={{
              bgcolor: adminColors.sidebarAvatarBg,
              color: adminColors.sidebarAvatarText,
              fontWeight: 700,
              width: 32,
              height: 32,
              fontSize: 14,
            }}
          >
            {(user?.email ?? 'A').charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              variant="subtitle2"
              sx={{ color: adminColors.sidebarText }}
              data-testid="sidebar-user-email"
            >
              {user?.email ?? 'Signed in'}
            </Typography>
            <Typography
              sx={{ color: adminColors.sidebarTextMuted, fontSize: 12 }}
              data-testid="sidebar-user-role"
            >
              {role ? ROLE_LABELS[role] : 'Role pending'}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          startIcon={<LogoutOutlined fontSize="small" />}
          onClick={() => void signOut()}
          data-testid="sidebar-sign-out"
          sx={{
            justifyContent: 'flex-start',
            color: adminColors.sidebarTextMuted,
            '&:hover': {
              bgcolor: adminColors.sidebarSelectedBg,
              color: adminColors.sidebarSelectedText,
            },
            '&.Mui-focusVisible': {
              outline: `2px solid ${adminColors.sidebarAccent}`,
            },
          }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );
}

/**
 * The admin shell: a navy navigation rail beside an ivory content area.
 *
 * Responsive via MUI's documented "responsive drawer" recipe --
 * https://mui.com/material-ui/react-drawer/#responsive-drawer -- two
 * Drawers whose visibility is controlled purely by each one's own
 * `sx.display` breakpoint object (CSS media queries), not
 * useMediaQuery()/window.matchMedia(). jsdom (this project's test
 * environment) does not implement matchMedia, and using useMediaQuery
 * would have needed a polyfill just to keep the full-app tests from
 * crashing; the CSS-only approach produces the identical result: a
 * permanent rail at the `md` breakpoint (900px) and up, a
 * hamburger-triggered temporary drawer below it. The breakpoint is `md`
 * rather than the old `sm` because a 264-point rail on a 600-900px tablet
 * left the content a few hundred points -- narrower than the table it was
 * there to show.
 *
 * Wraps every authenticated route (see App.tsx), so /login and the
 * "Access denied" state never show it. A "Skip to main content" link is
 * the first thing a keyboard reaches, so the rail's dozen links need not
 * be tabbed through on every page.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const unsavedMessage = useUnsavedChanges((state) => state.message);
  const clearUnsaved = useUnsavedChanges((state) => state.set);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // A page holding unsaved work (the reading-plan editor) publishes that
  // through the unsaved-changes store. While it does, following ANY in-app
  // link to another page -- the navigation rail, a breadcrumb, a "back"
  // link -- asks first. This runs in the capture phase, before the router's
  // own click handler, and only steps in for a plain left-click on a link to
  // another page of this app; a modified click (new tab) loses nothing here,
  // and a link to another site is covered by the browser's own prompt
  // (useUnsavedChangesGuard).
  function interceptLeavingClick(event: MouseEvent<HTMLElement>) {
    if (!unsavedMessage || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    const targetAttr = anchor.getAttribute('target');
    if (targetAttr && targetAttr !== '_self') return;
    const href = anchor.getAttribute('href') ?? '';
    // A link within the page ("Skip to main content") goes nowhere.
    if (href.startsWith('#')) return;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || url.pathname === location.pathname) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setPendingPath(`${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <Box sx={{ display: 'flex' }} onClickCapture={interceptLeavingClick}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: (t) => t.zIndex.tooltip + 1,
          bgcolor: adminColors.primary,
          color: adminColors.onPrimary,
          px: 2,
          py: 1,
          borderRadius: 1,
          fontWeight: 600,
          '&:focus': { left: 8 },
        }}
      >
        Skip to main content
      </Box>

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          display: { xs: 'block', md: 'none' },
          bgcolor: adminColors.sidebarBg,
          borderBottom: `1px solid ${adminColors.sidebarBorder}`,
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
          <Typography
            component="p"
            sx={{
              ml: 1.5,
              fontFamily: adminFonts.heading,
              fontWeight: 600,
              fontSize: '1.0625rem',
            }}
          >
            {PRODUCT_NAME}{' '}
            <Box component="span" sx={{ color: adminColors.sidebarAccent }}>
              Admin
            </Box>
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
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            border: 'none',
            bgcolor: adminColors.sidebarBg,
          },
        }}
        data-testid="sidebar-temporary-drawer"
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      {/* `md` breakpoint and up. */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            bgcolor: adminColors.sidebarBg,
          },
        }}
        data-testid="sidebar-permanent-drawer"
      >
        <SidebarContent />
      </Drawer>

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, md: 0 },
          minHeight: '100vh',
          bgcolor: 'background.default',
          '&:focus': { outline: 'none' },
        }}
        data-testid="admin-layout-content"
      >
        {children}
      </Box>

      <ConfirmDialog
        open={pendingPath !== null}
        title="Leave without saving?"
        confirmLabel="Leave"
        cancelLabel="Stay here"
        destructive
        onCancel={() => setPendingPath(null)}
        onConfirm={() => {
          const target = pendingPath;
          setPendingPath(null);
          setMobileOpen(false);
          clearUnsaved(null);
          if (target) navigate(target);
        }}
        confirmTestId="leave-confirm"
        cancelTestId="leave-stay"
      >
        {unsavedMessage ?? 'You have changes that have not been saved.'}
      </ConfirmDialog>
    </Box>
  );
}
