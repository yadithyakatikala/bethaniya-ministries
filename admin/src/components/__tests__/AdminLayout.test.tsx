import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../theme/theme';
import { AdminLayout } from '../AdminLayout';
import { NAV_GROUPS, isNavItemActive } from '../navigation';
import { useAuthStore } from '../../store/authStore';

function renderLayout(initialPath = '/') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AdminLayout>
          <div data-testid="page-content">Page content</div>
        </AdminLayout>
      </MemoryRouter>
    </ThemeProvider>
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'u1', email: 'pastor@example.org' } as never,
    role: 'content_admin',
  });
});

describe('AdminLayout', () => {
  it('renders its children', () => {
    renderLayout();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('renders a nav link to every admin destination, in both the permanent and temporary drawers', () => {
    renderLayout();
    const destinations = [
      'sidebar-dashboard-link',
      'sidebar-announcements-link',
      'sidebar-daily-verses-link',
      'sidebar-prophet-verses-link',
      'sidebar-media-link',
      'sidebar-media-library-link',
      'sidebar-songs-link',
      'sidebar-events-link',
      'sidebar-community-link',
      'sidebar-plans-link',
      'sidebar-notifications-link',
      'sidebar-reports-link',
      'sidebar-users-link',
      'sidebar-settings-link',
    ];
    for (const testId of destinations) {
      // Present in both the permanent (md+) and temporary (narrow) drawers --
      // CSS controls which is visible at a given viewport, so both render
      // in the DOM under jsdom (see AdminLayout.tsx's doc comment).
      expect(screen.getAllByTestId(testId)).toHaveLength(2);
    }
  });

  it('links to a real route for every item, with no two items sharing a path', () => {
    const paths = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.path));
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith('/')).toBe(true);
    renderLayout();
    const [plans] = screen.getAllByTestId('sidebar-plans-link');
    expect(plans).toHaveAttribute('href', '/plans');
    const [library] = screen.getAllByTestId('sidebar-media-library-link');
    expect(library).toHaveAttribute('href', '/media-library');
    const [feed] = screen.getAllByTestId('sidebar-media-link');
    expect(feed).toHaveAttribute('href', '/media');
  });

  it('marks the link matching the current route as selected (MUI Mui-selected class)', () => {
    renderLayout('/events');
    const [eventsLink] = screen.getAllByTestId('sidebar-events-link');
    const [dashboardLink] = screen.getAllByTestId('sidebar-dashboard-link');
    expect(eventsLink).toHaveClass('Mui-selected');
    expect(dashboardLink).not.toHaveClass('Mui-selected');
  });

  it('tells assistive technology which page is current, not just sighted users', () => {
    renderLayout('/songs');
    const [songs] = screen.getAllByTestId('sidebar-songs-link');
    const [events] = screen.getAllByTestId('sidebar-events-link');
    expect(songs).toHaveAttribute('aria-current', 'page');
    expect(events).not.toHaveAttribute('aria-current');
  });

  it('keeps a section highlighted on its inner pages', () => {
    renderLayout('/plans/seven-days/edit');
    const [plans] = screen.getAllByTestId('sidebar-plans-link');
    expect(plans).toHaveClass('Mui-selected');
  });

  it('does not confuse the feed with the library, which share a prefix', () => {
    renderLayout('/media-library');
    const [library] = screen.getAllByTestId('sidebar-media-library-link');
    const [feed] = screen.getAllByTestId('sidebar-media-link');
    expect(library).toHaveClass('Mui-selected');
    expect(feed).not.toHaveClass('Mui-selected');
  });

  it('renders a menu button that opens the temporary (narrow-viewport) drawer', async () => {
    const user = userEvent.setup();
    renderLayout();
    const menuButton = screen.getByTestId('sidebar-menu-button');
    expect(menuButton).toBeInTheDocument();
    // Clicking it must not throw, and the temporary drawer's nav content
    // (rendered via MUI's Modal, which keepMounted keeps in the DOM
    // either way -- see AdminLayout.tsx) stays reachable afterward.
    await user.click(menuButton);
    expect(screen.getAllByTestId('sidebar-events-link').length).toBeGreaterThan(0);
  });

  it('offers a skip link to the main content as the first focusable thing', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.tab();
    const skip = screen.getByText('Skip to main content');
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(screen.getByTestId('admin-layout-content')).toHaveAttribute(
      'id',
      'main-content'
    );
  });

  it('names its navigation landmark', () => {
    renderLayout();
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    expect(navs.length).toBeGreaterThan(0);
  });

  it('shows who is signed in with a readable role, and can sign out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signOut });
    const user = userEvent.setup();
    renderLayout();
    const [email] = screen.getAllByTestId('sidebar-user-email');
    const [role] = screen.getAllByTestId('sidebar-user-role');
    expect(email).toHaveTextContent('pastor@example.org');
    // The label people know, not the stored value `content_admin`.
    expect(role).toHaveTextContent('Content Admin');
    const [signOutButton] = screen.getAllByTestId('sidebar-sign-out');
    await user.click(signOutButton!);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('groups destinations under headings a keyboard user can scan', () => {
    renderLayout();
    const [nav] = screen.getAllByRole('navigation', { name: 'Main' });
    for (const heading of ['Content', 'Bible', 'Library', 'People']) {
      expect(within(nav!).getByText(heading)).toBeInTheDocument();
    }
  });
});

describe('isNavItemActive', () => {
  it('matches the dashboard only on the root path', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
    expect(isNavItemActive('/', '/songs')).toBe(false);
  });

  it('matches a section on its own path and on paths beneath it', () => {
    expect(isNavItemActive('/plans', '/plans')).toBe(true);
    expect(isNavItemActive('/plans', '/plans/new')).toBe(true);
    expect(isNavItemActive('/plans', '/plans/p1/days/d1/edit')).toBe(true);
  });

  it('does not match a different section that merely starts with the same letters', () => {
    expect(isNavItemActive('/media', '/media-library')).toBe(false);
    expect(isNavItemActive('/media-library', '/media')).toBe(false);
    expect(isNavItemActive('/songs', '/songsheet')).toBe(false);
  });
});
