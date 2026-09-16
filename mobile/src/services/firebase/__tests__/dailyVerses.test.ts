import { AppState } from 'react-native';
import { onSnapshot, orderBy, where } from 'firebase/firestore';
import {
  subscribeToDailyVerseArchive,
  subscribeToTodaysDailyVerse,
  todayDateString,
} from '../dailyVerses';

jest.mock('../app');

describe('todayDateString', () => {
  it('returns a zero-padded YYYY-MM-DD string', () => {
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('subscribeToTodaysDailyVerse', () => {
  afterEach(() => jest.clearAllMocks());

  it('filters the query by date == todayDateString()', () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    subscribeToTodaysDailyVerse(jest.fn(), jest.fn())();
    expect(where).toHaveBeenCalledWith('date', '==', todayDateString());
  });

  it('maps the first matching doc into a TodaysDailyVerse', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'For God so loved the world...',
              imageUrl: null,
              date: todayDateString(),
            }),
          },
        ],
      });
      return jest.fn();
    });

    subscribeToTodaysDailyVerse(onNext, onError)();

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v1', reference: 'John 3:16' })
    );
  });

  it('calls onNext with null when no verse is set for today', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });

    subscribeToTodaysDailyVerse(onNext, onError)();

    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('forwards Firestore errors to onError', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err(error);
      return jest.fn();
    });

    subscribeToTodaysDailyVerse(onNext, onError)();

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('subscribeToDailyVerseArchive', () => {
  afterEach(() => jest.clearAllMocks());

  it('orders the query by date descending', () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    subscribeToDailyVerseArchive(jest.fn(), jest.fn());
    expect(orderBy).toHaveBeenCalledWith('date', 'desc');
  });

  it('maps every doc into a verse, newest first', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v2',
            data: () => ({
              reference: 'Psalm 23:1',
              text: 'The Lord is my shepherd...',
              imageUrl: null,
              date: '2026-09-13',
            }),
          },
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'For God so loved the world...',
              imageUrl: null,
              date: '2026-09-12',
            }),
          },
        ],
      });
      return jest.fn();
    });

    subscribeToDailyVerseArchive(onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'v2', reference: 'Psalm 23:1' }),
      expect.objectContaining({ id: 'v1', reference: 'John 3:16' }),
    ]);
  });

  it('calls onNext with an empty array when no verses exist', () => {
    const onNext = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });

    subscribeToDailyVerseArchive(onNext, jest.fn());

    expect(onNext).toHaveBeenCalledWith([]);
  });

  it('forwards Firestore errors to onError', () => {
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err(error);
      return jest.fn();
    });

    subscribeToDailyVerseArchive(jest.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

/**
 * Midnight rollover. subscribeToTodaysDailyVerse pins its query to a
 * single date string, so it has to rebuild that query when the local date
 * changes. Before this was handled, an app left open across midnight kept
 * querying yesterday's date forever -- see that function's comment.
 *
 * These drive the AppState ("app came back to the foreground") trigger
 * rather than the interval, and inject the clock instead of faking global
 * time. Deliberate: jest's fake timers interact badly with the React
 * Native test renderer in this project (see
 * HomeScreen.test.tsx's note) and hung this file outright
 * when tried. The interval and the AppState listener call exactly the same
 * re-check function, so this covers the same logic without the timer.
 *
 * Every test unsubscribes: the real subscription starts a 60s interval,
 * and leaking one leaves an open handle behind.
 */
describe('subscribeToTodaysDailyVerse -- midnight rollover', () => {
  let appStateHandler: ((state: string) => void) | undefined;
  let removeSpy: jest.Mock;

  beforeEach(() => {
    removeSpy = jest.fn();
    appStateHandler = undefined;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, handler: (state: never) => void) => {
        appStateHandler = handler as (state: string) => void;
        return { remove: removeSpy } as never;
      });
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  /** Simulates the app returning to the foreground. */
  function foreground() {
    appStateHandler?.('active');
  }

  it('rebuilds the query once the local date has rolled over', () => {
    let today = '2026-03-14';
    const unsubscribe = subscribeToTodaysDailyVerse(jest.fn(), jest.fn(), () => today);
    expect(where).toHaveBeenLastCalledWith('date', '==', '2026-03-14');

    today = '2026-03-15';
    foreground();

    expect(where).toHaveBeenLastCalledWith('date', '==', '2026-03-15');
    unsubscribe();
  });

  it('does not rebuild the query while the date is unchanged', () => {
    const unsubscribe = subscribeToTodaysDailyVerse(
      jest.fn(),
      jest.fn(),
      () => '2026-03-14'
    );
    const callsAfterSubscribe = (onSnapshot as jest.Mock).mock.calls.length;

    foreground();
    foreground();

    expect((onSnapshot as jest.Mock).mock.calls.length).toBe(callsAfterSubscribe);
    unsubscribe();
  });

  it('tears down the previous listener when it rebuilds', () => {
    const firstInner = jest.fn();
    const secondInner = jest.fn();
    (onSnapshot as jest.Mock)
      .mockImplementationOnce(() => firstInner)
      .mockImplementationOnce(() => secondInner);

    let today = '2026-03-14';
    const unsubscribe = subscribeToTodaysDailyVerse(jest.fn(), jest.fn(), () => today);

    today = '2026-03-15';
    foreground();

    // Rebuilding must not leak yesterday's listener.
    expect(firstInner).toHaveBeenCalledTimes(1);
    expect(secondInner).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('releases the inner listener and the AppState subscription on unsubscribe', () => {
    const inner = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation(() => inner);

    let today = '2026-03-14';
    const unsubscribe = subscribeToTodaysDailyVerse(jest.fn(), jest.fn(), () => today);
    const callsAfterSubscribe = (onSnapshot as jest.Mock).mock.calls.length;

    unsubscribe();

    expect(inner).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    // A date change after unsubscribe must not resurrect the listener.
    today = '2026-03-15';
    foreground();
    expect((onSnapshot as jest.Mock).mock.calls.length).toBe(callsAfterSubscribe);
  });
});
