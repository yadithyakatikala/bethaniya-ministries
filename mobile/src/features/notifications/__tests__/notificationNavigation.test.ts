import { getNavigationTargetFromData } from '../notificationNavigation';

describe('getNavigationTargetFromData', () => {
  it('returns null for null/undefined data', () => {
    expect(getNavigationTargetFromData(null)).toBeNull();
    expect(getNavigationTargetFromData(undefined)).toBeNull();
  });

  it('returns null when screen is missing or not a string', () => {
    expect(getNavigationTargetFromData({})).toBeNull();
    expect(getNavigationTargetFromData({ screen: 123 })).toBeNull();
  });

  it('returns null for an unrecognized screen name', () => {
    expect(getNavigationTargetFromData({ screen: 'NotARealScreen' })).toBeNull();
  });

  it('resolves a no-param route', () => {
    expect(getNavigationTargetFromData({ screen: 'SongsList' })).toEqual({
      screen: 'SongsList',
    });
  });

  it('resolves BibleChapter with valid bookId/chapterNumber', () => {
    expect(
      getNavigationTargetFromData({
        screen: 'BibleChapter',
        bookId: 'genesis',
        chapterNumber: 3,
      })
    ).toEqual({
      screen: 'BibleChapter',
      params: { bookId: 'genesis', chapterNumber: 3 },
    });
  });

  it('returns null for BibleChapter with a missing chapterNumber', () => {
    expect(
      getNavigationTargetFromData({ screen: 'BibleChapter', bookId: 'genesis' })
    ).toBeNull();
  });

  it('returns null for BibleChapter with a wrong-typed chapterNumber', () => {
    expect(
      getNavigationTargetFromData({
        screen: 'BibleChapter',
        bookId: 'genesis',
        chapterNumber: '3',
      })
    ).toBeNull();
  });
});
