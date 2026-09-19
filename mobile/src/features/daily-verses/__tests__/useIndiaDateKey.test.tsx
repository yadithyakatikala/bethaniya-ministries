import React from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, cleanup, render } from '@testing-library/react-native';
import { DATE_ROLLOVER_CHECK_MS, useIndiaDateKey } from '../useIndiaDateKey';

/**
 * A phone is left open across midnight as a matter of course, so the one
 * thing worth pinning here is that the date actually advances -- and that
 * it advances on BOTH triggers, since a timer does not fire reliably in
 * the background and a lifecycle event never arrives for an app that
 * simply sits in the foreground.
 *
 * ONE RENDER PER TEST, no explicit unmount: RNTL 14 in this repo leaves
 * every render after an unmount() unable to find its own tree -- see
 * ../../bible/reader/__tests__/useReadingPosition.test.tsx.
 */
let current = '2026-04-03';
const now = () => current;

function Probe() {
  return <Text testID="date">{useIndiaDateKey(now)}</Text>;
}

beforeEach(() => {
  current = '2026-04-03';
  jest.useFakeTimers();
});

afterEach(async () => {
  await cleanup();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('keeping the canonical date current', () => {
  it('starts at today and advances when the timer notices the rollover', async () => {
    const screen = await render(<Probe />);
    expect(screen.getByTestId('date').props.children).toBe('2026-04-03');

    current = '2026-04-04';
    // Nothing has ticked yet, so nothing has changed.
    expect(screen.getByTestId('date').props.children).toBe('2026-04-03');

    await act(async () => {
      jest.advanceTimersByTime(DATE_ROLLOVER_CHECK_MS);
    });
    expect(screen.getByTestId('date').props.children).toBe('2026-04-04');
  });

  it('advances when the app comes back to the foreground', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler: (state: AppStateStatus) => void) => {
        listeners.push(handler);
        return { remove: jest.fn() } as never;
      });

    const screen = await render(<Probe />);
    current = '2026-04-04';

    // 'background' is not a reason to re-read the date.
    await act(async () => {
      listeners.forEach((handler) => handler('background'));
    });
    expect(screen.getByTestId('date').props.children).toBe('2026-04-03');

    await act(async () => {
      listeners.forEach((handler) => handler('active'));
    });
    expect(screen.getByTestId('date').props.children).toBe('2026-04-04');
  });

  it('holds the same date across many ticks while the date has not changed', async () => {
    const screen = await render(<Probe />);
    await act(async () => {
      jest.advanceTimersByTime(DATE_ROLLOVER_CHECK_MS * 10);
    });
    // Ten ticks, no change: setState with the same string is a no-op for
    // React, which is why the hook needs no "has it changed" bookkeeping.
    expect(screen.getByTestId('date').props.children).toBe('2026-04-03');
  });
});
