import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import { theme } from '../../../theme/theme';
import { AdminPageHeader } from '../../AdminPageHeader';
import { AdminEmptyState } from '../../AdminEmptyState';
import { AdminTableCard } from '../../AdminTableCard';
import {
  ConfirmDialog,
  DateTimeField,
  FormActions,
  FormCard,
  FormSection,
  PageContainer,
  SectionCard,
  StatusChip,
  TableSkeleton,
  ToastProvider,
  ToneChip,
  useToast,
  STATUS_LABELS,
  type PublicationStatus,
  type Tone,
} from '..';

function renderThemed(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StatusChip', () => {
  const statuses: PublicationStatus[] = [
    'draft',
    'scheduled',
    'published',
    'archived',
    'live',
  ];

  it.each(statuses)('says the word "%s" in text, not only in colour', (status) => {
    renderThemed(<StatusChip status={status} testId="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent(STATUS_LABELS[status]);
    expect(screen.getByTestId('chip')).toHaveAttribute('data-status', status);
  });

  it('marks its icon decorative so a screen reader hears the word once', () => {
    renderThemed(<StatusChip status="published" testId="chip" />);
    const icon = screen.getByTestId('chip').querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives every status a different icon, so shape also carries meaning', () => {
    const markup = new Set<string>();
    for (const status of statuses) {
      const { unmount, container } = renderThemed(<StatusChip status={status} />);
      markup.add(container.querySelector('svg path')?.getAttribute('d') ?? '');
      unmount();
    }
    expect(markup.size).toBe(statuses.length);
  });

  it('accepts a longer label without losing the status', () => {
    renderThemed(
      <StatusChip status="scheduled" label="Scheduled · Sun 9:00" testId="c" />
    );
    expect(screen.getByTestId('c')).toHaveTextContent('Scheduled · Sun 9:00');
    expect(screen.getByTestId('c')).toHaveAttribute('data-status', 'scheduled');
  });
});

describe('ToneChip', () => {
  const tones: Tone[] = [
    'neutral',
    'navy',
    'navyTint',
    'gold',
    'success',
    'warning',
    'danger',
    'info',
    'archived',
    'outlined',
  ];

  it.each(tones)('says its word in the %s tone', (tone) => {
    renderThemed(<ToneChip tone={tone} label="In rotation" testId="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent('In rotation');
    expect(screen.getByTestId('chip')).toHaveAttribute('data-tone', tone);
  });

  it('gives every tone its own look, so choosing one is a real choice', () => {
    const looks = new Set<string>();
    for (const tone of tones) {
      const { unmount } = renderThemed(<ToneChip tone={tone} label="x" testId="chip" />);
      const style = getComputedStyle(screen.getByTestId('chip'));
      looks.add(`${style.color}|${style.backgroundColor}`);
      unmount();
    }
    expect(looks.size).toBe(tones.length);
  });

  it('hides its icon from a screen reader so the word is heard once, and passes data attributes on', () => {
    renderThemed(
      <ToneChip
        tone="warning"
        label="Open"
        Icon={CheckCircleOutlined}
        testId="chip"
        data={{ status: 'open' }}
      />
    );
    expect(screen.getByTestId('chip').querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(screen.getByTestId('chip')).toHaveAttribute('data-status', 'open');
  });
});

describe('SectionCard', () => {
  it('is a labelled region named by its heading', () => {
    renderThemed(
      <SectionCard title="Today" testId="card">
        <p>Philippians 3:14</p>
      </SectionCard>
    );
    const region = screen.getByRole('region', { name: 'Today' });
    expect(region).toBe(screen.getByTestId('card'));
    expect(screen.getByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument();
    expect(region).toHaveTextContent('Philippians 3:14');
  });

  it('works without a test id, and two cards on one page keep their own names', () => {
    renderThemed(
      <>
        <SectionCard title="One" />
        <SectionCard title="Two" />
      </>
    );
    expect(screen.getByRole('region', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Two' })).toBeInTheDocument();
  });

  it('puts a sentence under the heading, a link and an action beside it', () => {
    renderThemed(
      <SectionCard
        title="Reading plans"
        description="Every plan, by status."
        link={{ to: '/plans', label: 'All plans' }}
        action={<button type="button">Refresh</button>}
      />
    );
    expect(screen.getByText('Every plan, by status.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All plans' })).toHaveAttribute(
      'href',
      '/plans'
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it("marks the one card that answers the page's question with a gold bar, and no other", () => {
    renderThemed(
      <>
        <SectionCard title="Plain" testId="plain" />
        <SectionCard title="Showing now" testId="accented" accent />
      </>
    );
    expect(getComputedStyle(screen.getByTestId('accented')).borderLeftWidth).toBe('4px');
    expect(getComputedStyle(screen.getByTestId('plain')).borderLeftWidth).not.toBe('4px');
  });
});

describe('ConfirmDialog', () => {
  function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderThemed(
      <ConfirmDialog
        open
        title="Delete day?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirmTestId="confirm"
        cancelTestId="cancel"
        {...props}
      >
        Day 3 will be removed.
      </ConfirmDialog>
    );
    return { onConfirm, onCancel };
  }

  it('is a labelled dialog naming what will happen', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Delete day?');
    expect(dialog).toHaveAccessibleDescription('Day 3 will be removed.');
  });

  it('confirms and cancels through their own buttons', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.click(screen.getByTestId('confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('treats Escape as Cancel', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('freezes both buttons, and ignores Escape, while the action runs', async () => {
    const user = userEvent.setup();
    const { onCancel } = setup({ busy: true });
    expect(screen.getByTestId('confirm')).toBeDisabled();
    expect(screen.getByTestId('cancel')).toBeDisabled();
    expect(screen.getByTestId('confirm')).toHaveTextContent('Working…');
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the danger colour for a destructive confirmation only', () => {
    setup({ destructive: true });
    expect(screen.getByTestId('confirm').className).toContain('colorError');
  });

  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Toast', () => {
  function Trigger({ text, severity }: { text: string; severity?: 'error' | 'success' }) {
    const { notify } = useToast();
    return <button onClick={() => notify({ message: text, severity })}>go {text}</button>;
  }

  it('shows a message and announces a success politely', async () => {
    const user = userEvent.setup();
    renderThemed(
      <ToastProvider>
        <Trigger text="Saved" severity="success" />
      </ToastProvider>
    );
    await user.click(screen.getByText('go Saved'));
    const toast = await screen.findByTestId('toast');
    expect(toast).toHaveTextContent('Saved');
    expect(toast).toHaveAttribute('role', 'status');
  });

  it('announces an error assertively', async () => {
    const user = userEvent.setup();
    renderThemed(
      <ToastProvider>
        <Trigger text="Failed" severity="error" />
      </ToastProvider>
    );
    await user.click(screen.getByText('go Failed'));
    expect(await screen.findByTestId('toast')).toHaveAttribute('role', 'alert');
  });

  it('shows queued messages one after another, in order', async () => {
    const user = userEvent.setup();
    renderThemed(
      <ToastProvider>
        <Trigger text="First" />
        <Trigger text="Second" />
      </ToastProvider>
    );
    await user.click(screen.getByText('go First'));
    await user.click(screen.getByText('go Second'));
    expect(await screen.findByTestId('toast')).toHaveTextContent('First');
    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Second'));
  });

  it('does not throw when used outside a provider', async () => {
    const user = userEvent.setup();
    renderThemed(<Trigger text="Quiet" />);
    await expect(user.click(screen.getByText('go Quiet'))).resolves.toBeUndefined();
  });
});

describe('DateTimeField', () => {
  it('reports changes and names the time zone it means', async () => {
    const onChange = vi.fn();
    renderThemed(
      <DateTimeField label="Publish at" value="" onChange={onChange} testId="when" />
    );
    expect(screen.getByLabelText('Publish at')).toBeInTheDocument();
    expect(screen.getByText(/Times are in your local time zone/)).toBeInTheDocument();
    const input = screen.getByTestId('when');
    expect(input).toHaveAttribute('type', 'datetime-local');
    await act(async () => {
      // jsdom cannot type into a datetime-local; fire the change directly.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )!.set!;
      setter.call(input, '2026-12-01T09:30');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('2026-12-01T09:30');
  });

  it("keeps the form's own message as its own element, beside the note about the clock", () => {
    renderThemed(
      <DateTimeField
        label="Starts At"
        value=""
        onChange={vi.fn()}
        error
        helperText="Start date/time is required."
      />
    );
    // Findable on its own, so a test (or a screen-reader rotor) reaches the
    // message without it being buried in the zone sentence.
    expect(screen.getByText('Start date/time is required.')).toBeInTheDocument();
    expect(screen.getByText(/Times are in your local time zone/)).toBeInTheDocument();
  });

  it('says nothing about a zone when the platform will not name one', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    renderThemed(<DateTimeField label="Publish at" value="" onChange={vi.fn()} />);
    expect(screen.queryByText(/time zone/)).toBeNull();
  });
});

describe('page chrome', () => {
  it('PageContainer carries the page test id and limits the measure', () => {
    renderThemed(
      <PageContainer testId="page" width="narrow">
        content
      </PageContainer>
    );
    const page = screen.getByTestId('page');
    expect(page).toHaveTextContent('content');
    expect(page).toHaveStyle({ maxWidth: '760px' });
  });

  it('AdminPageHeader has exactly one h1, a decorative gold rule, and its actions', () => {
    renderThemed(
      <AdminPageHeader
        title="Reading Plans"
        subtitle="Plans members can follow."
        eyebrow="Bible"
        action={<button>New plan</button>}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Plans' }]}
      />
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reading Plans');
    expect(screen.getByText('Plans members can follow.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    // The last crumb is the current page: text, not a link.
    expect(screen.getByText('Plans', { selector: 'p' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('AdminPageHeader still works with just the original title and action props', () => {
    renderThemed(<AdminPageHeader title="Songs" action={<a href="/x">Add</a>} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Songs');
    expect(screen.queryByTestId('page-breadcrumbs')).toBeNull();
  });

  it('AdminEmptyState says what is missing and offers the way to fill it', () => {
    renderThemed(
      <AdminEmptyState
        testId="empty"
        title="No plans yet"
        message="Create your first plan."
        action={<button>Create</button>}
      />
    );
    expect(screen.getByTestId('empty')).toHaveTextContent('No plans yet');
    expect(screen.getByTestId('empty')).toHaveTextContent('Create your first plan.');
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('AdminEmptyState still works with just the original message and testId props', () => {
    renderThemed(<AdminEmptyState testId="e" message="Nothing." />);
    expect(screen.getByTestId('e')).toHaveTextContent('Nothing.');
  });

  it('FormCard submits through a form, with sections and actions inside it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    renderThemed(
      <FormCard onSubmit={onSubmit} testId="form">
        <FormSection title="Details" description="The basics.">
          <input aria-label="name" />
        </FormSection>
        <FormActions>
          <button type="submit">Save</button>
        </FormActions>
      </FormCard>
    );
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByText('The basics.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('AdminTableCard gives its table a floor, so a phone scrolls the card instead of crushing columns', () => {
    renderThemed(
      <AdminTableCard>
        <table data-testid="plain" className="MuiTable-root">
          <tbody>
            <tr>
              <td>one</td>
            </tr>
          </tbody>
        </table>
      </AdminTableCard>
    );
    // The reading plans list once rendered a title a letter to a line on a
    // phone, because nothing stopped the table shrinking to fit.
    expect(getComputedStyle(screen.getByTestId('plain')).minWidth).toBe('640px');
  });

  it('AdminTableCard lets a page choose a different floor', () => {
    renderThemed(
      <AdminTableCard minTableWidth={480}>
        <table data-testid="narrower" className="MuiTable-root">
          <tbody>
            <tr>
              <td>one</td>
            </tr>
          </tbody>
        </table>
      </AdminTableCard>
    );
    expect(getComputedStyle(screen.getByTestId('narrower')).minWidth).toBe('480px');
  });

  it('TableSkeleton announces that content is loading and shows the requested rows', () => {
    renderThemed(<TableSkeleton rows={3} testId="sk" label="Loading plans" />);
    const sk = screen.getByTestId('sk');
    expect(sk).toHaveAttribute('aria-busy', 'true');
    expect(sk).toHaveAccessibleName('Loading plans');
    expect(sk.children).toHaveLength(3);
  });
});
