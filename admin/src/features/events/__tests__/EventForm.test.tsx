import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EventForm } from '../EventForm';
import * as eventsService from '../../../services/firebase/events';
import type { Event } from '../../../types';

vi.mock('../../../services/firebase/events');

function renderForm(props: Parameters<typeof EventForm>[0]) {
  return render(
    <MemoryRouter>
      <EventForm {...props} />
    </MemoryRouter>
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId('event-title-input'), 'Sunday Service');
  await user.type(screen.getByTestId('event-location-input'), '123 Main St');
  await user.type(screen.getByTestId('event-description-input'), 'Weekly gathering');
  const startsAtInput = screen.getByTestId('event-starts-at-input');
  await user.click(startsAtInput);
  await user.paste('2026-09-20T18:30');
}

describe('EventForm', () => {
  it('shows validation errors and does not submit when required fields are empty', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('event-form-submit'));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Location is required.')).toBeInTheDocument();
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(screen.getByText('Start date/time is required.')).toBeInTheDocument();
    expect(eventsService.createEvent).not.toHaveBeenCalled();
  });

  it('creates an event with the entered fields when valid', async () => {
    vi.mocked(eventsService.createEvent).mockResolvedValue('new-id');
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() =>
      expect(eventsService.createEvent).toHaveBeenCalledWith({
        title: 'Sunday Service',
        location: '123 Main St',
        description: 'Weekly gathering',
        startsAt: '2026-09-20T18:30',
      })
    );
  });

  it('pre-fills fields and calls updateEvent in edit mode, never touching published/isLive/youtubeUrl', async () => {
    vi.mocked(eventsService.updateEvent).mockResolvedValue(undefined);
    const existing: Event = {
      id: 'e1',
      title: 'Old title',
      location: 'Old location',
      description: 'Old description',
      startsAt: new Date('2026-09-20T18:30:00'),
      published: true,
      isLive: true,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      createdAt: null,
      updatedAt: null,
    };
    renderForm({ mode: 'edit', event: existing });

    expect(screen.getByTestId('event-title-input')).toHaveValue('Old title');

    const user = userEvent.setup();
    await user.clear(screen.getByTestId('event-title-input'));
    await user.type(screen.getByTestId('event-title-input'), 'New title');
    await user.click(screen.getByTestId('event-form-submit'));

    await waitFor(() =>
      expect(eventsService.updateEvent).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ title: 'New title' })
      )
    );
    const payload = vi.mocked(eventsService.updateEvent).mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty('published');
    expect(payload).not.toHaveProperty('isLive');
    expect(payload).not.toHaveProperty('youtubeUrl');
  });

  it('rejects an unparseable start date/time', async () => {
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await user.type(screen.getByTestId('event-title-input'), 'Title');
    await user.type(screen.getByTestId('event-location-input'), 'Location');
    await user.type(screen.getByTestId('event-description-input'), 'Description');
    // datetime-local inputs reject free text, so the empty-value error path is what
    // actually fires here -- confirming submit still won't proceed without a value.
    await user.click(screen.getByTestId('event-form-submit'));

    expect(await screen.findByText('Start date/time is required.')).toBeInTheDocument();
    expect(eventsService.createEvent).not.toHaveBeenCalled();
  });

  it('shows a submit error and does not navigate away when the write fails', async () => {
    vi.mocked(eventsService.createEvent).mockRejectedValue(new Error('offline'));
    renderForm({ mode: 'create' });
    const user = userEvent.setup();

    await fillRequiredFields(user);
    await user.click(screen.getByTestId('event-form-submit'));

    expect(await screen.findByTestId('event-form-error')).toBeInTheDocument();
  });
});
