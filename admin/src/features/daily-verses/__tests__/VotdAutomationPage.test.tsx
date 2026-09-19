import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { VotdAutomationPage } from '../VotdAutomationPage';
import { useAuthStore } from '../../../store/authStore';
import * as votdService from '../../../services/firebase/votd';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import { indiaDateKey } from '../votdDate';
import { selectVerseForDate } from '../votdSelection';
import type { VersePoolEntryDocument } from '../../../services/firebase/votd';
import type { DailyVerse } from '../../../types';

vi.mock('../../../services/firebase/votd');
vi.mock('../../../services/firebase/dailyVerses');

const CONFIG = {
  enabled: true,
  seed: 'maranatha',
  poolVersion: 1,
  timezone: 'Asia/Kolkata',
  updatedAt: null,
};

function entry(
  id: string,
  order: number,
  partial: Partial<VersePoolEntryDocument> = {}
): VersePoolEntryDocument {
  return {
    id,
    reference: `Book ${order}:1`,
    bookId: `book-${order}`,
    chapter: 1,
    verse: 1,
    order,
    active: true,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

const POOL = [
  entry('john-3-16', 0, {
    reference: 'John 3:16',
    bookId: 'john',
    chapter: 3,
    verse: 16,
  }),
  entry('psalms-23-1', 1, {
    reference: 'Psalms 23:1',
    bookId: 'psalms',
    chapter: 23,
    verse: 1,
  }),
];

function setUp({ config = CONFIG, pool = POOL, overrides = [] as DailyVerse[] } = {}) {
  vi.mocked(votdService.subscribeToVotdConfig).mockImplementation((onNext) => {
    onNext(config);
    return vi.fn();
  });
  vi.mocked(votdService.subscribeToVersePool).mockImplementation((onNext) => {
    onNext(pool);
    return vi.fn();
  });
  vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation((onNext) => {
    onNext(overrides);
    return vi.fn();
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <VotdAutomationPage />
    </MemoryRouter>
  );
}

function override(date: string): DailyVerse {
  return {
    id: date,
    reference: 'Isaiah 53:5',
    text: 'But he was pierced for our transgressions...',
    imageUrl: null,
    date,
    createdAt: null,
    updatedAt: null,
  };
}

afterEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ role: 'super_admin' });
});

describe('loading', () => {
  it('shows a spinner until both the configuration and the pool arrive', () => {
    vi.mocked(votdService.subscribeToVotdConfig).mockImplementation(() => vi.fn());
    vi.mocked(votdService.subscribeToVersePool).mockImplementation(() => vi.fn());
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('votd-loading')).toBeInTheDocument();
  });

  it('says so when the configuration cannot be read', async () => {
    vi.mocked(votdService.subscribeToVotdConfig).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'permission-denied' } as never);
        return vi.fn();
      }
    );
    vi.mocked(votdService.subscribeToVersePool).mockImplementation(() => vi.fn());
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('votd-error')).toBeInTheDocument());
  });
});

describe('the preview', () => {
  it('defaults to today in the CHURCH’s calendar, not the administrator’s', async () => {
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-date')).toHaveValue(indiaDateKey())
    );
  });

  it('shows the verse the rotation would choose, and says it came from the pool', async () => {
    setUp();
    renderPage();
    const today = indiaDateKey();
    const expected = selectVerseForDate(today, CONFIG, POOL)!;
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-reference')).toHaveTextContent(
        expected.reference
      )
    );
    expect(
      within(screen.getByTestId('votd-preview-result')).getByText('From the pool')
    ).toBeInTheDocument();
  });

  it('says plainly when a date is already set by hand, and shows THAT verse', async () => {
    // An override wins over the rotation, so showing the automated pick
    // would be showing a verse nobody will ever see.
    const today = indiaDateKey();
    setUp({ overrides: [override(today)] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-reference')).toHaveTextContent(
        'Isaiah 53:5'
      )
    );
    expect(screen.getByText('Set by hand')).toBeInTheDocument();
  });

  it('previews another date, and changes its answer', async () => {
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-date')).toBeInTheDocument()
    );

    const seen = new Set<string>();
    for (const date of ['2026-04-03', '2026-04-04']) {
      await userEvent.clear(screen.getByTestId('votd-preview-date'));
      await userEvent.type(screen.getByTestId('votd-preview-date'), date);
      await waitFor(() =>
        expect(screen.getByTestId('votd-preview-date')).toHaveValue(date)
      );
      seen.add(screen.getByTestId('votd-preview-reference').textContent ?? '');
    }
    // A two-verse pool alternates, so consecutive days must differ.
    expect(seen.size).toBe(2);
  });

  it('warns that the app will fall back when the pool is empty', async () => {
    setUp({ pool: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-fallback')).toBeInTheDocument()
    );
    expect(screen.getByText(/Add verses to the pool below/)).toBeInTheDocument();
  });

  it('warns differently when automation is switched off', async () => {
    setUp({ config: { ...CONFIG, enabled: false } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-fallback')).toBeInTheDocument()
    );
    expect(screen.getByText(/Automatic selection is paused/)).toBeInTheDocument();
  });
});

describe('the configuration form', () => {
  it('saves the seed, the version and the switch together', async () => {
    vi.mocked(votdService.saveVotdConfig).mockResolvedValue(undefined);
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-seed-input')).toBeInTheDocument()
    );

    await userEvent.clear(screen.getByTestId('votd-seed-input'));
    await userEvent.type(screen.getByTestId('votd-seed-input'), 'lent-2026');
    await userEvent.click(screen.getByTestId('votd-config-save'));

    await waitFor(() => expect(votdService.saveVotdConfig).toHaveBeenCalled());
    expect(votdService.saveVotdConfig).toHaveBeenCalledWith({
      enabled: true,
      seed: 'lent-2026',
      poolVersion: 1,
    });
    expect(await screen.findByTestId('votd-config-saved')).toBeInTheDocument();
  });

  it('refuses a seed the rules would reject, without calling Firestore', async () => {
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-seed-input')).toBeInTheDocument()
    );

    await userEvent.clear(screen.getByTestId('votd-seed-input'));
    await userEvent.click(screen.getByTestId('votd-config-save'));

    await waitFor(() =>
      expect(screen.getByText('A seed is required.')).toBeInTheDocument()
    );
    expect(votdService.saveVotdConfig).not.toHaveBeenCalled();
  });

  it('says so when the save fails', async () => {
    vi.mocked(votdService.saveVotdConfig).mockRejectedValue(new Error('denied'));
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-config-save')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('votd-config-save'));
    await waitFor(() =>
      expect(screen.getByTestId('votd-config-failed')).toBeInTheDocument()
    );
  });
});

describe('the pool', () => {
  it('lists it in the order the rotation will use, marking what is out', async () => {
    setUp({
      pool: [
        ...POOL,
        entry('romans-8-28', 2, {
          reference: 'Romans 8:28',
          bookId: 'romans',
          chapter: 8,
          verse: 28,
          active: false,
        }),
      ],
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-row-john-3-16')).toBeInTheDocument()
    );
    expect(screen.getByText('Taken out')).toBeInTheDocument();
    // The deactivated entry has no position in the rotation.
    expect(
      within(screen.getByTestId('votd-pool-row-romans-8-28')).getByText('—')
    ).toBeInTheDocument();
  });

  it('adds a verse the administrator picked, with the reference built for them', async () => {
    vi.mocked(votdService.saveVersePoolEntry).mockResolvedValue('psalms-117-2');
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-book-select')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByLabelText('Book'));
    await userEvent.click(await screen.findByRole('option', { name: 'Psalms' }));
    await userEvent.type(screen.getByTestId('votd-pool-chapter-input'), '117');
    await userEvent.type(screen.getByTestId('votd-pool-verse-input'), '2');
    await userEvent.click(screen.getByTestId('votd-pool-add'));

    await waitFor(() => expect(votdService.saveVersePoolEntry).toHaveBeenCalled());
    expect(votdService.saveVersePoolEntry).toHaveBeenCalledWith({
      bookId: 'psalms',
      chapter: 117,
      verse: 2,
      // Built from the book table, never typed -- so "Jhon 3:16" cannot
      // reach the pool.
      reference: 'Psalms 117:2',
      order: 2,
      active: true,
    });
  });

  it('refuses a verse that does not exist, and says how many there are', async () => {
    // Psalm 117 has two verses. A third would be a silent fallback day.
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-book-select')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByLabelText('Book'));
    await userEvent.click(await screen.findByRole('option', { name: 'Psalms' }));
    await userEvent.type(screen.getByTestId('votd-pool-chapter-input'), '117');
    await userEvent.type(screen.getByTestId('votd-pool-verse-input'), '3');
    await userEvent.click(screen.getByTestId('votd-pool-add'));

    await waitFor(() =>
      expect(screen.getByText('Psalms 117 has 2 verses.')).toBeInTheDocument()
    );
    expect(votdService.saveVersePoolEntry).not.toHaveBeenCalled();
  });

  it('takes a verse out of the rotation without deleting it', async () => {
    vi.mocked(votdService.setVersePoolEntryActive).mockResolvedValue(undefined);
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-deactivate-john-3-16')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('votd-pool-deactivate-john-3-16'));
    expect(votdService.setVersePoolEntryActive).toHaveBeenCalledWith(
      'john-3-16',
      'John 3:16',
      false
    );
  });

  it('asks before removing a verse for good', async () => {
    vi.mocked(votdService.deleteVersePoolEntry).mockResolvedValue(undefined);
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-delete-john-3-16')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('votd-pool-delete-john-3-16'));
    expect(votdService.deleteVersePoolEntry).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('votd-pool-confirm-delete'));
    expect(votdService.deleteVersePoolEntry).toHaveBeenCalledWith(
      'john-3-16',
      'John 3:16'
    );
  });

  it('restarts the rotation by raising the version', async () => {
    vi.mocked(votdService.bumpVotdPoolVersion).mockResolvedValue(2);
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-bump-pool-version')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('votd-bump-pool-version'));
    expect(votdService.bumpVotdPoolVersion).toHaveBeenCalledWith(1);
  });

  it('explains what an empty pool means', async () => {
    setUp({ pool: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-empty')).toBeInTheDocument()
    );
  });
});

describe('who can do what', () => {
  it('lets a Host look but not touch', async () => {
    useAuthStore.setState({ role: 'host' });
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-panel')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('votd-config-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('votd-add-pool-entry-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('votd-pool-delete-john-3-16')).not.toBeInTheDocument();
    expect(
      screen.getByText('Only a content admin can change these.')
    ).toBeInTheDocument();
    // Seeing which verse the congregation gets is not privileged.
    expect(screen.getByTestId('votd-preview-reference')).toBeInTheDocument();
  });

  it('gives a Content Admin the controls', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-config-save')).toBeInTheDocument()
    );
    expect(screen.getByTestId('votd-add-pool-entry-form')).toBeInTheDocument();
    expect(screen.getByTestId('votd-bump-pool-version')).toBeInTheDocument();
  });
});
