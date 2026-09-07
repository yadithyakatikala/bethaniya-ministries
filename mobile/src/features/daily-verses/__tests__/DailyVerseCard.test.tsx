import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { onSnapshot } from 'firebase/firestore';
import { DailyVerseCard } from '../DailyVerseCard';

jest.mock('../../../services/firebase/app');

describe('DailyVerseCard', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows a loading state before the first snapshot arrives', async () => {
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId } = await render(<DailyVerseCard />);
    expect(getByTestId('daily-verse-loading')).toBeTruthy();
  });

  it('shows an empty state when no verse is set for today', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({ docs: [] });
      return jest.fn();
    });
    const { getByTestId } = await render(<DailyVerseCard />);
    await waitFor(() => expect(getByTestId('daily-verse-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, _next, err) => {
      err({ code: 'unavailable' });
      return jest.fn();
    });
    const { getByTestId } = await render(<DailyVerseCard />);
    await waitFor(() => expect(getByTestId('daily-verse-error')).toBeTruthy());
  });

  it("renders today's verse text and reference", async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'For God so loved the world...',
              imageUrl: null,
              date: '2026-09-07',
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByText, queryByTestId } = await render(<DailyVerseCard />);
    await waitFor(() => expect(getByText('For God so loved the world...')).toBeTruthy());
    expect(getByText('John 3:16')).toBeTruthy();
    expect(queryByTestId('daily-verse-image')).toBeNull();
  });

  it('renders the image when imageUrl is set', async () => {
    (onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      next({
        docs: [
          {
            id: 'v1',
            data: () => ({
              reference: 'John 3:16',
              text: 'Text',
              imageUrl: 'https://example.com/verse.jpg',
              date: '2026-09-07',
            }),
          },
        ],
      });
      return jest.fn();
    });
    const { getByTestId } = await render(<DailyVerseCard />);
    await waitFor(() => expect(getByTestId('daily-verse-image')).toBeTruthy());
  });
});
