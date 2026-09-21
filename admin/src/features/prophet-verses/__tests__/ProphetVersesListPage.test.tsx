import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProphetVersesListPage } from '../ProphetVersesListPage';
import { useAuthStore } from '../../../store/authStore';
import * as service from '../../../services/firebase/prophetVerses';
import type { ProphetVerseRecord } from '../../../services/firebase/prophetVerses';

vi.mock('../../../services/firebase/prophetVerses');

function renderPage() {
  return render(
    <MemoryRouter>
      <ProphetVersesListPage />
    </MemoryRouter>
  );
}

function record(partial: Partial<ProphetVerseRecord> = {}): ProphetVerseRecord {
  return {
    id: 'p1',
    title: 'A word for the church',
    reference: 'Isaiah 43:19',
    text: 'Behold, I will do a new thing.',
    attribution: null,
    imageUrl: null,
    published: true,
    publishAt: new Date('2020-01-01T06:00:00.000Z'),
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

function withRecords(records: ProphetVerseRecord[]) {
  vi.mocked(service.subscribeToProphetVerses).mockImplementation((onNext) => {
    onNext(records);
    return vi.fn();
  });
}

afterEach(() => {
  vi.mocked(service.subscribeToProphetVerses).mockReset();
  vi.mocked(service.setProphetVersePublished).mockReset();
  vi.mocked(service.deleteProphetVerse).mockReset();
  useAuthStore.setState({ role: 'super_admin' });
});

describe('the states an administrator can see', () => {
  it('shows a loading state before the first snapshot', () => {
    vi.mocked(service.subscribeToProphetVerses).mockImplementation(() => vi.fn());
    renderPage();
    expect(screen.getByTestId('prophet-verses-loading')).toBeInTheDocument();
  });

  it('explains what an empty list means for the app', async () => {
    withRecords([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verses-empty')).toBeInTheDocument()
    );
    expect(screen.getByText(/does not show that section/i)).toBeInTheDocument();
  });

  it('shows an error state when the subscription fails', async () => {
    vi.mocked(service.subscribeToProphetVerses).mockImplementation((_onNext, onError) => {
      onError({ code: 'permission-denied' } as never);
      return vi.fn();
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verses-error')).toBeInTheDocument()
    );
  });

  it('names draft, scheduled and published separately', async () => {
    // Draft and scheduled look identical to a member -- both invisible --
    // so the words have to distinguish them here.
    withRecords([
      record({ id: 'draft', published: false }),
      record({ id: 'scheduled', publishAt: new Date('2099-01-01T00:00:00.000Z') }),
      record({ id: 'live' }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-state-draft')).toHaveTextContent('Draft')
    );
    expect(screen.getByTestId('prophet-verse-state-scheduled')).toHaveTextContent(
      'Scheduled'
    );
    expect(screen.getByTestId('prophet-verse-state-live')).toHaveTextContent('Published');
  });

  it('marks the one the app is actually showing', async () => {
    withRecords([
      record({ id: 'older', publishAt: new Date('2019-01-01T00:00:00.000Z') }),
      record({ id: 'newer', publishAt: new Date('2021-01-01T00:00:00.000Z') }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-current-newer')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('prophet-verse-current-older')).not.toBeInTheDocument();
  });
});

/**
 * "What is on the home screen right now" -- the question this page was
 * not answering.
 *
 * Only one prophet verse shows at a time, and which one it is was
 * deducible only from a chip inside a table row. A pastor should not
 * have to read a table to learn what their church is reading, and when
 * the list is empty a table says nothing at all.
 */
describe('on the home screen now', () => {
  it('names the record the app is showing, above the table', async () => {
    withRecords([
      record({ id: 'older', title: 'Last month', publishAt: new Date('2019-01-01') }),
      record({ id: 'newer', title: 'This week', publishAt: new Date('2021-01-01') }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-now-title')).toHaveTextContent('This week')
    );
  });

  it('says plainly that nothing is showing, rather than leaving a blank', async () => {
    withRecords([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-now-none')).toBeInTheDocument()
    );
    // And explains what a member sees, which is nothing at all -- not an
    // empty box.
    expect(screen.getByText(/leaves this section out/i)).toBeInTheDocument();
  });

  it('treats a draft and a scheduled record as not showing', async () => {
    withRecords([
      record({ id: 'draft', published: false }),
      record({ id: 'later', publishAt: new Date('2099-01-01T00:00:00.000Z') }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-now-none')).toBeInTheDocument()
    );
  });

  it('counts what is queued behind it', async () => {
    withRecords([
      record({ id: 'live' }),
      record({ id: 'later', publishAt: new Date('2099-01-01T00:00:00.000Z') }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/1 more is scheduled/i)).toBeInTheDocument()
    );
  });
});

describe('telling the two verse features apart', () => {
  it('says on the page that this is not the Verse of the Day', async () => {
    // They sit next to each other on the home screen and share most of
    // a name. The distinction cannot be left to be guessed.
    withRecords([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/is not the Verse of the Day/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Nothing here happens automatically/i)).toBeInTheDocument();
  });
});

describe('who can do what', () => {
  it('hides every write control from a Host', async () => {
    useAuthStore.setState({ role: 'host' });
    withRecords([record()]);
    renderPage();
    // The title appears twice for a record that is showing -- once in
    // the "on the home screen now" summary and once in the table.
    await waitFor(() =>
      expect(screen.getAllByText('A word for the church').length).toBeGreaterThan(0)
    );
    expect(screen.queryByTestId('new-prophet-verse-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('prophet-verse-toggle-p1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-prophet-verse-p1')).not.toBeInTheDocument();
  });

  it('shows them to a Content Admin', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    withRecords([record()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('new-prophet-verse-button')).toBeInTheDocument()
    );
    expect(screen.getByTestId('prophet-verse-toggle-p1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-prophet-verse-p1')).toBeInTheDocument();
  });
});

describe('publishing', () => {
  it('publishes a draft', async () => {
    vi.mocked(service.setProphetVersePublished).mockResolvedValue(undefined);
    withRecords([record({ published: false })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-toggle-p1')).toHaveTextContent('Publish')
    );
    await userEvent.click(screen.getByTestId('prophet-verse-toggle-p1'));
    expect(service.setProphetVersePublished).toHaveBeenCalledWith(
      'p1',
      'A word for the church',
      true
    );
  });

  it('unpublishes a published record', async () => {
    vi.mocked(service.setProphetVersePublished).mockResolvedValue(undefined);
    withRecords([record()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-toggle-p1')).toHaveTextContent('Unpublish')
    );
    await userEvent.click(screen.getByTestId('prophet-verse-toggle-p1'));
    expect(service.setProphetVersePublished).toHaveBeenCalledWith(
      'p1',
      'A word for the church',
      false
    );
  });

  it('says so when the change could not be made', async () => {
    vi.mocked(service.setProphetVersePublished).mockRejectedValue(new Error('denied'));
    withRecords([record()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-toggle-p1')).toBeEnabled()
    );
    await userEvent.click(screen.getByTestId('prophet-verse-toggle-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verses-action-error')).toBeInTheDocument()
    );
  });
});

describe('deleting', () => {
  it('asks first, and names what will go', async () => {
    withRecords([record()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('delete-prophet-verse-p1')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('delete-prophet-verse-p1'));
    expect(
      screen.getByText(/"A word for the church" will be permanently deleted/)
    ).toBeInTheDocument();
    expect(service.deleteProphetVerse).not.toHaveBeenCalled();
  });

  it('deletes once confirmed', async () => {
    vi.mocked(service.deleteProphetVerse).mockResolvedValue(undefined);
    withRecords([record()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('delete-prophet-verse-p1')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('delete-prophet-verse-p1'));
    await userEvent.click(screen.getByTestId('prophet-verse-confirm-delete'));
    expect(service.deleteProphetVerse).toHaveBeenCalledWith(
      'p1',
      'A word for the church'
    );
  });
});
