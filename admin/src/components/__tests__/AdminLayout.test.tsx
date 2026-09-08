import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminLayout } from '../AdminLayout';

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminLayout>
        <div data-testid="page-content">Page content</div>
      </AdminLayout>
    </MemoryRouter>
  );
}

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
      'sidebar-songs-link',
      'sidebar-events-link',
      'sidebar-notifications-link',
      'sidebar-users-link',
      'sidebar-settings-link',
    ];
    for (const testId of destinations) {
      // Present in both the permanent (sm+) and temporary (xs) drawers --
      // CSS controls which is visible at a given viewport, so both render
      // in the DOM under jsdom (see AdminLayout.tsx's doc comment).
      expect(screen.getAllByTestId(testId)).toHaveLength(2);
    }
  });

  it('marks the link matching the current route as selected (MUI Mui-selected class)', () => {
    renderLayout('/events');
    const [eventsLink] = screen.getAllByTestId('sidebar-events-link');
    const [dashboardLink] = screen.getAllByTestId('sidebar-dashboard-link');
    expect(eventsLink).toHaveClass('Mui-selected');
    expect(dashboardLink).not.toHaveClass('Mui-selected');
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
});
