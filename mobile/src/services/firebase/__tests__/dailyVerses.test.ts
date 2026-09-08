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
