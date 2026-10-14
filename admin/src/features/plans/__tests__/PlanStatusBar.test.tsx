import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { PlanStatusBar } from '../PlanStatusBar';
import type { PlanStatus } from '../../../types';

function setup(props: Partial<React.ComponentProps<typeof PlanStatusBar>> = {}) {
  const handlers = {
    onSave: vi.fn(),
    onPublish: vi.fn(),
    onSchedule: vi.fn(),
    onUnpublish: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  };
  render(
    <ThemeProvider theme={theme}>
      <PlanStatusBar
        status="draft"
        isNew={false}
        dirty={false}
        saving={false}
        uploading={false}
        readOnly={false}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  );
  return handlers;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('plan-more'));
}

describe('PlanStatusBar', () => {
  describe('what it says about the plan', () => {
    it('says a new plan is not saved yet', () => {
      setup({ isNew: true });
      expect(screen.getByTestId('plan-save-state')).toHaveTextContent('Not saved yet');
    });

    it.each([
      [{ dirty: false }, 'All changes saved'],
      [{ dirty: true }, 'Unsaved changes'],
      [{ dirty: true, saving: true }, 'Saving…'],
      [{ dirty: true, uploading: true }, 'Uploading…'],
    ])('with %o says "%s"', (props, text) => {
      setup(props);
      expect(screen.getByTestId('plan-save-state')).toHaveTextContent(text);
    });

    it.each<[PlanStatus, string]>([
      ['draft', 'Draft'],
      ['scheduled', 'Scheduled'],
      ['published', 'Published'],
      ['archived', 'Archived'],
    ])('names a %s plan', (status, label) => {
      setup({ status });
      expect(screen.getByTestId('plan-status-chip')).toHaveTextContent(label);
    });

    it('shows when a scheduled plan will appear', () => {
      setup({ status: 'scheduled', statusLabel: 'Scheduled · 1 Nov 2026, 06:00' });
      expect(screen.getByTestId('plan-status-chip')).toHaveTextContent(
        'Scheduled · 1 Nov 2026, 06:00'
      );
    });
  });

  describe('saving', () => {
    it('saves a draft, and says "Save changes" once members can see the plan', () => {
      setup({ status: 'draft', dirty: true });
      expect(screen.getByTestId('plan-save')).toHaveTextContent('Save draft');
    });

    it.each<PlanStatus>(['published', 'scheduled'])(
      'says "Save changes" for a %s plan',
      (status) => {
        setup({ status, dirty: true });
        expect(screen.getByTestId('plan-save')).toHaveTextContent('Save changes');
      }
    );

    it('has nothing to save while nothing has changed', () => {
      setup({ dirty: false });
      expect(screen.getByTestId('plan-save')).toBeDisabled();
    });

    it('can always save a plan that has never been saved', () => {
      setup({ isNew: true, dirty: false });
      expect(screen.getByTestId('plan-save')).toBeEnabled();
    });

    it('saves when asked', async () => {
      const user = userEvent.setup();
      const { onSave } = setup({ dirty: true });
      await user.click(screen.getByTestId('plan-save'));
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['saving', { saving: true }],
      ['uploading', { uploading: true }],
    ])('cannot save, publish or open the menu while %s', (_name, props) => {
      setup({ dirty: true, ...props });
      expect(screen.getByTestId('plan-save')).toBeDisabled();
      expect(screen.getByTestId('plan-publish')).toBeDisabled();
      expect(screen.getByTestId('plan-more')).toBeDisabled();
    });
  });

  describe('the main action follows the status', () => {
    it('offers Publish for a draft, and never Unpublish', async () => {
      const user = userEvent.setup();
      const { onPublish } = setup({ status: 'draft' });
      expect(screen.queryByTestId('plan-unpublish')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-publish')).toHaveTextContent('Publish…');
      await user.click(screen.getByTestId('plan-publish'));
      expect(onPublish).toHaveBeenCalledTimes(1);
    });

    it('offers Publish now for a scheduled plan', () => {
      setup({ status: 'scheduled' });
      expect(screen.getByTestId('plan-publish')).toHaveTextContent('Publish now…');
    });

    it('offers Unpublish for a published plan, and never Publish', async () => {
      const user = userEvent.setup();
      const { onUnpublish } = setup({ status: 'published' });
      expect(screen.queryByTestId('plan-publish')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('plan-unpublish'));
      expect(onUnpublish).toHaveBeenCalledTimes(1);
    });

    it('offers Restore for an archived plan, and neither Publish nor Unpublish', async () => {
      const user = userEvent.setup();
      const { onRestore } = setup({ status: 'archived' });
      expect(screen.queryByTestId('plan-publish')).not.toBeInTheDocument();
      expect(screen.queryByTestId('plan-unpublish')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('plan-restore'));
      expect(onRestore).toHaveBeenCalledTimes(1);
    });
  });

  describe('the menu', () => {
    it('offers Schedule, Archive, Duplicate and Delete for a saved draft', async () => {
      const user = userEvent.setup();
      const handlers = setup({ status: 'draft' });
      await openMenu(user);
      expect(screen.getByTestId('plan-menu-schedule')).toHaveTextContent('Schedule…');
      expect(screen.queryByTestId('plan-menu-unpublish')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('plan-menu-schedule'));
      expect(handlers.onSchedule).toHaveBeenCalledTimes(1);
    });

    it('lets a scheduled plan be rescheduled or the schedule cancelled', async () => {
      const user = userEvent.setup();
      const { onUnpublish } = setup({ status: 'scheduled' });
      await openMenu(user);
      expect(screen.getByTestId('plan-menu-schedule')).toHaveTextContent(
        'Change schedule…'
      );
      await user.click(screen.getByTestId('plan-menu-unpublish'));
      expect(onUnpublish).toHaveBeenCalledTimes(1);
    });

    it('does not offer scheduling for a published or archived plan', async () => {
      const user = userEvent.setup();
      setup({ status: 'published' });
      await openMenu(user);
      expect(screen.queryByTestId('plan-menu-schedule')).not.toBeInTheDocument();
      expect(screen.getByTestId('plan-menu-archive')).toBeInTheDocument();
    });

    it('does not offer archiving what is already archived', async () => {
      const user = userEvent.setup();
      setup({ status: 'archived' });
      await openMenu(user);
      expect(screen.queryByTestId('plan-menu-archive')).not.toBeInTheDocument();
      expect(screen.queryByTestId('plan-menu-schedule')).not.toBeInTheDocument();
    });

    it('archives, duplicates and deletes, closing the menu each time', async () => {
      const user = userEvent.setup();
      const { onArchive, onDuplicate, onDelete } = setup({ status: 'published' });
      await openMenu(user);
      await user.click(screen.getByTestId('plan-menu-archive'));
      await openMenu(user);
      await user.click(screen.getByTestId('plan-menu-duplicate'));
      await openMenu(user);
      await user.click(screen.getByTestId('plan-menu-delete'));
      expect(onArchive).toHaveBeenCalledTimes(1);
      expect(onDuplicate).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('cannot archive, duplicate or delete a plan that does not exist yet', async () => {
      const user = userEvent.setup();
      setup({ isNew: true });
      await openMenu(user);
      expect(screen.getByTestId('plan-menu-archive')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('plan-menu-duplicate')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('plan-menu-delete')).toHaveAttribute('aria-disabled', 'true');
    });

    it('will not copy a plan with unsaved changes, and says why', async () => {
      // A disabled item swallows clicks; the test clicks anyway to prove it.
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const { onDuplicate } = setup({ dirty: true });
      await openMenu(user);
      const item = screen.getByTestId('plan-menu-duplicate');
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Save your changes first');
      await user.click(item);
      expect(onDuplicate).not.toHaveBeenCalled();
    });
  });

  describe('for someone who cannot change plans', () => {
    it('explains instead of offering actions', () => {
      setup({ readOnly: true, status: 'published' });
      expect(screen.getByTestId('plan-read-only-note')).toHaveTextContent(
        'only a content administrator can change it'
      );
      for (const id of ['plan-save', 'plan-publish', 'plan-unpublish', 'plan-more', 'plan-restore']) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });
  });
});
