import React from 'react';
import { Text, View } from 'react-native';
import { cleanup, render, waitFor } from '@testing-library/react-native';
import { subscribeToTodaysDailyVerse } from '../../../services/firebase/dailyVerses';
import { usePreferences } from '../../../context/PreferencesContext';
import { indiaDateKey } from '../votdDate';
import { loadVotdAutomation } from '../votdAutomation';
import { useVerseOfTheDay } from '../useVerseOfTheDay';
import type { VersePoolEntry } from '../votdSelection';

// Building the automation mock still loads its import graph, which reaches
// the real Firebase initialization -- mocked away here exactly as every
// other service test does.
jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/dailyVerses');
jest.mock('../../../context/PreferencesContext');
jest.mock('../votdAutomation');

/**
 * The hook is plumbing -- the deciding is in ../votdResolver.ts, tested
 * there. What is worth pinning HERE is what the plumbing promises:
 *
 *   * the canonical Indian date is what is asked for, not the device's;
 *   * a failed read is not an error state, it is the bundled fallback;
 *   * an override that has already arrived does not wait on a fetch.
 */
const POOL: VersePoolEntry[] = [
  {
    id: 'a',
    reference: 'Romans 8:28',
    bookId: 'romans',
    chapter: 8,
    verse: 28,
    order: 0,
    active: true,
  },
];

const CONFIG = {
  enabled: true,
  seed: 'maranatha',
  poolVersion: 1,
  timezone: 'Asia/Kolkata',
};

function Probe() {
  const state = useVerseOfTheDay();
  return (
    <View>
      <Text testID="status">{state.status}</Text>
      {state.status === 'ready' ? (
        <>
          <Text testID="source">{state.content.source}</Text>
          <Text testID="reference">{state.content.reference}</Text>
          <Text testID="body">
            {state.content.body.kind === 'text'
              ? state.content.body.text
              : state.content.body.kind}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** Hands the subscriber its first value, and returns the date it asked for. */
function mockOverride(
  verse: Parameters<Parameters<typeof subscribeToTodaysDailyVerse>[0]>[0]
) {
  const asked: (() => string)[] = [];
  (subscribeToTodaysDailyVerse as jest.Mock).mockImplementation(
    (onNext: (v: unknown) => void, _onError: unknown, getToday: () => string) => {
      asked.push(getToday);
      onNext(verse);
      return jest.fn();
    }
  );
  return asked;
}

beforeEach(() => {
  jest.clearAllMocks();
  (usePreferences as jest.Mock).mockReturnValue({ bibleMode: 'en', appLanguage: 'en' });
  (loadVotdAutomation as jest.Mock).mockResolvedValue({ config: CONFIG, pool: POOL });
  mockOverride(null);
});

afterEach(async () => {
  await cleanup();
});

describe('the verse of the day, as the card sees it', () => {
  it('asks for the CANONICAL Indian date, not the device date', async () => {
    const asked = mockOverride(null);
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    // Passing the function itself (rather than a captured string) is what
    // lets the listener's own midnight rollover stay correct.
    expect(asked[0]).toBe(indiaDateKey);
    expect(loadVotdAutomation).toHaveBeenCalledWith(indiaDateKey());
  });

  it('shows the automated verse when no override exists', async () => {
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    expect(screen.getByTestId('source').props.children).toBe('pool');
    expect(screen.getByTestId('reference').props.children).toBe('Romans 8:28');
  });

  it("shows an administrator's override, and does not wait for the pool to load", async () => {
    // A fetch that never resolves: the override is a complete answer on
    // its own, so making the member wait for it would be pointless.
    (loadVotdAutomation as jest.Mock).mockReturnValue(new Promise(() => {}));
    mockOverride({
      id: '1',
      date: indiaDateKey(),
      reference: 'Isaiah 53:5',
      text: 'But he was pierced',
      imageUrl: null,
    });
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    expect(screen.getByTestId('source').props.children).toBe('override');
    expect(screen.getByTestId('body').props.children).toBe('But he was pierced');
  });

  it('falls back to a real bundled verse when the configuration cannot be read', async () => {
    // Offline in a village with no signal. An error message where the
    // verse of the day belongs is the one outcome this must not produce.
    (loadVotdAutomation as jest.Mock).mockRejectedValue(new Error('offline'));
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    expect(screen.getByTestId('source').props.children).toBe('fallback');
    expect(String(screen.getByTestId('body').props.children).length).toBeGreaterThan(10);
  });

  it('falls back when the override listener itself errors', async () => {
    (subscribeToTodaysDailyVerse as jest.Mock).mockImplementation(
      (_onNext: unknown, onError: (e: unknown) => void) => {
        onError({ code: 'permission-denied' });
        return jest.fn();
      }
    );
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    // The automated verse is still a perfectly good answer; the member
    // never needs to know an override could not be read.
    expect(screen.getByTestId('source').props.children).toBe('pool');
  });

  it('waits before deciding, rather than flashing the fallback first', async () => {
    let release: (value: unknown) => void = () => {};
    (loadVotdAutomation as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const screen = await render(<Probe />);
    expect(screen.getByTestId('status').props.children).toBe('loading');
    release({ config: CONFIG, pool: POOL });
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    expect(screen.getByTestId('source').props.children).toBe('pool');
  });

  it('renders the member’s own Bible mode, independently of the interface language', async () => {
    (usePreferences as jest.Mock).mockReturnValue({ bibleMode: 'te', appLanguage: 'en' });
    const screen = await render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId('status').props.children).toBe('ready')
    );
    // Telugu book name, because in a single-language mode the reference
    // belongs to the scripture -- not to the English interface.
    expect(screen.getByTestId('reference').props.children).not.toContain('Romans');
  });
});
