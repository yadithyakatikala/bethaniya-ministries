import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { PublishDialog } from '../PublishDialog';
import { defaultScheduleValue } from '../planStatus';
import type { ReadinessIssue } from '../planReadiness';

// 10:00 on a Wednesday, local time. The dialog's own clock is passed in.
const NOW = new Date(2026, 9, 14, 10, 0, 0);

const WARNING: ReadinessIssue = {
  id: 'cover',
  severity: 'warning',
  message: 'There is no cover image. The app will show a plain placeholder.',
  tab: 'details',
};
const DESCRIPTION: ReadinessIssue = {
  id: 'description',
  severity: 'error',
  message: 'Write a short description. It is what members read before they start.',
  tab: 'details',
};
const NO_DAYS: ReadinessIssue = {
  id: 'no-days',
  severity: 'error',
  message: 'Add at least one day. A plan with no days has nothing to read.',
  tab: 'days',
};

function setup(props: Partial<React.ComponentProps<typeof PublishDialog>> = {}) {
  const handlers = { onClose: vi.fn(), onConfirm: vi.fn(), onFix: vi.fn() };
  render(
    <ThemeProvider theme={theme}>
      <PublishDialog
        open
        mode="publish"
        planTitle="Seven Days in the Psalms"
        dayCount={7}
        issues={[]}
        busy={false}
        error={null}
        now={NOW}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  );
  return handlers;
}

describe('PublishDialog', () => {
  describe('publishing a plan that is ready', () => {
    it('says what is about to happen', () => {
      setup();
      expect(screen.getByRole('dialog', { name: 'Publish this plan?' })).toBeInTheDocument();
      expect(screen.getByTestId('publish-summary')).toHaveTextContent(
        'Seven Days in the Psalms (7 days) will appear in the plan library for every member as soon as you publish it.'
      );
    });

    it('says "1 day" for a one-day plan', () => {
      setup({ dayCount: 1 });
      expect(screen.getByTestId('publish-summary')).toHaveTextContent('(1 day)');
    });

    it('publishes only when asked', async () => {
      const user = userEvent.setup();
      const { onConfirm } = setup();
      expect(onConfirm).not.toHaveBeenCalled();
      await user.click(screen.getByTestId('publish-confirm'));
      expect(onConfirm).toHaveBeenCalledWith({ to: 'published' });
    });

    it('can be cancelled', async () => {
      const user = userEvent.setup();
      const { onClose, onConfirm } = setup();
      await user.click(screen.getByTestId('publish-cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('lists what is worth a look without blocking', async () => {
      const user = userEvent.setup();
      const { onConfirm } = setup({ issues: [WARNING] });
      expect(screen.getByTestId('publish-warnings')).toHaveTextContent(WARNING.message);
      await user.click(screen.getByTestId('publish-confirm'));
      expect(onConfirm).toHaveBeenCalledWith({ to: 'published' });
    });
  });

  describe('a plan that is not ready', () => {
    it('lists what is missing and offers no way to publish', () => {
      setup({ issues: [DESCRIPTION, NO_DAYS, WARNING] });
      expect(
        screen.getByRole('dialog', { name: 'Not ready to publish yet' })
      ).toBeInTheDocument();
      const blockers = screen.getByTestId('publish-blockers');
      expect(blockers).toHaveTextContent(DESCRIPTION.message);
      expect(blockers).toHaveTextContent(NO_DAYS.message);
      // A warning is not a blocker.
      expect(blockers).not.toHaveTextContent(WARNING.message);
      expect(screen.queryByTestId('publish-confirm')).not.toBeInTheDocument();
      expect(screen.getByTestId('publish-cancel')).toHaveTextContent('Close');
    });

    it('takes the administrator to each problem', async () => {
      const user = userEvent.setup();
      const { onFix } = setup({ issues: [DESCRIPTION, NO_DAYS] });
      await user.click(screen.getByTestId('publish-fix-no-days'));
      expect(onFix).toHaveBeenCalledWith(NO_DAYS);
      await user.click(screen.getByTestId('publish-fix-description'));
      expect(onFix).toHaveBeenLastCalledWith(DESCRIPTION);
    });

    it('speaks in the singular for one problem', () => {
      setup({ issues: [NO_DAYS] });
      expect(screen.getByText(/Fix this first/)).toBeInTheDocument();
    });
  });

  describe('scheduling', () => {
    const open = () => setup({ mode: 'schedule' });
    const timeInput = () => screen.getByTestId('publish-schedule-time') as HTMLInputElement;

    it('suggests tomorrow at six in the morning', () => {
      open();
      expect(screen.getByRole('dialog', { name: 'Schedule this plan?' })).toBeInTheDocument();
      expect(timeInput().value).toBe(defaultScheduleValue(NOW));
      expect(timeInput().value).toBe('2026-10-15T06:00');
    });

    it('names the time zone the time is in', () => {
      open();
      expect(screen.getByText(/Times are in your local time zone/)).toBeInTheDocument();
    });

    it('schedules for the chosen moment', async () => {
      const user = userEvent.setup();
      const { onConfirm } = open();
      fireEvent.change(timeInput(), { target: { value: '2026-11-01T09:30' } });
      await user.click(screen.getByTestId('publish-confirm'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      const change = onConfirm.mock.calls[0]![0];
      expect(change.to).toBe('scheduled');
      expect(change.publishAt).toEqual(new Date(2026, 10, 1, 9, 30));
    });

    it('refuses a time that has passed', async () => {
      // A disabled button swallows clicks; the test clicks anyway to prove it.
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const { onConfirm } = open();
      fireEvent.change(timeInput(), { target: { value: '2026-10-14T09:00' } });
      expect(screen.getByText(/Choose a time in the future/)).toBeInTheDocument();
      expect(screen.getByTestId('publish-confirm')).toBeDisabled();
      await user.click(screen.getByTestId('publish-confirm'));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('refuses the present moment exactly', () => {
      open();
      fireEvent.change(timeInput(), { target: { value: '2026-10-14T10:00' } });
      expect(screen.getByTestId('publish-confirm')).toBeDisabled();
    });

    it('refuses an empty time', () => {
      open();
      fireEvent.change(timeInput(), { target: { value: '' } });
      expect(screen.getByText(/Choose a date and time/)).toBeInTheDocument();
      expect(screen.getByTestId('publish-confirm')).toBeDisabled();
    });

    it('says when the time chosen is, in words', () => {
      open();
      expect(
        within(screen.getByRole('dialog')).getByText(/That is 15 Oct 2026/)
      ).toBeInTheDocument();
    });

    it('still lists what is missing instead of offering a time', () => {
      setup({ mode: 'schedule', issues: [NO_DAYS] });
      expect(screen.getByRole('dialog', { name: 'Not ready to schedule yet' })).toBeInTheDocument();
      expect(screen.queryByTestId('publish-schedule-time')).not.toBeInTheDocument();
    });
  });

  describe('while working, and when it fails', () => {
    it('cannot be confirmed or cancelled twice in a row', () => {
      setup({ busy: true });
      expect(screen.getByTestId('publish-confirm')).toBeDisabled();
      expect(screen.getByTestId('publish-confirm')).toHaveTextContent('Working…');
      expect(screen.getByTestId('publish-cancel')).toBeDisabled();
    });

    it('shows why it failed, in the dialog', () => {
      setup({ error: 'Could not save. Try again.' });
      expect(screen.getByTestId('publish-error')).toHaveTextContent('Could not save. Try again.');
    });
  });

  it('shows nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
