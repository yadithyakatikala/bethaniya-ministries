import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProphetVerseForm } from '../ProphetVerseForm';
import * as service from '../../../services/firebase/prophetVerses';
import type { ProphetVerseRecord } from '../../../services/firebase/prophetVerses';

vi.mock('../../../services/firebase/prophetVerses');

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

  it('refuses to save without the words it would show', async () => {
    renderForm({ mode: 'create' });
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));
    await waitFor(() =>
      expect(screen.getByText('Title is required.')).toBeInTheDocument()
    );
    expect(screen.getByText('Text is required.')).toBeInTheDocument();
    expect(service.createProphetVerse).not.toHaveBeenCalled();
  });

  it('refuses an image address the phone could not load', async () => {
    renderForm({ mode: 'create' });
    await userEvent.type(screen.getByTestId('prophet-verse-title-input'), 'A new word');
    await userEvent.type(
      screen.getByTestId('prophet-verse-reference-input'),
      'Isaiah 43:19'
    );
    await userEvent.type(screen.getByTestId('prophet-verse-text-input'), 'Behold.');
    await userEvent.type(
      screen.getByTestId('prophet-verse-image-url-input'),
      'http://example.org/a.jpg'
    );
    await userEvent.click(screen.getByTestId('prophet-verse-form-submit'));

    await waitFor(() =>
      expect(
        screen.getByText('Image address must be a full https:// web address.')
      ).toBeInTheDocument()
    );
    expect(service.createProphetVerse).not.toHaveBeenCalled();
  });

  it('offers no file upload at all -- there is no Storage bucket on this plan', () => {
    renderForm({ mode: 'create' });
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(/There is no upload/)).toBeInTheDocument();
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

  it('shows nothing where an image would be until the address is usable', async () => {
    renderForm({ mode: 'create' });
    expect(screen.queryByTestId('prophet-verse-preview-image')).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByTestId('prophet-verse-image-url-input'),
      'https://ex'
    );
    // Still a valid https url in the making -- shown, because "https://ex"
    // parses. The half-typed states that do NOT parse show nothing.
    await userEvent.clear(screen.getByTestId('prophet-verse-image-url-input'));
    await userEvent.type(screen.getByTestId('prophet-verse-image-url-input'), 'htt');
    expect(screen.queryByTestId('prophet-verse-preview-image')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByTestId('prophet-verse-image-url-input'));
    await userEvent.type(
      screen.getByTestId('prophet-verse-image-url-input'),
      'https://example.org/a.jpg'
    );
    expect(screen.getByTestId('prophet-verse-preview-image')).toHaveAttribute(
      'src',
      'https://example.org/a.jpg'
    );
  });

  it('leaves the image out of the accessibility tree -- the words carry the meaning', async () => {
    renderForm({ mode: 'create' });
    await userEvent.type(
      screen.getByTestId('prophet-verse-image-url-input'),
      'https://example.org/a.jpg'
    );
    expect(screen.getByTestId('prophet-verse-preview-image')).toHaveAttribute('alt', '');
  });
});
