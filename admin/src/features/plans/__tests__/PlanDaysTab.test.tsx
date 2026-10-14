import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { PlanDaysTab } from '../PlanDaysTab';
import { DAY_LIMITS, blankDay, type DayDraft } from '../planDays';

function day(key: string, title: string, passages = ['Psalm 23']): DayDraft {
  return { ...blankDay(key), title, passages };
}

const THREE = [day('a', 'First'), day('b', 'Second'), day('c', 'Third')];

function setup(props: Partial<React.ComponentProps<typeof PlanDaysTab>> = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onAddSeveral: vi.fn(),
    onOpen: vi.fn(),
    onMove: vi.fn(),
    onDuplicate: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <ThemeProvider theme={theme}>
      <PlanDaysTab
        days={THREE}
        selectedKey={null}
        live={false}
        readOnly={false}
        showErrors={false}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  );
  return handlers;
}

describe('PlanDaysTab', () => {
  it('invites the first day when there are none', async () => {
    const user = userEvent.setup();
    const { onAdd } = setup({ days: [] });
    const empty = screen.getByTestId('plan-days-empty');
    expect(empty).toHaveTextContent('No days yet');
    await user.click(within(empty).getByRole('button', { name: /Add the first day/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('lists the days in order, numbered by their place', () => {
    setup();
    expect(screen.getByRole('heading', { name: '3 days' })).toBeInTheDocument();
    expect(screen.getByTestId('plan-day-title-1')).toHaveTextContent('First');
    expect(screen.getByTestId('plan-day-title-2')).toHaveTextContent('Second');
    expect(screen.getByTestId('plan-day-title-3')).toHaveTextContent('Third');
    expect(screen.getByTestId('plan-day-row-2')).toHaveTextContent('Psalm 23');
  });

  it('says "1 day" for a single day', () => {
    setup({ days: [day('a', 'Only')] });
    expect(screen.getByRole('heading', { name: '1 day' })).toBeInTheDocument();
  });

  it('shows a day with nothing yet as untitled, without reading', () => {
    setup({ days: [blankDay('x')] });
    expect(screen.getByTestId('plan-day-title-1')).toHaveTextContent('Untitled day');
    expect(screen.getByTestId('plan-day-row-1')).toHaveTextContent('No reading yet');
  });

  describe('flagging days that need attention', () => {
    it('does not nag about a day that has simply not been started', () => {
      setup({ days: [blankDay('x')] });
      expect(screen.queryByTestId('plan-day-problem-1')).not.toBeInTheDocument();
    });

    it('flags a started day that is missing its reading', () => {
      setup({ days: [day('x', 'Half done', [''])] });
      expect(screen.getByTestId('plan-day-problem-1')).toHaveTextContent(
        'Needs attention'
      );
    });

    it('flags a day with a reading that does not exist', () => {
      setup({ days: [day('x', 'Bad reading', ['Psalm 151'])] });
      expect(screen.getByTestId('plan-day-problem-1')).toBeInTheDocument();
    });

    it('flags even an untouched day once a save has been attempted', () => {
      setup({ days: [blankDay('x')], showErrors: true });
      expect(screen.getByTestId('plan-day-problem-1')).toBeInTheDocument();
    });

    it('does not flag a complete day', () => {
      setup({ showErrors: true });
      expect(screen.queryByTestId('plan-day-problem-1')).not.toBeInTheDocument();
    });
  });

  describe('changing the order', () => {
    it('moves a day earlier or later', async () => {
      const user = userEvent.setup();
      const { onMove } = setup();
      await user.click(screen.getByTestId('plan-day-up-2'));
      await user.click(screen.getByTestId('plan-day-down-2'));
      expect(onMove).toHaveBeenNthCalledWith(1, 'b', 'up');
      expect(onMove).toHaveBeenNthCalledWith(2, 'b', 'down');
    });

    it('cannot move the first day earlier or the last day later', () => {
      setup();
      expect(screen.getByTestId('plan-day-up-1')).toBeDisabled();
      expect(screen.getByTestId('plan-day-down-3')).toBeDisabled();
      expect(screen.getByTestId('plan-day-down-1')).toBeEnabled();
      expect(screen.getByTestId('plan-day-up-3')).toBeEnabled();
    });
  });

  it('opens, duplicates and deletes by the day, not by its place', async () => {
    const user = userEvent.setup();
    const { onOpen, onDuplicate, onRemove } = setup();
    await user.click(screen.getByTestId('plan-day-open-3'));
    await user.click(screen.getByTestId('plan-day-duplicate-1'));
    await user.click(screen.getByTestId('plan-day-delete-2'));
    expect(onOpen).toHaveBeenCalledWith('c');
    expect(onDuplicate).toHaveBeenCalledWith('a');
    expect(onRemove).toHaveBeenCalledWith('b');
  });

  it('adds a day, or a week of blank ones', async () => {
    const user = userEvent.setup();
    const { onAdd, onAddSeveral } = setup();
    await user.click(screen.getByTestId('plan-add-day'));
    await user.click(screen.getByTestId('plan-add-seven-days'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAddSeveral).toHaveBeenCalledWith(7);
  });

  it('stops at the longest plan the editor offers', async () => {
    const user = userEvent.setup();
    const almost = Array.from({ length: DAY_LIMITS.maxDays - 3 }, (_, n) =>
      day(`d${n}`, `Day ${n + 1}`)
    );
    const { onAddSeveral } = setup({ days: almost });
    // Only the three that fit are added.
    await user.click(screen.getByTestId('plan-add-seven-days'));
    expect(onAddSeveral).toHaveBeenCalledWith(3);
  });

  it('offers no more days at the limit', () => {
    const full = Array.from({ length: DAY_LIMITS.maxDays }, (_, n) =>
      day(`d${n}`, `Day ${n + 1}`)
    );
    setup({ days: full });
    expect(screen.getByTestId('plan-add-day')).toBeDisabled();
    expect(screen.getByTestId('plan-add-seven-days')).toBeDisabled();
    expect(screen.getByTestId('plan-day-duplicate-1')).toBeDisabled();
  });

  it('warns that members are reading the plan, and why moving days matters', () => {
    setup({ live: true });
    expect(screen.getByTestId('plan-days-live-warning')).toHaveTextContent(
      /progress is saved by day number/
    );
  });

  it('has no warning for a plan members cannot see', () => {
    setup({ live: false });
    expect(screen.queryByTestId('plan-days-live-warning')).not.toBeInTheDocument();
  });

  it('lets a read-only reader look at days and nothing else', () => {
    setup({ readOnly: true });
    expect(screen.getByRole('button', { name: 'View day 1' })).toBeInTheDocument();
    for (const id of ['plan-add-day', 'plan-add-seven-days', 'plan-day-up-2', 'plan-day-down-2', 'plan-day-duplicate-2', 'plan-day-delete-2']) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
  });

  it('offers no way to add a first day to a read-only reader', () => {
    setup({ days: [], readOnly: true });
    expect(screen.queryByRole('button', { name: /Add the first day/ })).not.toBeInTheDocument();
  });
});
