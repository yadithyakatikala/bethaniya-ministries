import React from 'react';
import { Text, View } from 'react-native';
import { cleanup, render, waitFor } from '@testing-library/react-native';
import { fetchCurrentProphetVerse } from '../../../services/firebase/prophetVerses';
import { useProphetVerse } from '../useProphetVerse';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/prophetVerses');

/**
 * The hook's job is a SINGLE fetch and an honest answer. Two things are
 * pinned here: it does not poll (one read per app open, not one a
 * minute), and a failed read is `empty` rather than an error -- the
 * Prophet Verse is a secondary block, and an error panel where a
 * devotional should be is worse than no section at all.
 */
const VERSE = {
  id: 'p1',
  title: 'A word',
  reference: 'Isaiah 43:19',
  text: 'Behold.',
  attribution: null,
  imageUrl: null,
  publishAt: new Date('2026-04-01T06:00:00.000Z'),
};

function Probe() {
  const state = useProphetVerse();
  return (
    <View>
      <Text testID="status">{state.status}</Text>
      {state.status === 'ready' ? <Text testID="title">{state.verse.title}</Text> : null}
    </View>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
});

describe('the current prophet verse', () => {
  it('fetches once and reports the verse', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValue(VERSE);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    expect(screen.getByTestId('title').props.children).toBe('A word');
    // One read per app open. A poll would cost a read a minute per device.
    expect(fetchCurrentProphetVerse).toHaveBeenCalledTimes(1);
  });

  it('reports empty when the church has published none', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockResolvedValue(null);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('empty')
    );
  });

  it('reports empty -- not an error -- when the read fails', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockRejectedValue(new Error('offline'));
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('empty')
    );
  });

  it('is loading until the fetch settles, rather than flashing empty first', async () => {
    (fetchCurrentProphetVerse as jest.Mock).mockReturnValue(new Promise(() => {}));
    const screen = await render(<Probe />);
    expect(screen.getByTestId('status').props.children).toBe('loading');
  });
});
