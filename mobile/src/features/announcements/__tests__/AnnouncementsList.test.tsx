import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { onSnapshot } from 'firebase/firestore';
import { AnnouncementsList } from '../AnnouncementsList';

jest.mock('../../../services/firebase/app');

describe('AnnouncementsList', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state before the first snapshot arrives', async () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await render(<AnnouncementsList />);
    expect(getByTestId('announcements-loading')).toBeTruthy();
  });

  it('shows an empty state when there are no published announcements', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await render(<AnnouncementsList />);
    await waitFor(() => expect(getByTestId('announcements-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await render(<AnnouncementsList />);
    await waitFor(() => expect(getByTestId('announcements-error')).toBeTruthy());
  });

  it('renders each published announcement', async () => {
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
              createdAt: null,
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText } = await render(<AnnouncementsList />);
    await waitFor(() => expect(getByText('Sunday Service')).toBeTruthy());
    expect(getByText('Join us at 10am.')).toBeTruthy();
  });
});
