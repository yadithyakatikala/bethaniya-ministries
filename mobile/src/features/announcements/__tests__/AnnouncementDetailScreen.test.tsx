import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { AnnouncementDetailScreen } from '../AnnouncementDetailScreen';
import type { PublishedAnnouncement } from '../../../services/firebase/announcements';

jest.mock('../../../services/firebase/app');

const ANNOUNCEMENT: PublishedAnnouncement = {
  id: 'a1',
  title: 'Fellowship Potluck',
  content: 'Join us after the Sunday service for a potluck lunch. Bring a dish to share.',
  imageUrl: null,
  // Local noon of a day in an earlier year: the same date in every timezone, and
  // old enough that the screen spells the year out whatever today is.
  createdAt: new Date(2020, 8, 14, 12, 0),
};

/**
 * Only `route.params.announcement` is read by this screen -- same
 * `as never` convention as SongDetailScreen.test.tsx for the rest of
 * NativeStackScreenProps' shape. Wrapped in AuthProvider/
 * PreferencesProvider since it reads useTheme().
 */
async function renderScreen(
  announcement: PublishedAnnouncement = ANNOUNCEMENT,
  goBack = jest.fn()
) {
  return await render(
    <AuthProvider>
      <PreferencesProvider>
        <AnnouncementDetailScreen
          navigation={{ goBack } as never}
          route={
            {
              key: 'AnnouncementDetail',
              name: 'AnnouncementDetail',
              params: { announcement },
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('AnnouncementDetailScreen', () => {
  it('shows the title and full content', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('announcement-detail-screen')).toBeTruthy());
    expect(getByTestId('announcement-detail-title')).toHaveTextContent(
      'Fellowship Potluck'
    );
    expect(getByTestId('announcement-detail-content')).toHaveTextContent(
      'Join us after the Sunday service for a potluck lunch. Bring a dish to share.'
    );
  });

  it('shows a formatted date, after what it is, when createdAt is set', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('announcement-detail-date')).toHaveTextContent(
      'Announcement  ·  September 14, 2020'
    );
  });

  it('goes back when Back is pressed', async () => {
    const goBack = jest.fn();
    const { getByTestId } = await renderScreen(ANNOUNCEMENT, goBack);
    await fireEvent.press(getByTestId('top-bar-back'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('omits the date, but not the label, when createdAt is null', async () => {
    const { getByTestId } = await renderScreen({ ...ANNOUNCEMENT, createdAt: null });
    // The kicker still says what this is; there is no date or separator after it.
    expect(getByTestId('announcement-detail-date')).toHaveTextContent(/^Announcement$/);
  });

  it('shows the announcement image when imageUrl is set', async () => {
    const { getByTestId } = await renderScreen({
      ...ANNOUNCEMENT,
      imageUrl: 'https://example.com/a.jpg',
    });
    expect(getByTestId('announcement-detail-image')).toBeTruthy();
  });
});
