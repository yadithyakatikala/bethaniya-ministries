import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DailyVerseForm } from '../DailyVerseForm';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import type { DailyVerse } from '../../../types';

vi.mock('../../../services/firebase/dailyVerses');

function renderForm(props: Parameters<typeof DailyVerseForm>[0]) {
  return render(
    <MemoryRouter>
      <DailyVerseForm {...props} />
    </MemoryRouter>
  );
}

describe('DailyVerseForm', () => {
  it('shows validation errors and does not submit when fields are empty', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    expect(
      await screen.findByText('Scripture reference is required.')
    ).toBeInTheDocument();
    expect(screen.getByText('Verse text is required.')).toBeInTheDocument();
    expect(screen.getByText('Date is required.')).toBeInTheDocument();
    expect(dailyVersesService.createDailyVerse).not.toHaveBeenCalled();
  });

  it('creates a daily verse with the entered fields when valid', async () => {
    vi.mocked(dailyVersesService.createDailyVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('daily-verse-reference-input'), 'John 3:16');
    await user.type(
      screen.getByTestId('daily-verse-text-input'),
      'For God so loved the world...'
    );
    fireEvent.change(screen.getByTestId('daily-verse-date-input'), {
      target: { value: '2026-09-07' },
    });
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    await waitFor(() =>
      expect(dailyVersesService.createDailyVerse).toHaveBeenCalledWith({
        reference: 'John 3:16',
        text: 'For God so loved the world...',
        imageUrl: null,
        date: '2026-09-07',
      })
    );
  });

  it('pre-fills fields and calls updateDailyVerse in edit mode', async () => {
    vi.mocked(dailyVersesService.updateDailyVerse).mockResolvedValue(undefined);
    const existing: DailyVerse = {
      id: 'v1',
      reference: 'Old reference',
      text: 'Old text',
      imageUrl: null,
      date: '2026-09-01',
      createdAt: null,
      updatedAt: null,
    };
    renderForm({ mode: 'edit', verse: existing });

    expect(screen.getByTestId('daily-verse-reference-input')).toHaveValue(
      'Old reference'
    );
    expect(screen.getByTestId('daily-verse-date-input')).toHaveValue('2026-09-01');

    const user = userEvent.setup();
    await user.clear(screen.getByTestId('daily-verse-reference-input'));
    await user.type(screen.getByTestId('daily-verse-reference-input'), 'New reference');
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    await waitFor(() =>
      expect(dailyVersesService.updateDailyVerse).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({ reference: 'New reference' })
      )
    );
  });

  it('uploads the selected image before creating the daily verse', async () => {
    vi.mocked(dailyVersesService.uploadDailyVerseImage).mockResolvedValue(
      'https://example.com/uploaded.jpg'
    );
    vi.mocked(dailyVersesService.createDailyVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('daily-verse-reference-input'), 'John 3:16');
    await user.type(screen.getByTestId('daily-verse-text-input'), 'Text');
    fireEvent.change(screen.getByTestId('daily-verse-date-input'), {
      target: { value: '2026-09-07' },
    });
    const file = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('daily-verse-image-input'), file);
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    await waitFor(() =>
      expect(dailyVersesService.uploadDailyVerseImage).toHaveBeenCalledWith(file)
    );
    await waitFor(() =>
      expect(dailyVersesService.createDailyVerse).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://example.com/uploaded.jpg' })
      )
    );
  });

  it('shows an error and blocks upload for an oversized image, without calling createDailyVerse', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('daily-verse-reference-input'), 'John 3:16');
    await user.type(screen.getByTestId('daily-verse-text-input'), 'Text');
    fireEvent.change(screen.getByTestId('daily-verse-date-input'), {
      target: { value: '2026-09-07' },
    });
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByTestId('daily-verse-image-input'), bigFile);

    expect(await screen.findByTestId('daily-verse-image-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );

    await user.click(screen.getByTestId('daily-verse-form-submit'));
    expect(dailyVersesService.uploadDailyVerseImage).not.toHaveBeenCalled();
    expect(dailyVersesService.createDailyVerse).not.toHaveBeenCalled();
  });

  it('shows a submit error and does not navigate away when the write fails', async () => {
    vi.mocked(dailyVersesService.createDailyVerse).mockRejectedValue(
      new Error('offline')
    );
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('daily-verse-reference-input'), 'John 3:16');
    await user.type(screen.getByTestId('daily-verse-text-input'), 'Text');
    fireEvent.change(screen.getByTestId('daily-verse-date-input'), {
      target: { value: '2026-09-07' },
    });
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    expect(await screen.findByTestId('daily-verse-form-error')).toBeInTheDocument();
  });
});
