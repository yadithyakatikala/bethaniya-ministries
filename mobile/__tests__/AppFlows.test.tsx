import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import App from '../App';
import { useVerseOfTheDay } from '../src/features/daily-verses/useVerseOfTheDay';

jest.mock('../src/services/firebase/app');
jest.mock('../src/features/auth/useGoogleSignIn');
jest.mock('../src/features/opening', () => ({ OpeningOverlay: () => null }));
// The verse's own resolving is tested elsewhere; here it only has to be there for Home to show it.
jest.mock('../src/features/daily-verses/useVerseOfTheDay');

/**
 * THE REDESIGNED APP, END TO END.
 *
 * Every other suite renders one screen, or one piece of the navigator, on its
 * own. This one renders the WHOLE app -- the real `App`, its real gates, the
 * real navigator and the real screens -- with only Firebase mocked, and moves
 * through it the way a member does: between the five tabs, into a pushed screen
 * and back, into Settings and the legal pages and back. It is the place a wrong
 * route name, a hidden header, a tab bar that does not come back, or a screen
 * that is registered but unreachable would show up.
 *
 * What it does NOT prove: that anything looks right (the browser QA does that),
 * or how it feels on a phone.
 */
const SIGNED_IN = {
  uid: 'user-1',
  displayName: 'Test User',
  email: null,
  phoneNumber: null,
};

const COMPLETED_PROFILE = {
  role: 'member',
  displayName: 'Test User',
  gender: 'male',
  phoneNumber: '9876543210',
  profileCompletedAt: new Date('2026-01-01T00:00:00Z'),
};

/** Answers ONLY the profile document, as ./App.test.tsx does: every other listener is left waiting. */
function mockProfile(data: Record<string, unknown>) {
  (onSnapshot as jest.Mock).mockImplementation((ref, next) => {
    const path = (ref as { path?: string } | undefined)?.path ?? '';
    if (!path.startsWith('users/')) return jest.fn();
    next({ exists: () => true, id: 'user-1', data: () => data });
    return jest.fn();
  });
}

function signIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(SIGNED_IN);
    return jest.fn();
  });
}

async function openApp() {
  signIn();
  mockProfile(COMPLETED_PROFILE);
  const view = await render(<App />);
  await waitFor(() => expect(view.getByTestId('home-screen')).toBeTruthy());
  return view;
}

beforeEach(() => {
  (useVerseOfTheDay as jest.Mock).mockReturnValue({
    status: 'ready',
    dateKey: '2026-10-11',
    content: {
      source: 'fallback',
      reference: 'Matthew 16:24',
      body: { kind: 'text', language: 'en', text: 'Then Jesus said to his disciples...' },
      imageUrl: null,
      label: '24',
      citation: { bookName: 'Matthew', chapter: 16, label: '24' },
      location: { bookId: 'matthew', chapter: 16, verse: 24 },
    },
  });
});

afterEach(() => {
  (onAuthStateChanged as jest.Mock).mockReset();
  (onSnapshot as jest.Mock).mockReset();
});

describe('the five tabs', () => {
  it('opens each tab’s own screen, and keeps the bar while it does', async () => {
    const { getByTestId } = await openApp();
    expect(getByTestId('tab-bar')).toBeTruthy();

    for (const [tab, screen] of [
      ['tab-bible', 'bible-home'],
      ['tab-prayers', 'prayers-hub'],
      ['tab-community', 'community-hub'],
      ['tab-you', 'you-screen'],
    ] as const) {
      await fireEvent.press(getByTestId(tab));
      await waitFor(() => expect(getByTestId(screen)).toBeTruthy());
      expect(getByTestId('tab-bar')).toBeTruthy();
    }
  });

  it('marks the tab it is on as selected, and moves the mark when the member moves', async () => {
    const { getByTestId } = await openApp();
    expect(getByTestId('tab-home').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(getByTestId('tab-prayers'));
    await waitFor(() =>
      expect(getByTestId('tab-prayers').props.accessibilityState.selected).toBe(true)
    );
    expect(getByTestId('tab-home').props.accessibilityState.selected).toBe(false);
  });
});

describe('a pushed screen and back', () => {
  it('opens the Verse of the Day from Home, takes the bar away there, and gives it back on Back', async () => {
    const { getByTestId, queryByTestId, getAllByTestId } = await openApp();
    await fireEvent.press(getByTestId('daily-verse-see-all'));
    await waitFor(() => expect(getByTestId('daily-verse-screen')).toBeTruthy());
    // A pushed screen draws its own top bar and hides the tab bar.
    expect(queryByTestId('tab-bar')).toBeNull();
    expect(getByTestId('daily-verse-top-bar-back')).toBeTruthy();

    await fireEvent.press(getByTestId('daily-verse-top-bar-back'));
    await waitFor(() => expect(getByTestId('tab-bar')).toBeTruthy());
    expect(getAllByTestId('home-screen').length).toBeGreaterThan(0);
    expect(queryByTestId('daily-verse-screen')).toBeNull();
  });

  it('opens Settings from You, then the Privacy policy and the Terms, and comes back from each', async () => {
    const { getByTestId, queryByTestId, getAllByTestId } = await openApp();
    await fireEvent.press(getByTestId('tab-you'));
    await waitFor(() => expect(getByTestId('you-screen')).toBeTruthy());

    await fireEvent.press(getByTestId('you-settings-button'));
    await waitFor(() => expect(getByTestId('settings-screen')).toBeTruthy());
    expect(queryByTestId('tab-bar')).toBeNull();

    await fireEvent.press(getByTestId('settings-privacy-policy-row'));
    await waitFor(() => expect(getByTestId('legal-screen')).toBeTruthy());
    expect(getByTestId('legal-screen-title').props.children).toBe('Privacy policy');
    // Its own top bar, no platform header; the last Back on the stack is this page's.
    const backFromPrivacy = getAllByTestId('top-bar-back');
    await fireEvent.press(backFromPrivacy[backFromPrivacy.length - 1]);
    await waitFor(() => expect(queryByTestId('legal-screen')).toBeNull());
    expect(getByTestId('settings-screen')).toBeTruthy();

    await fireEvent.press(getByTestId('settings-terms-row'));
    await waitFor(() => expect(getByTestId('legal-screen')).toBeTruthy());
    expect(getByTestId('legal-screen-title').props.children).toBe('Terms of service');
    const backFromTerms = getAllByTestId('top-bar-back');
    await fireEvent.press(backFromTerms[backFromTerms.length - 1]);
    await waitFor(() => expect(queryByTestId('legal-screen')).toBeNull());
    expect(getByTestId('settings-screen')).toBeTruthy();
  });
});

describe('the states that stand in front of the app', () => {
  it('stops a suspended member at the notice: no tab bar, no home, nowhere to go but Sign out', async () => {
    signIn();
    mockProfile({
      ...COMPLETED_PROFILE,
      accountStatus: 'suspended',
      suspension: { kind: 'permanent', startedAt: null, expiresAt: null },
    });
    const { getByTestId, queryByTestId } = await render(<App />);
    await waitFor(() => expect(getByTestId('suspended-screen')).toBeTruthy());
    expect(queryByTestId('tab-bar')).toBeNull();
    expect(queryByTestId('home-screen')).toBeNull();
    expect(getByTestId('suspended-sign-out')).toBeTruthy();
  });

  it('shows the redesigned sign-in to someone who is signed out, with the portrait and the name', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
      onNext(null);
      return jest.fn();
    });
    const { getByTestId } = await render(<App />);
    await waitFor(() => expect(getByTestId('sign-in-screen')).toBeTruthy());
    expect(
      getByTestId('sign-in-wordmark', { includeHiddenElements: true }).props.children
    ).toBe('MARANATHA');
    expect(getByTestId('sign-in-title').props.children).toBe('Sign in to Maranatha');
  });

  it('shows the redesigned loading screen until Firebase has answered', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
    const { getByTestId, queryByTestId } = await render(<App />);
    expect(getByTestId('auth-loading-screen')).toBeTruthy();
    expect(
      getByTestId('auth-loading-portrait', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(queryByTestId('sign-in-screen')).toBeNull();
  });
});
