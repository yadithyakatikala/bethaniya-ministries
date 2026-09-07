import { onSnapshot, Timestamp } from 'firebase/firestore';
import { subscribeToPublishedAnnouncements } from '../announcements';

jest.mock('../app');

describe('subscribeToPublishedAnnouncements', () => {
  afterEach(() => jest.clearAllMocks());

  it('maps snapshot docs into PublishedAnnouncement objects', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'a1',
            data: () => ({
              title: 'Sunday Service',
              content: 'Join us at 10am.',
              imageUrl: null,
              published: true,
              createdAt: new Timestamp(1000, 0),
            }),
          },
        ],
      });
      return jest.fn();
    });

    subscribeToPublishedAnnouncements(onNext, onError);

    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'a1',
        title: 'Sunday Service',
        content: 'Join us at 10am.',
      }),
    ]);
  });

  it('forwards Firestore errors to onError', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    const error = { code: 'permission-denied' };
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err(error);
      return jest.fn();
    });

    subscribeToPublishedAnnouncements(onNext, onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
