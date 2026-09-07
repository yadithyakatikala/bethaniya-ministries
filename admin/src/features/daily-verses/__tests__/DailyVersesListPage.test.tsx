import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DailyVersesListPage } from '../DailyVersesListPage';
import { useAuthStore } from '../../../store/authStore';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import type { DailyVerse } from '../../../types';

vi.mock('../../../services/firebase/dailyVerses');

function renderPage() {
  return render(
    <MemoryRouter>
      <DailyVersesListPage />
    </MemoryRouter>
  );
}

const SAMPLE: DailyVerse = {
  id: 'v1',
  reference: 'John 3:16',
  text: 'For God so loved the world...',
  imageUrl: null,
  date: '2026-09-07',
  createdAt: null,
  updatedAt: null,
};

describe('DailyVersesListPage', () => {
  afterEach(() => {
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockReset();
  });

  it('shows a loading state before the first snapshot arrives', () => {
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(() =>
      vi.fn()
    );
    renderPage();
    expect(screen.getByTestId('daily-verses-loading')).toBeInTheDocument();
  });

  it('shows an empty state when there are no daily verses', async () => {
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation((onNext) => {
      onNext([]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('daily-verses-empty')).toBeInTheDocument()
    );
  });

  it('shows an error state when the subscription fails', async () => {
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation(
      (_onNext, onError) => {
        onError({ code: 'permission-denied' } as never);
        return vi.fn();
      }
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('daily-verses-error')).toBeInTheDocument()
    );
  });

  it('renders daily verses and hides management actions for a Host', async () => {
    useAuthStore.setState({ role: 'host' });
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('John 3:16')).toBeInTheDocument());
    expect(screen.queryByTestId('new-daily-verse-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-daily-verse-v1')).not.toBeInTheDocument();
  });

  it('shows management actions for a Content Admin', async () => {
    useAuthStore.setState({ role: 'content_admin' });
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('new-daily-verse-button')).toBeInTheDocument()
    );
    expect(screen.getByTestId('delete-daily-verse-v1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-daily-verse-v1')).toBeInTheDocument();
  });

  it('deletes a daily verse only after confirming the dialog', async () => {
    useAuthStore.setState({ role: 'super_admin' });
    vi.mocked(dailyVersesService.subscribeToDailyVerses).mockImplementation((onNext) => {
      onNext([SAMPLE]);
      return vi.fn();
    });
    vi.mocked(dailyVersesService.deleteDailyVerse).mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId('delete-daily-verse-v1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('delete-daily-verse-v1'));
    expect(dailyVersesService.deleteDailyVerse).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('confirm-delete-button'));
    await waitFor(() =>
      expect(dailyVersesService.deleteDailyVerse).toHaveBeenCalledWith('v1', 'John 3:16')
    );
  });
});
