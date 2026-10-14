import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { DayDrawer } from '../DayDrawer';
import { blankDay, type DayDraft } from '../planDays';

function day(overrides: Partial<DayDraft> = {}): DayDraft {
  return {
    ...blankDay('k1'),
    title: 'The Lord is my shepherd',
    passages: ['Psalm 23'],
    ...overrides,
  };
}

function setup(
  props: Partial<React.ComponentProps<typeof DayDrawer>> = {}
): {
  onChange: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  onPrevious: ReturnType<typeof vi.fn>;
  onNext: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onChange: vi.fn(),
    onClose: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  };
  render(
    <ThemeProvider theme={theme}>
      <DayDrawer
        open
        day={day()}
        dayNumber={2}
        dayCount={5}
        language="en"
        readOnly={false}
        showErrors={false}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  );
  return handlers;
}

describe('DayDrawer', () => {
  it('is not on screen when closed or when there is no day', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is not on screen without a day even if told to open', () => {
    setup({ day: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a dialog named for the day it is showing', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: /Day 2/ });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('of 5');
  });

  it('shows the day as it is', () => {
    setup({
      day: day({
        devotional: 'Rest in him.',
        reflectionQuestion: 'Where has he led you?',
        prayerPrompt: 'Thank him.',
        application: 'Call a friend.',
        notes: 'A psalm of David.',
      }),
    });
    expect(screen.getByTestId('day-title')).toHaveValue('The Lord is my shepherd');
    expect(screen.getByTestId('day-passage-0')).toHaveValue('Psalm 23');
    expect(screen.getByTestId('day-devotional')).toHaveValue('Rest in him.');
    expect(screen.getByTestId('day-reflection')).toHaveValue('Where has he led you?');
    expect(screen.getByTestId('day-prayer')).toHaveValue('Thank him.');
    expect(screen.getByTestId('day-application')).toHaveValue('Call a friend.');
    expect(screen.getByTestId('day-notes')).toHaveValue('A psalm of David.');
  });

  it.each([
    ['day-title', 'title'],
    ['day-devotional', 'devotional'],
    ['day-reflection', 'reflectionQuestion'],
    ['day-prayer', 'prayerPrompt'],
    ['day-application', 'application'],
    ['day-notes', 'notes'],
  ])('reports an edit to %s as a change to %s only', (testId, field) => {
    const { onChange } = setup();
    fireEvent.change(screen.getByTestId(testId), { target: { value: 'New words' } });
    expect(onChange).toHaveBeenCalledWith({ [field]: 'New words' });
  });

  it('reports a changed passage list', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByTestId('day-add-passage'));
    expect(onChange).toHaveBeenCalledWith({ passages: ['Psalm 23', ''] });
  });

  it('moves between days and closes', async () => {
    const user = userEvent.setup();
    const { onPrevious, onNext, onClose } = setup();
    await user.click(screen.getByTestId('day-drawer-previous'));
    await user.click(screen.getByTestId('day-drawer-next'));
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('day-drawer-done'));
    await user.click(screen.getByTestId('day-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no previous day before the first and no next after the last', () => {
    setup({ dayNumber: 1, dayCount: 1 });
    expect(screen.getByTestId('day-drawer-previous')).toBeDisabled();
    expect(screen.getByTestId('day-drawer-next')).toBeDisabled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  describe('what it says is wrong', () => {
    it('keeps quiet about a blank day until something is typed or a save is attempted', () => {
      setup({ day: blankDay('k') });
      expect(screen.getByTestId('day-title')).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('says the title is missing after a save attempt', () => {
      setup({ day: blankDay('k'), showErrors: true });
      expect(screen.getByTestId('day-title')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Give this day a title.')).toBeInTheDocument();
    });

    it('says when text is too long for the field, in words', () => {
      setup({ day: day({ reflectionQuestion: 'x'.repeat(1001) }) });
      expect(
        screen.getByText('The reflection question must be 1,000 characters or fewer.')
      ).toBeInTheDocument();
      expect(screen.getByTestId('day-reflection')).toHaveAttribute('aria-invalid', 'true');
    });

    it('counts characters against each limit', () => {
      setup({ day: day({ devotional: 'Rest.' }) });
      expect(screen.getByText(/5 \/ 5,000/)).toBeInTheDocument();
    });
  });

  it('is read-only for someone who cannot change the plan', () => {
    setup({ readOnly: true });
    for (const testId of [
      'day-title',
      'day-passage-0',
      'day-devotional',
      'day-reflection',
      'day-prayer',
      'day-application',
      'day-notes',
    ]) {
      expect(screen.getByTestId(testId)).toBeDisabled();
    }
    // They can still page through the days and close the drawer.
    expect(screen.getByTestId('day-drawer-next')).toBeEnabled();
    expect(screen.getByTestId('day-drawer-done')).toBeEnabled();
  });
});
