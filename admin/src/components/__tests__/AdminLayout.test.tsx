import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../theme/theme';
import { AdminLayout } from '../AdminLayout';
import { NAV_GROUPS, isNavItemActive } from '../navigation';
import { useAuthStore } from '../../store/authStore';
import { useUnsavedChanges } from '../../store/unsavedChangesStore';

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
  useUnsavedChanges.setState({ message: null });
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

describe('AdminLayout: leaving a page that holds unsaved work', () => {
  const MESSAGE = 'This reading plan has changes that have not been saved.';

  function Where() {
    const { pathname, search } = useLocation();
    return <output data-testid="where">{`${pathname}${search}`}</output>;
  }

  /** The layout around a page with the kinds of link a real page has. */
  function renderEditorPage() {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/plans/p/edit']}>
          <AdminLayout>
            <Link to="/plans" data-testid="breadcrumb">
              Reading Plans
            </Link>
            <Link to="/plans/p/edit?tab=days" data-testid="same-page-link">
              Days
            </Link>
            <a
              href="https://example.org/elsewhere"
              data-testid="external-link"
              onClick={(event) => event.preventDefault()}
            >
              Elsewhere
            </a>
            <a
              href="/songs"
              target="_blank"
              data-testid="new-tab-link"
              onClick={(event) => event.preventDefault()}
            >
              Songs in a new tab
            </a>
          </AdminLayout>
          <Where />
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  const where = () => screen.getByTestId('where');
  const leaveDialog = () => screen.queryByRole('dialog', { name: 'Leave without saving?' });

  it('lets a rail link through at once when there is nothing unsaved', async () => {
    const user = userEvent.setup();
    renderEditorPage();
    await user.click(screen.getAllByTestId('sidebar-songs-link')[0]!);
    await waitFor(() => expect(where()).toHaveTextContent('/songs'));
    expect(leaveDialog()).not.toBeInTheDocument();
  });

  it('asks first when a rail link would leave unsaved work, and does not go yet', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getAllByTestId('sidebar-songs-link')[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Leave without saving?' });
    expect(dialog).toHaveTextContent(MESSAGE);
    expect(where()).toHaveTextContent('/plans/p/edit');
  });

  it('asks about a link inside the page too, such as the breadcrumb', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getByTestId('breadcrumb'));
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
    expect(where()).toHaveTextContent('/plans/p/edit');
  });

  it('asks about a link in the narrow-screen drawer as well', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getAllByTestId('sidebar-songs-link')[1]!);
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
  });

  it('stays put, and keeps the warning, when told to stay', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getByTestId('breadcrumb'));
    await user.click(await screen.findByTestId('leave-stay'));
    await waitFor(() => expect(leaveDialog()).not.toBeInTheDocument());
    expect(where()).toHaveTextContent('/plans/p/edit');
    expect(useUnsavedChanges.getState().message).toBe(MESSAGE);
  });

  it('goes where the link pointed, and drops the warning, when told to leave', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getAllByTestId('sidebar-songs-link')[0]!);
    await user.click(await screen.findByTestId('leave-confirm'));
    await waitFor(() => expect(where()).toHaveTextContent('/songs'));
    expect(useUnsavedChanges.getState().message).toBeNull();
    await waitFor(() => expect(leaveDialog()).not.toBeInTheDocument());
  });

  it('keeps the query string of the link it let through', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/plans/p/edit']}>
          <AdminLayout>
            <Link to="/plans/q/edit?tab=days" data-testid="other-plan">
              Other plan
            </Link>
          </AdminLayout>
          <Where />
        </MemoryRouter>
      </ThemeProvider>
    );
    await user.click(screen.getByTestId('other-plan'));
    await user.click(await screen.findByTestId('leave-confirm'));
    await waitFor(() => expect(where()).toHaveTextContent('/plans/q/edit?tab=days'));
  });

  it('does not ask about a link to the page already open', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getByTestId('same-page-link'));
    await waitFor(() => expect(where()).toHaveTextContent('/plans/p/edit?tab=days'));
    expect(leaveDialog()).not.toBeInTheDocument();
  });

  it('does not ask about the skip link', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getByText('Skip to main content'));
    expect(leaveDialog()).not.toBeInTheDocument();
  });

  it('leaves links to other sites and to new tabs to the browser', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getByTestId('external-link'));
    await user.click(screen.getByTestId('new-tab-link'));
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(where()).toHaveTextContent('/plans/p/edit');
  });

  it('does not stand in the way of a modified click, which opens a new tab', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.keyboard('{Control>}');
    await user.click(screen.getByTestId('breadcrumb'));
    await user.keyboard('{/Control}');
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(where()).toHaveTextContent('/plans/p/edit');
  });

  it('is not triggered by a click that is not on a link', async () => {
    const user = userEvent.setup();
    useUnsavedChanges.setState({ message: MESSAGE });
    renderEditorPage();
    await user.click(screen.getByTestId('admin-layout-content'));
    expect(leaveDialog()).not.toBeInTheDocument();
  });
});
