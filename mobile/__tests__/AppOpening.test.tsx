import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import * as SplashScreen from 'expo-splash-screen';
import App from '../App';
import {
  installAnimatedDriver,
  type AnimatedDriver,
} from '../src/testing/animatedDriver';
import { installFrameClock, type FrameClock } from '../src/testing/frameClock';

jest.mock('../src/services/firebase/app');
jest.mock('../src/features/auth/useGoogleSignIn');
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
}));

/**
 * The opening at the level the person meets it: over the real App.
 *
 * What matters here is the wiring -- that the film sits on top of an app
 * which is already loading beneath it, that skipping it leaves the app
 * exactly as the auth state selected it, and that the native splash is
 * held for it. The film itself is covered in src/features/opening.
 */
let clock: FrameClock;
let driver: AnimatedDriver;

beforeEach(() => {
  clock = installFrameClock();
  driver = installAnimatedDriver();
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(null); // signed out: the app resolves to the sign-in screen
    return jest.fn();
  });
});

afterEach(async () => {
  await cleanup();
  clock.restore();
  driver.restore();
  (onAuthStateChanged as jest.Mock).mockReset();
});

describe('the opening over the app', () => {
  it('holds the native splash from the moment the app loads', () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });

  it('plays over an app that is already loading underneath it', async () => {
    const { getByTestId, queryByTestId } = await render(<App />);
    expect(getByTestId('opening-overlay')).toBeTruthy();
    // The app is there, beneath the film (hidden from screen readers while
    // the film is up, which is why it has to be asked for explicitly).
    await waitFor(() =>
      expect(getByTestId('sign-in-screen', { includeHiddenElements: true })).toBeTruthy()
    );
    // ...and is NOT reachable through the accessibility tree until the film leaves.
    expect(queryByTestId('sign-in-screen')).toBeNull();
  });

  it('leaves the app exactly as the auth state selected it once skipped', async () => {
    const { getByTestId, queryByTestId } = await render(<App />);
    await waitFor(() =>
      expect(getByTestId('sign-in-screen', { includeHiddenElements: true })).toBeTruthy()
    );
    await fireEvent.press(getByTestId('opening-skip'));
    await act(async () => driver.completeNext());

    expect(queryByTestId('opening-overlay')).toBeNull();
    expect(getByTestId('sign-in-screen')).toBeTruthy();
    // Nothing is still asking for animation frames: the film is gone, not paused.
    await act(async () => clock.run(5));
    expect(clock.pending()).toBe(0);
  });

  it('does not come back during the same launch', async () => {
    const { getByTestId, queryByTestId, rerender } = await render(<App />);
    await fireEvent.press(getByTestId('opening-skip'));
    await act(async () => driver.completeNext());
    await rerender(<App />);
    expect(queryByTestId('opening-overlay')).toBeNull();
  });
});
