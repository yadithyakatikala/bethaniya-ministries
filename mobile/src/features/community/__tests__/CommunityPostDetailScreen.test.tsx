import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { CommunityPostDetailScreen } from '../CommunityPostDetailScreen';
import type { PublishedCommunityPost } from '../../../services/firebase/communityPosts';

jest.mock('../../../services/firebase/app');

const POST: PublishedCommunityPost = {
  id: 'p1',
  title: 'A testimony',
  content: 'What the Lord has done in our family this year.\n\nWe give Him thanks.',
  imageUrl: null,
  // Local noon of a day in an earlier year: the same date in every timezone, and
  // old enough that the screen spells the year out whatever today is.
  createdAt: new Date(2020, 2, 1, 12, 0),
};

/**
 * Only `route.params.post` and `navigation.goBack` are read by this screen --
 * same `as never` convention as AnnouncementDetailScreen.test.tsx. It is the
 * same SCREEN as an announcement's (../../updates/UpdateDetail.tsx), labelled
 * for what it is.
 */
async function renderScreen(post: PublishedCommunityPost = POST, goBack = jest.fn()) {
  return await render(
    <AuthProvider>
      <PreferencesProvider>
        <CommunityPostDetailScreen
          navigation={{ goBack } as never}
          route={
            {
              key: 'CommunityPostDetail',
              name: 'CommunityPostDetail',
              params: { post },
            } as never
          }
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('CommunityPostDetailScreen', () => {
  it('shows the title and every paragraph of the post', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('community-post-detail-screen')).toBeTruthy());
    expect(getByTestId('community-post-detail-title')).toHaveTextContent('A testimony');
    expect(getByTestId('community-post-detail-content')).toHaveTextContent(
      'What the Lord has done in our family this year.We give Him thanks.'
    );
    expect(getByTestId('community-post-detail-content').children).toHaveLength(2);
  });

  it('is labelled "From the church", with the date spelt out', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('community-post-detail-date')).toHaveTextContent(
      'From the church  ·  March 1, 2020'
    );
  });

  it('omits the date when createdAt is null', async () => {
    const { getByTestId } = await renderScreen({ ...POST, createdAt: null });
    expect(getByTestId('community-post-detail-date')).toHaveTextContent(
      /^From the church$/
    );
  });

  it('shows the post’s picture when it has one, and none when it does not', async () => {
    const withPicture = await renderScreen({
      ...POST,
      imageUrl: 'https://example.org/p.jpg',
    });
    expect(withPicture.getByTestId('community-post-detail-image').props.source).toEqual({
      uri: 'https://example.org/p.jpg',
    });
    await withPicture.unmount();

    const without = await renderScreen();
    expect(without.queryByTestId('community-post-detail-image')).toBeNull();
  });

  it('goes back when Back is pressed', async () => {
    const goBack = jest.fn();
    const { getByTestId } = await renderScreen(POST, goBack);
    await fireEvent.press(getByTestId('top-bar-back'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
