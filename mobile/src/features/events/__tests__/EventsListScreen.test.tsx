import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onSnapshot, Timestamp } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { EventsListScreen } from '../EventsListScreen';

jest.mock('../../../services/firebase/app');

/**
 * Only the `navigate` method this screen actually calls is exercised --
 * the `navigation`/`route` casts below stand in for the rest of
 * NativeStackScreenProps' shape, which this test doesn't need (same
 * `as never` convention used elsewhere, e.g. SongsListScreen.test.tsx).
 *
 * Wrapped in AuthProvider/PreferencesProvider since the screen now reads
 * useTheme() -- same reasoning as SongsListScreen.test.tsx.
 */
async function renderScreen() {
  const navigate = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <EventsListScreen
          navigation={{ navigate } as never}
          route={{ key: 'EventsList', name: 'EventsList' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate };
}

describe('EventsListScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state before the first snapshot arrives', async () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await renderScreen();
    expect(getByTestId('events-loading')).toBeTruthy();
  });

  it('shows an empty state when there are no upcoming published events', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('events-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('events-error')).toBeTruthy());
  });

  it('renders each event, shows a LIVE badge when isLive, and navigates to EventDetail on tap', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'e1',
            data: () => ({
              title: 'Sunday Service',
              location: '123 Main St',
              description: 'Weekly gathering',
              startsAt: new Timestamp(2000000000, 0),
              isLive: true,
              youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
              published: true,
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText, getByTestId, navigate } = await renderScreen();
    await waitFor(() => expect(getByText('Sunday Service')).toBeTruthy());
    expect(getByTestId('live-badge-e1')).toBeTruthy();

    fireEvent.press(getByTestId('event-e1'));
    expect(navigate).toHaveBeenCalledWith(
      'EventDetail',
      expect.objectContaining({ event: expect.objectContaining({ id: 'e1' }) })
    );
  });

  it('keeps a currently-live event visible even though its startsAt has already passed (absent from the upcoming query alone)', async () => {
    const liveDoc = {
      id: 'e-live',
      data: () => ({
        title: 'Already Started, Still Live',
        location: '123 Main St',
        description: 'Weekly gathering',
        startsAt: new Timestamp(1, 0),
        isLive: true,
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
        published: true,
      }),
    };
    // First onSnapshot registration is the "upcoming" (startsAt >= now)
    // listener -- correctly empty, since this event already started.
    // Second is the "live" (isLive == true) listener -- still returns it.
    // See events.ts's module doc comment for why subscribeToPublishedEvents
    // registers two listeners.
    (onSnapshot as jest.Mock)
      .mockImplementationOnce((_q, next) => {
        next({ docs: [] });
        return jest.fn();
      })
      .mockImplementationOnce((_q, next) => {
        next({ docs: [liveDoc] });
        return jest.fn();
      });
    const { getByText, getByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Already Started, Still Live')).toBeTruthy());
    expect(getByTestId('live-badge-e-live')).toBeTruthy();
  });

  it('does not show a LIVE badge for a non-live event', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'e1',
            data: () => ({
              title: 'Sunday Service',
              location: '123 Main St',
              description: 'Weekly gathering',
              startsAt: new Timestamp(2000000000, 0),
              isLive: false,
              youtubeUrl: '',
              published: true,
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByText('Sunday Service')).toBeTruthy());
    expect(queryByTestId('live-badge-e1')).toBeNull();
  });
});
