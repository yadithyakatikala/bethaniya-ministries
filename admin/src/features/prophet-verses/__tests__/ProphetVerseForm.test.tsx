import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProphetVerseForm } from '../ProphetVerseForm';
import * as service from '../../../services/firebase/prophetVerses';
import type { ProphetVerseRecord } from '../../../services/firebase/prophetVerses';
import { useAuthStore } from '../../../store/authStore';
import {
  MISSING,
  READY,
  UPLOADED_IMAGE,
} from '../../../components/media/__tests__/helpers';

vi.mock('../../../services/firebase/prophetVerses');
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

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

function renderForm(props: Parameters<typeof ProphetVerseForm>[0]) {
  return render(
    <MemoryRouter>
      <ProphetVerseForm {...props} />
    </MemoryRouter>
  );
}

function record(partial: Partial<ProphetVerseRecord> = {}): ProphetVerseRecord {
  return {
    id: 'p1',
    title: 'A word for the church',
    reference: 'Isaiah 43:19',
    text: 'Behold, I will do a new thing.',
    attribution: 'Pastor Samuel',
    imageUrl: null,
    published: true,
    publishAt: new Date(2026, 3, 5, 6, 0),
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

// Uploading is NOT set up by default, which leaves the web-address box open
// -- the way these forms were used before uploads existed. Tests of the
// upload itself switch to READY.
beforeEach(() => {
  vi.mocked(getCloudinaryConfig).mockReturnValue(MISSING);
  vi.mocked(subscribeToMediaAssets).mockReturnValue(vi.fn());
  vi.mocked(createMediaAsset).mockResolvedValue('asset-1');
  vi.mocked(uploadToCloudinary).mockReset();
  useAuthStore.setState({
    user: { uid: 'admin-1', displayName: 'Admin One', email: 'a@x.org' } as never,
  });
  URL.createObjectURL = vi.fn(() => 'blob:local-preview');
  URL.revokeObjectURL = vi.fn();
});

/** Types an address into the image field and applies it. */
async function useImageAddress(address: string) {
  await userEvent.type(screen.getByTestId('prophet-verse-image-url-input'), address);
  await userEvent.click(screen.getByTestId('prophet-verse-image-url-apply'));
}

afterEach(() => {
  vi.mocked(service.createProphetVerse).mockReset();
  vi.mocked(service.updateProphetVerse).mockReset();
  navigate.mockReset();
});

describe('creating', () => {
  it('saves as a DRAFT -- publishing is a separate, deliberate action', async () => {
    vi.mocked(service.createProphetVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    expect(screen.getByTestId('prophet-verse-unpublished-note')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), 'A new word');
    await userEvent.type(
      screen.getByTestId('prophet-verse-reference-input'),
      'Isaiah 43:19'
    );
    await userEvent.type(screen.getByTestId('prophet-verse-text-input'), 'Behold.');
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() => expect(service.createProphetVerse).toHaveBeenCalled());
    expect(vi.mocked(service.createProphetVerse).mock.calls[0]![0]).toMatchObject({
      title: 'A new word',
      published: false,
    });
    expect(navigate).toHaveBeenCalledWith('/prophet-verses');
  });

  it('fills the reference from the Bible, and saves it', async () => {
    vi.mocked(service.createProphetVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), 'A new word');
    await userEvent.click(screen.getByTestId('prophet-verse-reference-input-choose'));
    const dialog = screen.getByRole('dialog', { name: 'Choose a passage' });
    await userEvent.click(within(dialog).getByRole('combobox', { name: /book/i }));
    await userEvent.click(screen.getByRole('option', { name: 'Isaiah' }));
    await userEvent.type(
      within(dialog).getByTestId('prophet-verse-reference-input-picker-chapter'),
      '43'
    );
    await userEvent.type(
      within(dialog).getByTestId('prophet-verse-reference-input-picker-from'),
      '19'
    );
    await userEvent.click(
      within(dialog).getByTestId('prophet-verse-reference-input-picker-add')
    );
    expect(screen.getByTestId('prophet-verse-reference-input')).toHaveValue(
      'Isaiah 43:19'
    );
    // The live preview reads the same value the field now holds.
    expect(screen.getByTestId('prophet-verse-preview-reference')).toHaveTextContent(
      'Isaiah 43:19'
    );

    await userEvent.type(screen.getByTestId('prophet-verse-text-input'), 'Behold.');
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));
    await waitFor(() => expect(service.createProphetVerse).toHaveBeenCalled());
    expect(vi.mocked(service.createProphetVerse).mock.calls[0]![0]).toMatchObject({
      reference: 'Isaiah 43:19',
    });
  });

  it('refuses to save without the words it would show', async () => {
    renderForm({ mode: 'create' });
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));
    await waitFor(() =>
      expect(screen.getByText('Title is required.')).toBeInTheDocument()
    );
    expect(screen.getByText('Text is required.')).toBeInTheDocument();
    expect(service.createProphetVerse).not.toHaveBeenCalled();
  });

  it('refuses to take an image address the phone could not load, and says why', async () => {
    renderForm({ mode: 'create' });
    await useImageAddress('http://example.org/a.jpg');

    expect(screen.getByText(/must start with https/i)).toBeInTheDocument();
    expect(screen.queryByTestId('prophet-verse-image-address')).not.toBeInTheDocument();
  });

  it('still refuses to save a stored address the phone could not load', async () => {
    // An old record can carry an address the field would not take today.
    renderForm({ mode: 'edit', verse: record({ imageUrl: 'http://example.org/a.jpg' }) });
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() =>
      expect(
        screen.getByText('Image address must be a full https:// web address.')
      ).toBeInTheDocument()
    );
    expect(service.updateProphetVerse).not.toHaveBeenCalled();
  });

  it('saves the address of an uploaded picture', async () => {
    vi.mocked(getCloudinaryConfig).mockReturnValue(READY);
    vi.mocked(uploadToCloudinary).mockResolvedValue(UPLOADED_IMAGE);
    vi.mocked(service.createProphetVerse).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });

    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), 'A new word');
    await userEvent.type(
      screen.getByTestId('prophet-verse-reference-input'),
      'Isaiah 43:19'
    );
    await userEvent.type(screen.getByTestId('prophet-verse-text-input'), 'Behold.');
    await userEvent.upload(
      screen.getByTestId('prophet-verse-image-input'),
      new File(['x'], 'verse.png', { type: 'image/png' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-preview-image')).toHaveAttribute(
        'src',
        UPLOADED_IMAGE.url
      )
    );
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() => expect(service.createProphetVerse).toHaveBeenCalled());
    expect(vi.mocked(service.createProphetVerse).mock.calls[0]![0]).toMatchObject({
      imageUrl: UPLOADED_IMAGE.url,
    });
  });

  it('explains that picture uploading is not set up, and offers the address box instead', () => {
    renderForm({ mode: 'create' });
    expect(screen.getByTestId('prophet-verse-image-setup')).toBeInTheDocument();
    expect(screen.queryByTestId('prophet-verse-image-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('prophet-verse-image-url-input')).toBeInTheDocument();
  });

  it('says when a save failed rather than pretending it worked', async () => {
    vi.mocked(service.createProphetVerse).mockRejectedValue(new Error('denied'));
    renderForm({ mode: 'create' });
    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), 'A new word');
    await userEvent.type(
      screen.getByTestId('prophet-verse-reference-input'),
      'Isaiah 43:19'
    );
    await userEvent.type(screen.getByTestId('prophet-verse-text-input'), 'Behold.');
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('prophet-verse-form-error')).toBeInTheDocument()
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('editing', () => {
  it('loads the record, including its schedule, back into the form', () => {
    renderForm({ mode: 'edit', verse: record() });
    expect(screen.getByTestId('prophet-verse-title-input')).toHaveValue(
      'A word for the church'
    );
    expect(screen.getByTestId('prophet-verse-publish-at-input')).toHaveValue(
      '2026-04-05T06:00'
    );
    expect(
      screen.queryByTestId('prophet-verse-unpublished-note')
    ).not.toBeInTheDocument();
  });

  it('never changes whether the record is published', async () => {
    // Publishing is the list page's action, with its own audit entry. An
    // edit that quietly unpublished a live verse would be a real defect.
    vi.mocked(service.updateProphetVerse).mockResolvedValue(undefined);
    renderForm({ mode: 'edit', verse: record({ published: true }) });
    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), ' (revised)');
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() => expect(service.updateProphetVerse).toHaveBeenCalled());
    expect(vi.mocked(service.updateProphetVerse).mock.calls[0]![1]).toMatchObject({
      published: true,
    });
  });

  it('clears an emptied attribution to null rather than an empty string', async () => {
    vi.mocked(service.updateProphetVerse).mockResolvedValue(undefined);
    renderForm({ mode: 'edit', verse: record() });
    await userEvent.clear(screen.getByTestId('prophet-verse-attribution-input'));
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() => expect(service.updateProphetVerse).toHaveBeenCalled());
    expect(vi.mocked(service.updateProphetVerse).mock.calls[0]![1]).toMatchObject({
      attribution: null,
    });
  });
});

describe('the preview', () => {
  it('shows what a member will read, as it is typed', async () => {
    renderForm({ mode: 'create' });
    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), 'A new word');
    await userEvent.type(screen.getByTestId('prophet-verse-text-input'), 'Behold.');

    expect(screen.getByTestId('prophet-verse-preview-title')).toHaveTextContent(
      'A new word'
    );
    expect(screen.getByTestId('prophet-verse-preview-text')).toHaveTextContent('Behold.');
  });

  it('shows nothing where an image would be until an address has been taken', async () => {
    renderForm({ mode: 'create' });
    expect(screen.queryByTestId('prophet-verse-preview-image')).not.toBeInTheDocument();

    // Typed but not applied: nothing yet.
    await userEvent.type(
      screen.getByTestId('prophet-verse-image-url-input'),
      'https://example.org/a.jpg'
    );
    expect(screen.queryByTestId('prophet-verse-preview-image')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('prophet-verse-image-url-apply'));
    expect(screen.getByTestId('prophet-verse-preview-image')).toHaveAttribute(
      'src',
      'https://example.org/a.jpg'
    );
  });

  it('leaves the image out of the accessibility tree -- the words carry the meaning', async () => {
    renderForm({ mode: 'create' });
    await useImageAddress('https://example.org/a.jpg');
    expect(screen.getByTestId('prophet-verse-preview-image')).toHaveAttribute('alt', '');
  });
});
