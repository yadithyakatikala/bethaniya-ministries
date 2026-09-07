import { onSnapshot, Timestamp } from 'firebase/firestore';
import { subscribeToPublishedEvents } from '../events';

jest.mock('../app');

function docFor(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      title: 'Sunday Service',
      location: '123 Main St',
      description: 'Weekly gathering',
      startsAt: new Timestamp(2000000000, 0),
      isLive: false,
      youtubeUrl: '',
      published: true,
      ...overrides,
    }),
  };
}

/**
 * subscribeToPublishedEvents() (fixed in review -- see events.ts's module
 * doc comment) now registers TWO onSnapshot listeners: the first call is
 * always the "upcoming" (startsAt >= now) query, the second is always the
 * "live" (isLive == true) query -- registration order is deterministic in
 * the implementation, so these tests key off call index rather than
 * inspecting the (identically-mocked) query object.
 */
function mockTwoListeners(
  upcomingDocs: ReturnType<typeof docFor>[],
  liveDocs: ReturnType<typeof docFor>[]
) {
  const unsubUpcoming = jest.fn();
  const unsubLive = jest.fn();
  (onSnapshot as jest.Mock)
    .mockImplementationOnce((_q, next) => {
      next({ docs: upcomingDocs });
      return unsubUpcoming;
    })
    .mockImplementationOnce((_q, next) => {
      next({ docs: liveDocs });
      return unsubLive;
    });
  return { unsubUpcoming, unsubLive };
}

describe('subscribeToPublishedEvents', () => {
  afterEach(() => jest.clearAllMocks());

  it('emits the upcoming list once both listeners have reported, with no live events', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    mockTwoListeners([docFor('e1', { title: 'Upcoming Event' })], []);

    subscribeToPublishedEvents(onNext, onError);

    expect(onNext).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'e1', title: 'Upcoming Event' }),
    ]);
  });

  it('includes a currently-live event even when its startsAt has already passed (absent from the upcoming query)', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    // The upcoming (startsAt >= now) query legitimately returns nothing --
    // the event already started -- but the live query still returns it.
    mockTwoListeners(
      [],
      [
        docFor('e-live', {
          title: 'Currently Live',
          isLive: true,
          youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
        }),
      ]
    );

    subscribeToPublishedEvents(onNext, onError);

    expect(onNext).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'e-live', title: 'Currently Live', isLive: true }),
    ]);
  });

  it('dedupes an event that matches both queries (live and not yet started)', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    const doc = docFor('e-both', { isLive: true });
    mockTwoListeners([doc], [doc]);

    subscribeToPublishedEvents(onNext, onError);

    const lastCall = onNext.mock.calls[onNext.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0]).toEqual(expect.objectContaining({ id: 'e-both' }));
  });

  it('merges and sorts the combined list by startsAt ascending', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    const soon = docFor('e-soon', { startsAt: new Timestamp(1000, 0) });
    const later = docFor('e-later', { startsAt: new Timestamp(5000, 0) });
    // Registered out of order across the two listeners to prove the merge sorts, not concatenates.
    mockTwoListeners([later], [soon]);

    subscribeToPublishedEvents(onNext, onError);

    const lastCall = onNext.mock.calls[onNext.mock.calls.length - 1][0];
    expect(lastCall.map((e: { id: string }) => e.id)).toEqual(['e-soon', 'e-later']);
  });

  it('forwards a Firestore error from the upcoming listener to onError', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock)
      .mockImplementationOnce((_q, _next, err) => {
        err(error);
        return jest.fn();
      })
      .mockImplementationOnce(() => jest.fn());

    subscribeToPublishedEvents(onNext, onError);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('forwards a Firestore error from the live listener to onError', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock)
      .mockImplementationOnce(() => jest.fn())
      .mockImplementationOnce((_q, _next, err) => {
        err(error);
        return jest.fn();
      });

    subscribeToPublishedEvents(onNext, onError);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('unsubscribes both underlying listeners when the returned function is called', () => {
    const { unsubUpcoming, unsubLive } = mockTwoListeners([], []);

    const unsubscribe = subscribeToPublishedEvents(jest.fn(), jest.fn());
    unsubscribe();

    expect(unsubUpcoming).toHaveBeenCalled();
    expect(unsubLive).toHaveBeenCalled();
  });
});
