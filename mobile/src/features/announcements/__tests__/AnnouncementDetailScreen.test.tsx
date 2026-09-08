import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
};

/**
 * Only `route.params.announcement` is read by this screen -- same
 * `as never` convention as SongDetailScreen.test.tsx for the rest of
 * NativeStackScreenProps' shape. Wrapped in AuthProvider/
 * PreferencesProvider since it reads useTheme().
 */
async function renderScreen(announcement: PublishedAnnouncement = ANNOUNCEMENT) {
  return await render(
    <AuthProvider>
      <PreferencesProvider>
        <AnnouncementDetailScreen
          navigation={{} as never}
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

  it('shows a formatted date when createdAt is set', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('announcement-detail-date')).toHaveTextContent(
      'September 14, 2026'
    );
  });

  it('omits the date when createdAt is null', async () => {
    const { queryByTestId } = await renderScreen({ ...ANNOUNCEMENT, createdAt: null });
    expect(queryByTestId('announcement-detail-date')).toBeNull();
  });

  it('shows the announcement image when imageUrl is set', async () => {
    const { getByTestId } = await renderScreen({
      ...ANNOUNCEMENT,
      imageUrl: 'https://example.com/a.jpg',
    });
    expect(getByTestId('announcement-detail-image')).toBeTruthy();
  });
});
