import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { theme } from '../../../theme/theme';
import { BIBLE_STRUCTURE } from '../../daily-verses/bibleStructure';
import { ScriptureReferenceField } from '../ScriptureReferenceField';
import type { ScriptureLanguage } from '../passages';

/** The field is controlled; this holds the text the way a form does. */
function Harness({
  initial = '',
  disabled = false,
  language,
  onChange,
}: {
  initial?: string;
  disabled?: boolean;
  language?: ScriptureLanguage;
  onChange?: (reference: string) => void;
}) {
  const [reference, setReference] = useState(initial);
  return (
    <ThemeProvider theme={theme}>
      <ScriptureReferenceField
        label="Scripture reference"
        value={reference}
        disabled={disabled}
        language={language}
        testId="ref"
        onChange={(next) => {
          setReference(next);
          onChange?.(next);
        }}
      />
    </ThemeProvider>
  );
}

const input = () => screen.getByTestId('ref');

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('ref-choose'));
  return screen.getByRole('dialog', { name: 'Choose a passage' });
}

async function pickBook(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  book: string
) {
  await user.click(within(dialog).getByRole('combobox', { name: /book/i }));
  await user.click(screen.getByRole('option', { name: book }));
}

describe('ScriptureReferenceField', () => {
  it('is still a text field: whatever is typed is kept as typed, and nothing is refused', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    // A paraphrase's own citation and a range are not "wrong" -- these
    // fields have always taken free text and old documents depend on it.
    await user.type(input(), 'Psalm 23:1-3 (my paraphrase)');
    expect(input()).toHaveValue('Psalm 23:1-3 (my paraphrase)');
    expect(onChange).toHaveBeenLastCalledWith('Psalm 23:1-3 (my paraphrase)');
    expect(input()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a saved reference exactly as it was saved', () => {
    render(<Harness initial="Isaiah 43:19" />);
    expect(input()).toHaveValue('Isaiah 43:19');
  });

  it('fills the field with the chosen passage, written the one canonical way, and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const dialog = await openPicker(user);
    await pickBook(user, dialog, 'John');
    await user.type(within(dialog).getByTestId('ref-picker-chapter'), '3');
    await user.type(within(dialog).getByTestId('ref-picker-from'), '16');
    await user.click(within(dialog).getByTestId('ref-picker-add'));

    expect(onChange).toHaveBeenLastCalledWith('John 3:16');
    expect(input()).toHaveValue('John 3:16');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Choose a passage' })
      ).not.toBeInTheDocument()
    );
  });

  it('replaces what was there, rather than adding to it', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Isaiah 43:19" />);
    const dialog = await openPicker(user);
    await pickBook(user, dialog, 'Romans');
    await user.type(within(dialog).getByTestId('ref-picker-chapter'), '8');
    await user.click(within(dialog).getByTestId('ref-picker-add'));
    expect(input()).toHaveValue('Romans 8');
  });

  it('only offers a passage that exists', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openPicker(user);
    const take = within(dialog).getByTestId('ref-picker-add');
    expect(take).toBeDisabled();
    await pickBook(user, dialog, 'Psalms');
    await user.type(within(dialog).getByTestId('ref-picker-chapter'), '151');
    expect(within(dialog).getByTestId('ref-picker-result')).toHaveTextContent(
      'Psalms has 150 chapters.'
    );
    expect(take).toBeDisabled();
  });

  it('calls the button what it does for a verse, not for a reading plan', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openPicker(user);
    expect(within(dialog).getByTestId('ref-picker-add')).toHaveTextContent(
      'Use this passage'
    );
  });

  it('leaves the field alone when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="Psalm 23" onChange={onChange} />);
    const dialog = await openPicker(user);
    await user.click(within(dialog).getByTestId('ref-picker-cancel'));
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue('Psalm 23');
  });

  it('lets the person choose English or Telugu book names, when the form has no language of its own', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const dialog = await openPicker(user);
    expect(within(dialog).getByTestId('ref-picker-language-en')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await user.click(within(dialog).getByTestId('ref-picker-language-te'));
    await user.click(within(dialog).getByRole('combobox', { name: /book/i }));
    const john = BIBLE_STRUCTURE.find((book) => book.id === 'john')!;
    await user.click(screen.getByRole('option', { name: john.nameTe }));
    await user.type(within(dialog).getByTestId('ref-picker-chapter'), '3');
    await user.click(within(dialog).getByTestId('ref-picker-add'));

    expect(onChange).toHaveBeenLastCalledWith(`${john.nameTe} 3`);
    expect(String(onChange.mock.calls.at(-1)![0])).not.toMatch(/John/);
  });

  it('does not offer the choice when the form fixes the language', async () => {
    const user = userEvent.setup();
    render(<Harness language="te" />);
    const dialog = await openPicker(user);
    expect(
      within(dialog).queryByTestId('ref-picker-language-en')
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByTestId('ref-picker-language-te')
    ).not.toBeInTheDocument();
  });

  it('is disabled with the field, so a read-only form cannot be changed through the picker', () => {
    render(<Harness initial="Psalm 23" disabled />);
    expect(input()).toBeDisabled();
    expect(screen.getByTestId('ref-choose')).toBeDisabled();
  });

  it('names the button for a screen reader', () => {
    render(<Harness />);
    expect(
      screen.getByRole('button', { name: 'Choose a passage from the Bible' })
    ).toBeInTheDocument();
  });
});
