import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DailyVerseForm } from '../DailyVerseForm';
import * as dailyVersesService from '../../../services/firebase/dailyVerses';
import { useAuthStore } from '../../../store/authStore';
import { READY, UPLOADED_IMAGE } from '../../../components/media/__tests__/helpers';
import type { DailyVerse } from '../../../types';

vi.mock('../../../services/firebase/dailyVerses');
vi.mock('../../../services/media/cloudinaryConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryConfig')>()),
  getCloudinaryConfig: vi.fn(),
}));
vi.mock('../../../services/media/cloudinaryUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/media/cloudinaryUpload')>()),
  uploadToCloudinary: vi.fn(),
}));
vi.mock('../../../services/firebase/mediaAssets', () => ({
  createMediaAsset: vi.fn(),
  assetFromUpload: vi.fn((uploaded, details) => ({ uploaded, details })),
  subscribeToMediaAssets: vi.fn(() => vi.fn()),
}));

import { getCloudinaryConfig } from '../../../services/media/cloudinaryConfig';
import { uploadToCloudinary } from '../../../services/media/cloudinaryUpload';
import {
  createMediaAsset,
  subscribeToMediaAssets,
} from '../../../services/firebase/mediaAssets';

function renderForm(props: Parameters<typeof DailyVerseForm>[0]) {
  return render(
    <MemoryRouter>
      <DailyVerseForm {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
  vi.mocked(createMediaAsset).mockResolvedValue('asset-1');
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: 'Admin One', email: 'a@x.org' } as never,
  });
  URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  URL.revokeObjectURL = vi.fn();
});

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

  it('fills the reference from the Bible when a passage is chosen, and saves what was chosen', async () => {
    vi.mocked(dailyVersesService.createDailyVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('daily-verse-reference-input-choose'));
    const dialog = screen.getByRole('dialog', { name: 'Choose a passage' });
    await user.click(within(dialog).getByRole('combobox', { name: /book/i }));
    await user.click(screen.getByRole('option', { name: 'John' }));
    await user.type(within(dialog).getByTestId('daily-verse-reference-input-picker-chapter'), '3');
    await user.type(within(dialog).getByTestId('daily-verse-reference-input-picker-from'), '16');
    await user.click(within(dialog).getByTestId('daily-verse-reference-input-picker-add'));
    expect(screen.getByTestId('daily-verse-reference-input')).toHaveValue('John 3:16');

    await user.type(screen.getByTestId('daily-verse-text-input'), 'For God so loved...');
    fireEvent.change(screen.getByTestId('daily-verse-date-input'), {
      target: { value: '2026-09-07' },
    });
    await user.click(screen.getByTestId('daily-verse-form-submit'));
    await waitFor(() =>
      expect(dailyVersesService.createDailyVerse).toHaveBeenCalledWith({
        reference: 'John 3:16',
        text: 'For God so loved...',
        imageUrl: null,
        date: '2026-09-07',
      })
    );
  });

  it('still takes a reference typed in any form, exactly as before', async () => {
    vi.mocked(dailyVersesService.createDailyVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();
    // Not a reference the picker would write -- and not one the form refuses.
    await user.type(screen.getByTestId('daily-verse-reference-input'), 'Jn 3:16 (NIV)');
    await user.type(screen.getByTestId('daily-verse-text-input'), 'Text');
    fireEvent.change(screen.getByTestId('daily-verse-date-input'), {
      target: { value: '2026-09-07' },
    });
    await user.click(screen.getByTestId('daily-verse-form-submit'));
    await waitFor(() =>
      expect(dailyVersesService.createDailyVerse).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'Jn 3:16 (NIV)' })
      )
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

  it('uploads the selected image and saves its address with the daily verse', async () => {
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
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
    await waitFor(() =>
      expect(screen.getByTestId('daily-verse-image-preview')).toHaveAttribute(
        'src',
        UPLOADED_IMAGE.url
      )
    );
    await user.click(screen.getByTestId('daily-verse-form-submit'));

    await waitFor(() =>
      expect(dailyVersesService.createDailyVerse).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: UPLOADED_IMAGE.url })
      )
    );
  });

  it('shows an error for an oversized image and uploads nothing', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByTestId('daily-verse-image-input'), bigFile);

    expect(await screen.findByTestId('daily-verse-image-error')).toHaveTextContent(
      'Image must be smaller than 5 MB.'
    );
    expect(uploadToCloudinary).not.toHaveBeenCalled();
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
