import { onSnapshot } from 'firebase/firestore';
import { subscribeToPublishedSongs } from '../songs';

jest.mock('../app');

describe('subscribeToPublishedSongs', () => {
  afterEach(() => jest.clearAllMocks());

  it('maps snapshot docs into PublishedSong objects', () => {
    const onNext = jest.fn();
    const onError = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 's1',
            data: () => ({
              title: 'Amazing Grace',
              artist: 'Traditional',
              category: 'Hymn',
              lyrics: 'Amazing grace...',
              audioUrl: 'https://example.com/song.mp3',
              coverUrl: null,
              published: true,
            }),
          },
        ],
      });
      return jest.fn();
    });

    subscribeToPublishedSongs(onNext, onError);

    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 's1',
        title: 'Amazing Grace',
        artist: 'Traditional',
        audioUrl: 'https://example.com/song.mp3',
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

    subscribeToPublishedSongs(onNext, onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
