import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { PassageListField } from '../PassageListField';
import type { PlanLanguage } from '../../../types';

/** The field is controlled; this holds the list the way a day does. */
function Harness({
  initial = [''],
  language = 'en',
  disabled = false,
  showRequired = false,
  onChange,
}: {
  initial?: string[];
  language?: PlanLanguage;
  disabled?: boolean;
  showRequired?: boolean;
  onChange?: (passages: string[]) => void;
}) {
  const [passages, setPassages] = useState(initial);
  return (
    <ThemeProvider theme={theme}>
      <PassageListField
        passages={passages}
        language={language}
        disabled={disabled}
        showRequired={showRequired}
        testIdPrefix="day"
        onChange={(next) => {
          setPassages(next);
          onChange?.(next);
        }}
      />
    </ThemeProvider>
  );
}

const box = (index: number) => screen.getByTestId(`day-passage-${index}`);

describe('PassageListField', () => {
  it('starts with one empty box and says nothing is wrong yet', () => {
    render(<Harness />);
    expect(box(0)).toHaveValue('');
    expect(screen.queryByTestId('day-passages-problem')).not.toBeInTheDocument();
    // Nothing to remove, and nothing to add below an empty box.
    expect(screen.getByTestId('day-remove-passage-0')).toBeDisabled();
    expect(screen.getByTestId('day-add-passage')).toBeDisabled();
  });

  it('asks for a passage once a save or publish has been attempted', () => {
    render(<Harness showRequired />);
    expect(screen.getByTestId('day-passages-problem')).toHaveTextContent(
      'Add at least one passage.'
    );
  });

  it('shows how many verses a good passage is, and that the app can open it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(0), 'John 3:16-21');
    expect(screen.getByText('6 verses · opens in the app')).toBeInTheDocument();
    expect(box(0)).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('rewrites a good passage the one canonical way when the administrator leaves the box', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(box(0), 'psalm 23');
    await user.tab();
    expect(box(0)).toHaveValue('Psalm 23');
    expect(onChange).toHaveBeenLastCalledWith(['Psalm 23']);
  });

  it('says why a passage cannot be used, beside the box, and leaves it as typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(0), 'Psalm 151');
    await user.tab();
    expect(box(0)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Psalms has 150 chapters.')).toBeInTheDocument();
    expect(box(0)).toHaveValue('Psalm 151');
  });

  it('turns an abbreviation away instead of saving what the app cannot open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(box(0), 'Jn 3:16');
    expect(box(0)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/abbreviation/)).toBeInTheDocument();
  });

  it('adds and removes passages, keeping at least one box', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Psalm 23']} />);
    await user.click(screen.getByTestId('day-add-passage'));
    expect(box(1)).toHaveValue('');
    // A second box is not offered while one is still empty.
    expect(screen.getByTestId('day-add-passage')).toBeDisabled();

    await user.type(box(1), 'John 3:16');
    await user.click(screen.getByTestId('day-remove-passage-0'));
    expect(screen.queryByTestId('day-passage-1')).not.toBeInTheDocument();
    expect(box(0)).toHaveValue('John 3:16');

    // Removing the last one clears it rather than leaving no box at all.
    await user.click(screen.getByTestId('day-remove-passage-0'));
    expect(box(0)).toHaveValue('');
  });

  it('reports a list that is too long to store', () => {
    const long = Array.from({ length: 12 }, () => 'Deuteronomy 28:1-68');
    render(<Harness initial={long} />);
    expect(screen.getByTestId('day-passages-problem')).toHaveTextContent(
      /at most 200 characters/
    );
  });

  it('is disabled as a whole for a read-only reader', () => {
    render(<Harness initial={['Psalm 23']} disabled />);
    expect(box(0)).toBeDisabled();
    expect(screen.getByTestId('day-add-passage')).toBeDisabled();
    expect(screen.getByTestId('day-choose-passage')).toBeDisabled();
    expect(screen.getByTestId('day-remove-passage-0')).toBeDisabled();
  });

  describe('choosing from the Bible', () => {
    async function open(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByTestId('day-choose-passage'));
      return screen.getByRole('dialog', { name: 'Choose a passage' });
    }
    async function pick(
      user: ReturnType<typeof userEvent.setup>,
      dialog: HTMLElement,
      book: string
    ) {
      await user.click(within(dialog).getByRole('combobox', { name: /book/i }));
      await user.click(screen.getByRole('option', { name: book }));
    }

    it('offers a passage only once the book and chapter make a reading that exists', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const dialog = await open(user);
      const add = within(dialog).getByTestId('day-picker-add');
      expect(add).toBeDisabled();

      await pick(user, dialog, 'Psalms');
      expect(within(dialog).getByText('Psalms has 150 chapters.')).toBeInTheDocument();
      await user.type(within(dialog).getByTestId('day-picker-chapter'), '151');
      expect(within(dialog).getByTestId('day-picker-result')).toHaveTextContent(
        'Psalms has 150 chapters.'
      );
      expect(add).toBeDisabled();

      await user.clear(within(dialog).getByTestId('day-picker-chapter'));
      await user.type(within(dialog).getByTestId('day-picker-chapter'), '23');
      expect(within(dialog).getByTestId('day-picker-result')).toHaveTextContent(
        'Psalm 23 · 6 verses'
      );
      expect(add).toBeEnabled();
    });

    it('fills the empty box with the chosen passage and closes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const dialog = await open(user);
      await pick(user, dialog, 'John');
      await user.type(within(dialog).getByTestId('day-picker-chapter'), '3');
      await user.type(within(dialog).getByTestId('day-picker-from'), '16');
      await user.type(within(dialog).getByTestId('day-picker-to'), '21');
      await user.click(within(dialog).getByTestId('day-picker-add'));

      expect(onChange).toHaveBeenLastCalledWith(['John 3:16-21']);
      expect(box(0)).toHaveValue('John 3:16-21');
      // The dialog fades out, so it is gone a moment later, not instantly.
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Choose a passage' })
        ).not.toBeInTheDocument()
      );
    });

    it('adds below when every box already has a passage', async () => {
      const user = userEvent.setup();
      render(<Harness initial={['Psalm 23']} />);
      const dialog = await open(user);
      await pick(user, dialog, 'Romans');
      await user.type(within(dialog).getByTestId('day-picker-chapter'), '8');
      await user.click(within(dialog).getByTestId('day-picker-add'));
      expect(box(0)).toHaveValue('Psalm 23');
      expect(box(1)).toHaveValue('Romans 8');
    });

    it('does not allow a last verse until there is a first verse', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      const dialog = await open(user);
      await pick(user, dialog, 'John');
      await user.type(within(dialog).getByTestId('day-picker-chapter'), '3');
      // "To verse" stays unavailable until there is a first verse.
      expect(within(dialog).getByTestId('day-picker-to')).toBeDisabled();
    });

    it('lists books by their Telugu names, and keeps them in what it writes, for a Telugu plan', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness language="te" onChange={onChange} />);
      const dialog = await open(user);
      await user.click(within(dialog).getByRole('combobox', { name: /book/i }));
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(66);
      // The first book is Genesis; in Telugu it is not "Genesis".
      expect(options[0]).not.toHaveTextContent('Genesis');
      await user.click(options[0]!);
      await user.type(within(dialog).getByTestId('day-picker-chapter'), '1');
      await user.click(within(dialog).getByTestId('day-picker-add'));
      const written = onChange.mock.calls.at(-1)![0][0] as string;
      expect(written).toMatch(/ 1$/);
      expect(written).not.toMatch(/Genesis/);
    });

    it('can be cancelled without adding anything', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const dialog = await open(user);
      await user.click(within(dialog).getByTestId('day-picker-cancel'));
      expect(onChange).not.toHaveBeenCalled();
      expect(box(0)).toHaveValue('');
    });
  });
});
