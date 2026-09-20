import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportsPage } from '../ReportsPage';
import { useAuthStore } from '../../../store/authStore';
import * as service from '../../../services/firebase/reports';
import type { ReportRecord } from '../../../services/firebase/reports';
import type { User } from 'firebase/auth';

vi.mock('../../../services/firebase/reports');

/**
 * The moderation queue.
 *
 * The assertions that matter: an administrator can SEE what was
 * reported (a queue of ids is a queue nobody can act on), and a
 * reported anonymous prayer request still says "Anonymous" -- this page
 * has no privileged identity lookup and must not grow one.
 */
function report(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    id: 'r1',
    targetType: 'community_message',
    targetId: 'c1',
    targetParentId: null,
    reason: 'harassment',
    details: 'This was unkind.',
    reporterUid: 'member-1',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    status: 'open',
    resolvedByUid: null,
    resolvedAt: null,
    resolutionNote: null,
    ...overrides,
  };
}

/** Delivers `reports` to the page through the subscription callback. */
function withReports(reports: ReportRecord[]) {
  vi.mocked(service.subscribeToReports).mockImplementation((onNext) => {
    onNext(reports);
    return () => undefined;
  });
}

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'admin-1' } as unknown as User,
    role: 'content_admin',
  });
  vi.mocked(service.fetchReportedContent).mockResolvedValue({
    text: 'The reported words.',
    authorName: 'Asha',
    removed: false,
    missing: false,
  });
  vi.mocked(service.removeReportedContent).mockResolvedValue(undefined);
  vi.mocked(service.resolveReport).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.mocked(service.subscribeToReports).mockReset();
  vi.mocked(service.fetchReportedContent).mockReset();
  vi.mocked(service.removeReportedContent).mockReset();
  vi.mocked(service.resolveReport).mockReset();
});

describe('the queue', () => {
  it('says so, rather than showing an empty table, when nothing needs attention', () => {
    withReports([]);
    render(<ReportsPage />);
    expect(screen.getByTestId('reports-empty')).toBeInTheDocument();
  });

  it('lists an open report', () => {
    withReports([report()]);
    render(<ReportsPage />);
    expect(screen.getByTestId('report-row-r1')).toBeInTheDocument();
  });

  it('hides a resolved report until All is chosen', async () => {
    withReports([report({ id: 'r2', status: 'resolved' })]);
    render(<ReportsPage />);
    expect(screen.queryByTestId('report-row-r2')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('reports-filter-all'));
    expect(screen.getByTestId('report-row-r2')).toBeInTheDocument();
  });

  it('does not fetch the reported content for every row', () => {
    // A queue of forty reports would otherwise be forty extra reads to
    // render a table.
    withReports([report(), report({ id: 'r2' }), report({ id: 'r3' })]);
    render(<ReportsPage />);
    expect(service.fetchReportedContent).not.toHaveBeenCalled();
  });
});

describe('reviewing one', () => {
  it('shows the words that were reported', async () => {
    withReports([report()]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));
    expect(await screen.findByTestId('report-content-text')).toHaveTextContent(
      'The reported words.'
    );
  });

  it('shows what the reporter said about it', async () => {
    withReports([report()]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));
    expect(await screen.findByTestId('report-details')).toHaveTextContent(
      'This was unkind.'
    );
  });

  it('says Anonymous for a request with no author, and shows no uid', async () => {
    vi.mocked(service.fetchReportedContent).mockResolvedValue({
      text: 'Something private.',
      authorName: null,
      removed: false,
      missing: false,
    });
    withReports([report({ targetType: 'prayer_request', targetId: 'p1' })]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));

    expect(await screen.findByText('Anonymous')).toBeInTheDocument();
    // The uid is not in the dialogue at all -- this page has no
    // privileged lookup and must not grow one.
    expect(screen.queryByText(/member-/)).not.toBeInTheDocument();
  });

  it('removes the content AND closes the report in one action', async () => {
    withReports([report()]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));
    await screen.findByTestId('report-content-text');
    await userEvent.click(screen.getByTestId('report-remove'));

    await waitFor(() => expect(service.removeReportedContent).toHaveBeenCalled());
    expect(service.resolveReport).toHaveBeenCalledWith(
      'r1',
      'admin-1',
      'resolved',
      expect.any(String)
    );
  });

  it('can dismiss without removing anything', async () => {
    withReports([report()]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));
    await screen.findByTestId('report-content-text');
    await userEvent.click(screen.getByTestId('report-dismiss'));

    await waitFor(() =>
      expect(service.resolveReport).toHaveBeenCalledWith(
        'r1',
        'admin-1',
        'dismissed',
        expect.any(String)
      )
    );
    expect(service.removeReportedContent).not.toHaveBeenCalled();
  });

  it('says so, and offers no removal, when the author already deleted it', async () => {
    vi.mocked(service.fetchReportedContent).mockResolvedValue({
      text: '',
      authorName: null,
      removed: false,
      missing: true,
    });
    withReports([report()]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));

    expect(await screen.findByTestId('report-content-missing')).toBeInTheDocument();
    expect(screen.getByTestId('report-remove')).toBeDisabled();
    // Still closeable: a report pointing at nothing has to leave the
    // queue somehow.
    expect(screen.getByTestId('report-dismiss')).toBeEnabled();
  });

  it('shows a failure rather than pretending the report was closed', async () => {
    vi.mocked(service.resolveReport).mockRejectedValue(new Error('denied'));
    withReports([report()]);
    render(<ReportsPage />);
    await userEvent.click(screen.getByTestId('report-review-r1'));
    await screen.findByTestId('report-content-text');
    await userEvent.click(screen.getByTestId('report-dismiss'));

    expect(await screen.findByTestId('report-action-error')).toBeInTheDocument();
  });
});

describe('when the queue itself cannot be read', () => {
  it('says so instead of showing an empty queue', () => {
    vi.mocked(service.subscribeToReports).mockImplementation((_onNext, onError) => {
      onError({ code: 'permission-denied' } as never);
      return () => undefined;
    });
    render(<ReportsPage />);
    expect(screen.getByTestId('reports-error')).toBeInTheDocument();
  });
});
