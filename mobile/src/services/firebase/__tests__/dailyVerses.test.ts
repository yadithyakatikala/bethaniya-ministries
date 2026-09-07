import { onSnapshot, where } from 'firebase/firestore';
import { subscribeToTodaysDailyVerse, todayDateString } from '../dailyVerses';

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
    subscribeToTodaysDailyVerse(jest.fn(), jest.fn());
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

    subscribeToTodaysDailyVerse(onNext, onError);

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

    subscribeToTodaysDailyVerse(onNext, onError);

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

    subscribeToTodaysDailyVerse(onNext, onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
