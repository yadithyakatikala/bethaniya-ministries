import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onSnapshot, Timestamp } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { EventsListScreen } from '../EventsListScreen';
import { lightTokens } from '../../../theme/tokens';

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
  const goBack = jest.fn();
  const utils = await render(
    <AuthProvider>
      <PreferencesProvider>
        <EventsListScreen
          navigation={{ navigate, goBack } as never}
          route={{ key: 'EventsList', name: 'EventsList' } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
  return { ...utils, navigate, goBack };
}

function eventDoc(
  id: string,
  startsAt: Date | null,
  fields: Record<string, unknown> = {}
) {
  return {
    id,
    data: () => ({
      title: `Event ${id}`,
      location: 'Main hall',
      description: 'Weekly gathering',
      startsAt: startsAt ? new Timestamp(Math.floor(startsAt.getTime() / 1000), 0) : null,
      isLive: false,
      youtubeUrl: '',
      published: true,
      ...fields,
    }),
  };
}

function publish(docs: ReturnType<typeof eventDoc>[]) {
  (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
    next({ docs });
    return jest.fn();
  });
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

    await fireEvent.press(getByTestId('event-e1'));
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

  it('has a top bar named Events whose Back leaves the screen', async () => {
    publish([eventDoc('e1', new Date(2033, 5, 1, 10, 0))]);
    const { getByText, getByRole, goBack } = await renderScreen();
    expect(getByText('Events')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Back' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('says when and where on the row, with the day named for a later event', async () => {
    publish([eventDoc('e1', new Date(2033, 5, 1, 18, 30), { title: 'Prayer Meeting' })]);
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Prayer Meeting')).toBeTruthy());
    expect(getByText(/^Wed 1 Jun 2033, 6:30\s?PM · Main hall$/i)).toBeTruthy();
  });

  it('says Today for an event that starts today', async () => {
    const today = new Date();
    today.setHours(10, 30, 0, 0);
    publish([eventDoc('e1', today, { title: 'Sunday Worship' })]);
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Sunday Worship')).toBeTruthy());
    expect(getByText(/^Today, 10:30\s?AM · Main hall$/i)).toBeTruthy();
  });

  it('leaves out the place when there is none, and says the date is to be announced when there is none', async () => {
    publish([
      eventDoc('e1', new Date(2033, 5, 1, 18, 30), { location: '  ' }),
      eventDoc('e2', null, { title: 'Date to come' }),
    ]);
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Date to come')).toBeTruthy());
    expect(getByText(/^Wed 1 Jun 2033, 6:30\s?PM$/i)).toBeTruthy();
    expect(getByText('Date and time to be announced · Main hall')).toBeTruthy();
  });

  it('draws a calendar tile with the weekday, the day and the month', async () => {
    publish([eventDoc('e1', new Date(2033, 5, 1, 18, 30))]);
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('event-e1')).toBeTruthy());
    const tile = getByTestId('event-e1-date', { includeHiddenElements: true });
    expect(tile).toHaveTextContent(/Wed1Jun/);
  });

  it('lifts a live event into a red-outlined box, and gives the others only a hairline', async () => {
    publish([
      eventDoc('live', new Date(2033, 5, 1, 10, 0), { isLive: true }),
      eventDoc('later', new Date(2033, 5, 3, 10, 0)),
    ]);
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('event-live')).toBeTruthy());
    const live = StyleSheet.flatten(getByTestId('event-live').props.style);
    const later = StyleSheet.flatten(getByTestId('event-later').props.style);
    expect(live).toMatchObject({ borderWidth: 1.5, borderColor: lightTokens.live });
    expect(later.borderWidth).toBeUndefined();
    expect(later.borderBottomWidth).toBe(1);
  });

  it('names a live row as LIVE NOW first, for a screen reader', async () => {
    publish([
      eventDoc('live', new Date(2033, 5, 1, 10, 0), { isLive: true, title: 'Worship' }),
    ]);
    const { getByRole } = await renderScreen();
    await waitFor(() =>
      expect(getByRole('button', { name: /^LIVE NOW\. Worship\. / })).toBeTruthy()
    );
  });

  it('subscribes again, and lists the events, when Try again is pressed', async () => {
    (onSnapshot as jest.Mock)
      .mockImplementationOnce((_q, _next, err) => {
        err({ code: 'unavailable' });
        return jest.fn();
      })
      .mockImplementation((_q, next) => {
        next({
          docs: [eventDoc('e1', new Date(2033, 5, 1, 10, 0), { title: 'Back again' })],
        });
        return jest.fn();
      });
    const { getByText, getByTestId, queryByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('events-error')).toBeTruthy());
    expect(getByTestId('events-error')).toHaveTextContent(/Could not load events\./);
    await fireEvent.press(getByText('Try again'));
    await waitFor(() => expect(getByText('Back again')).toBeTruthy());
    expect(queryByTestId('events-error')).toBeNull();
  });

  it('says what the empty page is for', async () => {
    publish([]);
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('events-empty')).toBeTruthy());
    expect(getByTestId('events-empty')).toHaveTextContent(/No events yet/);
  });
});
