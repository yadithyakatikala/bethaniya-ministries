import React from 'react';
import { Text } from 'react-native';
import { cleanup, render, waitFor } from '@testing-library/react-native';
import { collection, getDocs, limit } from 'firebase/firestore';
import { useLatestMedia } from '../useLatestMedia';

jest.mock('../../../services/firebase/app');

/**
 * Home's "Photos and videos" row looks at the newest few posts and nothing
 * more. It has to stay SMALL: a handful, one read, no listener -- and when
 * there is nothing (or the read fails) it is simply an empty list, never an
 * error on Home. The row itself is TogetherSection's; this is its data.
 */
function mediaDoc(id: string, partial: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      type: 'image',
      mediaUrl: `https://example.org/${id}.jpg`,
      caption: `Caption ${id}`,
      published: true,
      publishAt: new Date('2026-04-01T00:00:00Z'),
      authorName: 'Pastor',
      ...partial,
    }),
  };
}

function Probe({ count }: { count: number }) {
  const posts = useLatestMedia(count);
  return <Text testID="ids">{posts.map((post) => post.id).join(',')}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));
});

afterEach(async () => {
  await cleanup();
});

describe('useLatestMedia', () => {
  it('returns the newest posts it was given', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a'), mediaDoc('b')] });
    const screen = await render(<Probe count={3} />);

    await waitFor(() => expect(screen.getByTestId('ids').props.children).toBe('a,b'));
  });

  it('asks for a HANDFUL, not a feed', async () => {
    // Home must stay cheap to open.
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a')] });
    await render(<Probe count={3} />);

    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(limit).toHaveBeenCalledWith(3);
  });

  it('reads once, and keeps no listener', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mediaDoc('a')] });
    const screen = await render(<Probe count={3} />);
    await waitFor(() => expect(screen.getByTestId('ids').props.children).toBe('a'));

    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  it('is an empty list when the church has posted nothing', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    const screen = await render(<Probe count={3} />);

    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(screen.getByTestId('ids').props.children).toBe('');
  });

  it('is an empty list when the read fails, rather than an error on Home', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (getDocs as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const screen = await render(<Probe count={3} />);

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByTestId('ids').props.children).toBe('');
    warn.mockRestore();
  });

  it('does not set state once the screen is gone', async () => {
    let resolve: (value: { docs: unknown[] }) => void = () => undefined;
    (getDocs as jest.Mock).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const screen = await render(<Probe count={3} />);
    await screen.unmount();
    resolve({ docs: [mediaDoc('late')] });
    await Promise.resolve();

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
