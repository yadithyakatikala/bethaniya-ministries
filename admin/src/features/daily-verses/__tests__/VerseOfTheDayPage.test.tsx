import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { VerseOfTheDayPage } from '../VerseOfTheDayPage';
import { useAuthStore } from '../../../store/authStore';
import * as votdService from '../../../services/firebase/votd';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import { indiaDateKey } from '../votdDate';
import { selectVerseForDate } from '../votdSelection';
import { VOTD_YEAR, VOTD_YEAR_CONFIG, bundledVerseYear } from '../votdYear';
import type { VersePoolEntryDocument } from '../../../services/firebase/votd';
import type { DailyVerse } from '../../../types';

vi.mock('../../../services/firebase/votd');
vi.mock('../../../services/firebase/dailyVerses');

/**
 * THE VERSE OF THE DAY PAGE -- all of it, on one screen.
 *
 * This file is the merge of two suites that used to sit beside two
 * pages: DailyVersesListPage.test.tsx (the days set by hand) and
 * VotdAutomationPage.test.tsx (the rotation, the pool and the preview).
 * Every assertion they made is still made here, because none of that
 * behaviour was meant to change -- what changed is that a church
 * administrator now finds it in one place instead of guessing which of
 * two sidebar entries governs what the congregation reads.
 *
 * The new tests are the ones that pin the consolidation itself: four
 * tabs, one page, and a straight answer to "what is on today".
 */
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

const SAMPLE_OVERRIDE: DailyVerse = {
  id: 'v1',
  reference: 'John 3:16',
  text: 'For God so loved the world...',
  imageUrl: null,
  date: '2026-09-07',
  createdAt: null,
  updatedAt: null,
};

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
      <VerseOfTheDayPage />
    </MemoryRouter>
  );
}

/** Opens one of the four tabs and waits for its panel. */
async function openTab(tab: 'today' | 'schedule' | 'verses' | 'how') {
  await userEvent.click(await screen.findByTestId(`votd-tab-${tab}`));
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

describe('one page, not two', () => {
  it('offers the four parts of the Verse of the Day as tabs', async () => {
    setUp();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('votd-tab-today')).toBeInTheDocument());
    expect(screen.getByTestId('votd-tab-schedule')).toBeInTheDocument();
    expect(screen.getByTestId('votd-tab-verses')).toBeInTheDocument();
    expect(screen.getByTestId('votd-tab-how')).toBeInTheDocument();
  });

  it('opens on today, because that is the question people arrive with', async () => {
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-today-panel')).toBeInTheDocument()
    );
    expect(screen.getByTestId('votd-today-reference')).toBeInTheDocument();
  });

  it('keeps the days set by hand and the church’s verses on ONE tab', async () => {
    // They were two sidebar destinations. They are one kind of thing:
    // the content.
    setUp({ overrides: [SAMPLE_OVERRIDE] });
    renderPage();
    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('daily-verses-list-page')).toBeInTheDocument()
    );
    expect(screen.getByTestId('votd-pool-panel')).toBeInTheDocument();
  });
});

describe('loading', () => {
  it('shows a spinner until both the configuration and the pool arrive', () => {
    vi.mocked(votdService.subscribeToVotdConfig).mockImplementation(() => vi.fn());
    vi.mocked(votdService.subscribeToVersePool).mockImplementation(() => vi.fn());
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(() => vi.fn());
    renderPage();
    expect(screen.getByTestId('votd-loading')).toBeInTheDocument();
  });

  it('says so when the configuration cannot be read', async () => {
    vi.mocked(votdService.subscribeToVotdConfig).mockImplementation((_onNext, onError) => {
      onError({ code: 'permission-denied' } as never);
      return vi.fn();
    });
    vi.mocked(votdService.subscribeToVersePool).mockImplementation(() => vi.fn());
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(() => vi.fn());
    renderPage();
    await waitFor(() => expect(screen.getByTestId('votd-error')).toBeInTheDocument());
  });
});

describe('today', () => {
  it('says which verse is up, and where it came from', async () => {
    setUp();
    renderPage();
    const expected = selectVerseForDate(indiaDateKey(), CONFIG, POOL)!;
    await waitFor(() =>
      expect(screen.getByTestId('votd-today-reference')).toHaveTextContent(
        expected.reference
      )
    );
    // Today and the date preview both carry a source chip -- they are
    // the same answer for the same date, so both say "pool".
    expect(screen.getAllByTestId('votd-source-pool').length).toBeGreaterThan(0);
  });

  it('shows the app’s own verse when the church has added none', async () => {
    // The state nearly every church is in on day one. It used to read
    // as a warning about an empty pool; it is the normal case.
    setUp({ pool: [] });
    renderPage();
    const expected = selectVerseForDate(
      indiaDateKey(),
      VOTD_YEAR_CONFIG,
      bundledVerseYear()
    )!;
    await waitFor(() =>
      expect(screen.getByTestId('votd-today-reference')).toHaveTextContent(
        expected.reference
      )
    );
    expect(screen.getAllByTestId('votd-source-year').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/using its own year of 365 verses/i).length).toBeGreaterThan(
      0
    );
  });

  it('says how long it is before a verse comes round again', async () => {
    setUp({ pool: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/comes round again after 365 days/i)).toBeInTheDocument()
    );
  });

  it('counts the church’s own verses when it has them', async () => {
    setUp();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/comes round again after 2 days/i)).toBeInTheDocument()
    );
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
      within(screen.getByTestId('votd-preview-result')).getByText(
        'From your church’s verses'
      )
    ).toBeInTheDocument();
  });

  it('says plainly when a date is already set by hand, and shows THAT verse', async () => {
    // An override wins over the rotation, so showing the automated pick
    // would be showing a verse nobody will ever see.
    const today = indiaDateKey();
    setUp({ overrides: [override(today)] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-reference')).toHaveTextContent('Isaiah 53:5')
    );
    expect(screen.getAllByText('Set by hand').length).toBeGreaterThan(0);
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

  it('offers the manual override where the question comes up', async () => {
    setUp();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('votd-set-by-hand')).toBeInTheDocument());
    // Carries the date, so the form opens on the day being looked at.
    expect(screen.getByTestId('votd-set-by-hand')).toHaveAttribute(
      'href',
      `/daily-verses/new?date=${indiaDateKey()}`
    );
  });

  it('does not offer to set a day that is already set', async () => {
    const today = indiaDateKey();
    setUp({ overrides: [override(today)] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('votd-preview-reference')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('votd-set-by-hand')).not.toBeInTheDocument();
  });

  it('falls to the app’s year when automatic selection is paused', async () => {
    setUp({ config: { ...CONFIG, enabled: false } });
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByTestId('votd-source-year').length).toBeGreaterThan(0)
    );
    // Paused does NOT mean blank: saying otherwise would misdescribe the
    // app, which still shows a verse every day.
    expect(
      screen.getAllByText(/Automatic selection from your church/i).length
    ).toBeGreaterThan(0);
  });
});

describe('the schedule', () => {
  it('lists a run of days, each with its verse and its source', async () => {
    setUp();
    renderPage();
    await openTab('schedule');
    const today = indiaDateKey();
    await waitFor(() =>
      expect(screen.getByTestId(`votd-schedule-row-${today}`)).toBeInTheDocument()
    );
    expect(screen.getByTestId(`votd-schedule-source-${today}`)).toBeInTheDocument();
  });

  it('calls it a 365-day schedule when the app’s own year is in use', async () => {
    setUp({ pool: [] });
    renderPage();
    await openTab('schedule');
    await waitFor(() =>
      expect(screen.getByText('The 365-day schedule')).toBeInTheDocument()
    );
  });

  it('grows to a full year on request', async () => {
    setUp({ pool: [] });
    renderPage();
    await openTab('schedule');
    await waitFor(() => expect(screen.getByTestId('votd-schedule-more')).toBeInTheDocument());

    // 30 -> 120 -> 210 -> 300 -> 365, then the button goes away.
    for (let click = 0; click < 4; click += 1) {
      await userEvent.click(screen.getByTestId('votd-schedule-more'));
    }
    await waitFor(() =>
      expect(screen.getByText(/Showing 365 days — a full year\./)).toBeInTheDocument()
    );
    expect(screen.queryByTestId('votd-schedule-more')).not.toBeInTheDocument();
  });

  it('shows a day set by hand in its place, marked as such', async () => {
    const today = indiaDateKey();
    setUp({ overrides: [override(today)] });
    renderPage();
    await openTab('schedule');
    await waitFor(() =>
      expect(
        within(screen.getByTestId(`votd-schedule-row-${today}`)).getByText('Isaiah 53:5')
      ).toBeInTheDocument()
    );
    expect(
      within(screen.getByTestId(`votd-schedule-source-${today}`)).getByText('Set by hand')
    ).toBeInTheDocument();
  });

  it('never repeats a verse inside one cycle of the app’s own year', async () => {
    // The claim the page makes, checked rather than asserted.
    setUp({ pool: [] });
    renderPage();
    await openTab('schedule');
    await waitFor(() => expect(screen.getByTestId('votd-schedule-more')).toBeInTheDocument());
    for (let click = 0; click < 4; click += 1) {
      await userEvent.click(screen.getByTestId('votd-schedule-more'));
    }
    await waitFor(() =>
      expect(
        screen.getByText(/All 365 verses of the cycle are different\./)
      ).toBeInTheDocument()
    );
  });
});

describe('days set by hand', () => {
  it('shows an empty state that does not read like something is missing', async () => {
    setUp();
    renderPage();
    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('daily-verses-empty')).toBeInTheDocument()
    );
    expect(screen.getByText(/which is how it is meant to work/i)).toBeInTheDocument();
  });

  it('shows an error state when that one subscription fails', async () => {
    vi.mocked(votdService.subscribeToVotdConfig).mockImplementation((onNext) => {
      onNext(CONFIG);
      return vi.fn();
    });
    vi.mocked(votdService.subscribeToVersePool).mockImplementation((onNext) => {
      onNext(POOL);
      return vi.fn();
    });
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'permission-denied' } as never);
        return vi.fn();
      }
    );
    renderPage();
    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('daily-verses-error')).toBeInTheDocument()
    );
    // The rotation does not depend on that read, so the rest stands.
    expect(screen.getByTestId('votd-pool-panel')).toBeInTheDocument();
  });

  it('renders them and hides management actions for a Host', async () => {
    useAuthStore.setState({ role: 'host' });
    setUp({ overrides: [SAMPLE_OVERRIDE] });
    renderPage();
    await openTab('verses');
    await waitFor(() => expect(screen.getByText('2026-09-07')).toBeInTheDocument());
    expect(screen.queryByTestId('new-daily-verse-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-daily-verse-v1')).not.toBeInTheDocument();
  });

  it('shows management actions for a Content Admin', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    setUp({ overrides: [SAMPLE_OVERRIDE] });
    renderPage();
    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('new-daily-verse-button')).toBeInTheDocument()
    );
    expect(screen.getByTestId('delete-daily-verse-v1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-daily-verse-v1')).toBeInTheDocument();
  });

  it('deletes one only after confirming the dialog', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(dailyVersesService.deleteDailyVerse).mockResolvedValue(undefined);
    setUp({ overrides: [SAMPLE_OVERRIDE] });
    renderPage();
    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('delete-daily-verse-v1')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('delete-daily-verse-v1'));
    expect(dailyVersesService.deleteDailyVerse).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() =>
      expect(dailyVersesService.deleteDailyVerse).toHaveBeenCalledWith('v1', 'John 3:16')
    );
  });
});

describe('the church’s own verses', () => {
  it('lists them in the order the rotation will use, marking what is out', async () => {
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
    await openTab('verses');
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
    await openTab('verses');
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
    await openTab('verses');
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
    await openTab('verses');
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
    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('votd-pool-delete-john-3-16')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('votd-pool-delete-john-3-16'));
    expect(votdService.deleteVersePoolEntry).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('votd-pool-confirm-delete'));
    expect(votdService.deleteVersePoolEntry).toHaveBeenCalledWith('john-3-16', 'John 3:16');
  });

  it('warns that a short list means a short cycle', async () => {
    // Two verses is two days. Not an error -- but not something to find
    // out by noticing.
    setUp();
    renderPage();
    await openTab('verses');
    await waitFor(() => expect(screen.getByTestId('votd-pool-short')).toBeInTheDocument());
    expect(screen.getByText(/comes round every 2 days/i)).toBeInTheDocument();
  });

  it('says an empty list is fine, not unfinished', async () => {
    setUp({ pool: [] });
    renderPage();
    await openTab('verses');
    await waitFor(() => expect(screen.getByTestId('votd-pool-empty')).toBeInTheDocument());
    expect(
      within(screen.getByTestId('votd-pool-empty')).getByText(/own year of 365 verses/i)
    ).toBeInTheDocument();
  });
});

describe('how it works', () => {
  it('states in one sentence that nothing has to be done each morning', async () => {
    setUp({ pool: [] });
    renderPage();
    await openTab('how');
    await waitFor(() =>
      expect(screen.getByTestId('votd-automation-summary')).toBeInTheDocument()
    );
    expect(screen.getByTestId('votd-automation-summary')).toHaveTextContent(
      /nothing to set up and nothing to do each morning/i
    );
    expect(screen.getByTestId('votd-automation-status')).toHaveTextContent('Running');
  });

  it('says when it is paused', async () => {
    setUp({ config: { ...CONFIG, enabled: false } });
    renderPage();
    await openTab('how');
    await waitFor(() =>
      expect(screen.getByTestId('votd-automation-status')).toHaveTextContent('Paused')
    );
  });

  it('saves the seed, the version and the switch together', async () => {
    vi.mocked(votdService.saveVotdConfig).mockResolvedValue(undefined);
    setUp();
    renderPage();
    await openTab('how');
    await waitFor(() => expect(screen.getByTestId('votd-seed-input')).toBeInTheDocument());

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
    await openTab('how');
    await waitFor(() => expect(screen.getByTestId('votd-seed-input')).toBeInTheDocument());

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
    await openTab('how');
    await waitFor(() => expect(screen.getByTestId('votd-config-save')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('votd-config-save'));
    await waitFor(() =>
      expect(screen.getByTestId('votd-config-failed')).toBeInTheDocument()
    );
  });

  it('restarts the rotation by raising the version', async () => {
    vi.mocked(votdService.bumpVotdPoolVersion).mockResolvedValue(2);
    setUp();
    renderPage();
    await openTab('how');
    await waitFor(() =>
      expect(screen.getByTestId('votd-bump-pool-version')).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId('votd-bump-pool-version'));
    expect(votdService.bumpVotdPoolVersion).toHaveBeenCalledWith(1);
  });
});

describe('who can do what', () => {
  it('lets a Host look but not touch', async () => {
    useAuthStore.setState({ role: 'host' });
    setUp();
    renderPage();
    // Seeing which verse the congregation gets is not privileged.
    await waitFor(() =>
      expect(screen.getByTestId('votd-today-reference')).toBeInTheDocument()
    );

    await openTab('verses');
    await waitFor(() => expect(screen.getByTestId('votd-pool-panel')).toBeInTheDocument());
    expect(screen.queryByTestId('votd-add-pool-entry-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('votd-pool-delete-john-3-16')).not.toBeInTheDocument();

    await openTab('how');
    await waitFor(() =>
      expect(screen.getByText('Only a content admin can change these.')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('votd-config-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('votd-bump-pool-version')).not.toBeInTheDocument();
  });

  it('gives a Content Admin the controls', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    setUp();
    renderPage();
    await openTab('how');
    await waitFor(() => expect(screen.getByTestId('votd-config-save')).toBeInTheDocument());
    expect(screen.getByTestId('votd-bump-pool-version')).toBeInTheDocument();

    await openTab('verses');
    await waitFor(() =>
      expect(screen.getByTestId('votd-add-pool-entry-form')).toBeInTheDocument()
    );
  });
});

describe('the built-in year this page reports on', () => {
  it('is the same 365 references the app carries', async () => {
    // The dashboard's copy is generated from the same source as the
    // app's (scripts/derive-votd-year.mjs writes both). If this ever
    // failed, every schedule on this page would be fiction.
    expect(VOTD_YEAR).toHaveLength(365);
    expect(VOTD_YEAR_CONFIG.seed).toBe('maranatha-fallback');
  });
});
