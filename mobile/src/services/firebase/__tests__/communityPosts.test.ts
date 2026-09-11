import { onSnapshot, Timestamp } from 'firebase/firestore';
import { subscribeToPublishedCommunityPosts } from '../communityPosts';

jest.mock('../app');

describe('subscribeToPublishedCommunityPosts', () => {
  afterEach(() => jest.clearAllMocks());

  it('maps snapshot docs into PublishedCommunityPost objects', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'c1',
            data: () => ({
              title: 'Baptism Testimony',
              content: 'God is good.',
              imageUrl: null,
              published: true,
              createdAt: new Timestamp(1000, 0),
            }),
          },
        ],
      });
      return jest.fn();
    });

    subscribeToPublishedCommunityPosts(onNext, onError);

    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c1', title: 'Baptism Testimony', content: 'God is good.' }),
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

    subscribeToPublishedCommunityPosts(onNext, onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
