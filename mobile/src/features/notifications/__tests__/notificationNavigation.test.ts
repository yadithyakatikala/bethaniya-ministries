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

  it.each(['PrayersHub', 'CommunityHub', 'You'])(
    'resolves %s, one of the five tab destinations',
    (screen) => {
      expect(getNavigationTargetFromData({ screen })).toEqual({ screen });
    }
  );

  it("sends the retired 'Profile' name to the Profile tab of You", () => {
    expect(getNavigationTargetFromData({ screen: 'Profile' })).toEqual({
      screen: 'You',
      params: { tab: 'profile' },
    });
  });

  it.each([
    'More',
    'Announcements',
    'Prayers',
    'PrayerWall',
    'CommunityList',
    'CommunityChat',
  ])('still ignores %s, which a notification never could open', (screen) => {
    expect(getNavigationTargetFromData({ screen })).toBeNull();
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not mistake the object property %s for a route',
    (screen) => {
      expect(getNavigationTargetFromData({ screen })).toBeNull();
    }
  );
});
