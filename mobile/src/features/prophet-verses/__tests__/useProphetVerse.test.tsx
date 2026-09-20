import React from 'react';
import { AppState, Text, View, type AppStateStatus } from 'react-native';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { fetchCurrentProphetVerse } from '../../../services/firebase/prophetVerses';
import { REFRESH_AFTER_MS, useProphetVerse } from '../useProphetVerse';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/prophetVerses');

/**
 * The hook fetches; it does not watch and it does not poll. Three things
 * are pinned here: it reads once per app open rather than once a minute,
 * a failed read is `empty` rather than an error (the Prophet Verse is a
 * secondary block, and an error panel where a devotional should be is
 * worse than no section at all), and -- M6 BUG 4 -- coming back to the app
 * reads again, so a verse an administrator has just published actually
 * turns up.
 */
const VERSE = {
  id: 'p1',
  title: 'A word',
  reference: 'Isaiah 43:19',
  text: 'Behold.',
  attribution: null,
  imageUrl: null,
  publishAt: new Date('2026-04-01T06:00:00.000Z'),
};

function Probe() {
  const state = useProphetVerse();
  return (
    <View>
      <Text testID="status">{state.status}</Text>
      {state.status === 'ready' ? <Text testID="title">{state.verse.title}</Text> : null}
    </View>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
});

describe('the current prophet verse', () => {
  it('fetches once and reports the verse', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValue(VERSE);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    expect(screen.getByTestId('title').props.children).toBe('A word');
    // One read per app open. A poll would cost a read a minute per device.
    expect(fetchCurrentProphetVerse).toHaveBeenCalledTimes(1);
  });

  it('reports empty when the church has published none', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValue(null);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('empty')
    );
  });

  it('reports empty -- not an error -- when the read fails', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockRejectedValue(new Error('offline'));
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('empty')
    );
  });

  it('is loading until the fetch settles, rather than flashing empty first', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockReturnValue(new Promise(() => {}));
    const screen = await render(<Probe />);
    expect(screen.getByTestId('status').props.children).toBe('loading');
  });
});

/**
 * M6 BUG 4 REGRESSION.
 *
 * The hook read on mount and on an Indian date change, and nothing else.
 * ../daily-verses/useIndiaDateKey.ts does watch AppState, but it only
 * yields a new VALUE when the DATE has changed, so returning to the app on
 * the same afternoon produced the identical string and this hook never
 * re-ran. A verse published at ten in the morning appeared at midnight, or
 * when the member next force-quit the app -- on Android, possibly never.
 */
describe('M6: coming back to the app picks up a newly published verse', () => {
  /** Hands back a way to drive AppState as the OS would. */
  function captureAppState() {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler: (state: AppStateStatus) => void) => {
        listeners.push(handler);
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AppState.addEventListener
        >;
      });
    return async (state: AppStateStatus) => {
      await act(async () => {
        listeners.forEach((listener) => listener(state));
      });
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('re-reads when the app becomes active, and shows the new verse', async () => {
    const send = captureAppState();
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValueOnce(VERSE);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );

    // The administrator publishes a new one while the member is elsewhere.
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValueOnce({
      ...VERSE,
      id: 'p2',
      title: 'A newer word',
    });
    await send('background');
    // Far enough back that the throttle below is not what is being tested.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + REFRESH_AFTER_MS + 1);
    await send('active');

    await waitFor(() =>
      expect(screen.getByTestId('title').props.children).toBe('A newer word')
    );
    expect(fetchCurrentProphetVerse).toHaveBeenCalledTimes(2);
  });

  it('does not blank the section while the refresh is in flight', async () => {
    // Someone glancing back at their phone should see the verse that is
    // already there, not a loading state.
    const send = captureAppState();
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValueOnce(VERSE);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );

    (fetchCurrentProphetVerse as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + REFRESH_AFTER_MS + 1);
    await send('active');

    expect(screen.getByTestId('status').props.children).toBe('ready');
    expect(screen.getByTestId('title').props.children).toBe('A word');
  });

  it('still does not poll: a quick app switch costs no second read', async () => {
    // The throttle is the whole reason this is affordable. Flicking to
    // another app and straight back must not spend a read each time.
    const send = captureAppState();
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValue(VERSE);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );

    await send('background');
    await send('active');
    await send('background');
    await send('active');

    expect(fetchCurrentProphetVerse).toHaveBeenCalledTimes(1);
  });

  it('ignores every state but active', async () => {
    const send = captureAppState();
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValue(VERSE);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + REFRESH_AFTER_MS + 1);
    await send('background');
    await send('inactive');

    expect(fetchCurrentProphetVerse).toHaveBeenCalledTimes(1);
  });
});
