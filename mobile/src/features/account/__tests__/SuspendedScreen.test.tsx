import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n';
import { lightTokens } from '../../../theme';
import {
  subscribeToChurchSettings,
  type ChurchSettings,
} from '../../../services/firebase/settings';
import type { MemberSuspension } from '../../../services/firebase/userProfile';
import { SuspendedScreen } from '../SuspendedScreen';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/settings');

/**
 * THE NOTICE'S LOOK AND WORDS -- the parts ./SuspensionGate.test.tsx does not
 * cover. The gate's tests pin WHEN a member sees this screen (and that closing
 * the app does not get past it); these pin WHAT it says and how it reads.
 *
 * What it must never say is as important as what it says: no reason an
 * administrator recorded, and no date at all for a permanent suspension.
 */
const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

type Instance = { props: Record<string, unknown>; parent: Instance | null };

/** The nearest ancestor (or the node itself) that is a live region, or null. */
function liveRegionAround(node: Instance | null): Instance | null {
  for (let at = node; at; at = at.parent) {
    if (at.props.accessibilityLiveRegion) return at;
  }
  return null;
}

const TEMPORARY: MemberSuspension = {
  kind: 'temporary',
  startedAt: null,
  // 14 October 2026, 6:30 PM on the clock of whoever runs the test.
  expiresAt: new Date(2026, 9, 14, 18, 30),
};
const PERMANENT: MemberSuspension = {
  kind: 'permanent',
  startedAt: null,
  expiresAt: null,
};

function churchSays(settings: Partial<ChurchSettings> | null) {
  (subscribeToChurchSettings as jest.Mock).mockImplementation((next) => {
    next(
      settings === null
        ? null
        : { churchName: '', logoUrl: '', description: '', supportEmail: '', ...settings }
    );
    return jest.fn();
  });
}

function renderNotice(suspension: MemberSuspension | null) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <SuspendedScreen suspension={suspension} />
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  churchSays({});
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'member-1', displayName: 'Asha', email: null, phoneNumber: null });
    return jest.fn();
  });
});

afterEach(async () => {
  await AsyncStorage.clear();
});

describe('what the notice says', () => {
  it('has a title that is a heading, so a screen reader opens on what happened', async () => {
    const { getByTestId } = await renderNotice(PERMANENT);
    const title = getByTestId('suspended-title');
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props.children).toBe('Your account is suspended');
  });

  it('is announced when it appears -- a polite live region around the words', async () => {
    const { getByTestId } = await renderNotice(PERMANENT);
    const region = liveRegionAround(getByTestId('suspended-title') as Instance);
    expect(region?.props.accessibilityLiveRegion).toBe('polite');
    // ...and the date and both sentences are inside it, with the title.
    expect(liveRegionAround(getByTestId('suspended-message') as Instance)).toBe(region);
  });

  it('says the suspension unlocks by itself, when it does, and names the day and the hour it ends', async () => {
    const { getByTestId } = await renderNotice(TEMPORARY);
    expect(getByTestId('suspended-message').props.children).toBe(
      translate('en', 'suspended.temporaryMessage')
    );
    // Day first, the month spelled out, then the clock: "14 October 2026, 6:30 PM".
    expect(getByTestId('suspended-until').props.children).toMatch(
      /^Until 14 October 2026, 6:30\sPM$/
    );
  });

  it('sets the date in the warning colour on its tint -- not white on cream, which is what the old screen did', async () => {
    const { getByTestId } = await renderNotice(TEMPORARY);
    const words = flat(getByTestId('suspended-until'));
    expect(words.color).toBe(lightTokens.warning);
    // `onWarning` is the label ON a solid warning fill: white, invisible on this tint.
    expect(words.color).not.toBe(lightTokens.onWarning);
    expect(flat(getByTestId('suspended-until').parent!).backgroundColor).toBe(
      lightTokens.warningTint
    );
  });

  it('says there is no end, and invents no date, for a permanent suspension', async () => {
    const { getByTestId, queryByTestId, queryByText } = await renderNotice(PERMANENT);
    expect(getByTestId('suspended-message').props.children).toBe(
      translate('en', 'suspended.permanentMessage')
    );
    expect(queryByTestId('suspended-until')).toBeNull();
    expect(queryByText(/^Until /)).toBeNull();
  });

  it('shows no date for a suspension it was given none for', async () => {
    const { queryByTestId } = await renderNotice(null);
    expect(queryByTestId('suspended-until')).toBeNull();
  });

  it('says nothing is deleted and to speak to someone at church -- and nothing else about why', async () => {
    const { getByText } = await renderNotice(PERMANENT);
    expect(getByText(translate('en', 'suspended.canStillRead'))).toBeTruthy();
    expect(getByText(translate('en', 'suspended.contactChurch'))).toBeTruthy();
  });

  it('marks the pause as decoration: the title carries the meaning', async () => {
    const { toJSON } = await renderNotice(PERMANENT);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"accessibilityElementsHidden":true');
  });

  it('is in Telugu under a Telugu interface, with the date day-first', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderNotice(TEMPORARY);
    await waitFor(() =>
      expect(getByTestId('suspended-title').props.children).toBe(
        translate('te', 'suspended.title')
      )
    );
    const until = String(getByTestId('suspended-until').props.children);
    expect(
      until.endsWith('వరకు') ||
        until.startsWith(translate('te', 'suspended.until', { when: '' }).trim())
    ).toBe(true);
    expect(until).toContain('14');
    expect(until).toContain('2026');
  });
});

describe('the church’s contact', () => {
  it('shows the support email as plain text under "Contact the church", when the church has set one', async () => {
    churchSays({ supportEmail: 'office@maranatha.example' });
    const { getByTestId, getByText } = await renderNotice(PERMANENT);
    await waitFor(() => expect(getByTestId('suspended-contact')).toBeTruthy());
    expect(getByText('Contact the church')).toBeTruthy();
    const email = getByTestId('suspended-contact-email');
    expect(email.props.children).toBe('office@maranatha.example');
    // Words a member can press and hold to copy -- NOT a link: this app has no support inbox.
    expect(email.props.selectable).toBe(true);
    expect(email.props.onPress).toBeUndefined();
    expect(email.props.accessibilityRole).not.toBe('link');
  });

  it('shows no row at all when the church has set none', async () => {
    churchSays({ supportEmail: '' });
    const { queryByTestId, queryByText } = await renderNotice(PERMANENT);
    expect(queryByTestId('suspended-contact')).toBeNull();
    expect(queryByText('Contact the church')).toBeNull();
  });

  it('shows no row when the church’s settings do not exist, or cannot be read', async () => {
    churchSays(null);
    const missing = await renderNotice(PERMANENT);
    expect(missing.queryByTestId('suspended-contact')).toBeNull();
    await missing.unmount();

    (subscribeToChurchSettings as jest.Mock).mockImplementation((_next, onError) => {
      onError(new Error('offline'));
      return jest.fn();
    });
    const failed = await renderNotice(PERMANENT);
    expect(failed.queryByTestId('suspended-contact')).toBeNull();
  });

  it('has the email arrive later without re-announcing the notice: the row is outside the live region', async () => {
    let deliver: (settings: ChurchSettings) => void = () => undefined;
    (subscribeToChurchSettings as jest.Mock).mockImplementation((next) => {
      deliver = next;
      return jest.fn();
    });
    const { getByTestId, queryByTestId } = await renderNotice(PERMANENT);
    expect(queryByTestId('suspended-contact')).toBeNull();
    await act(async () =>
      deliver({
        churchName: '',
        logoUrl: '',
        description: '',
        supportEmail: 'office@x.org',
      })
    );
    const region = liveRegionAround(getByTestId('suspended-title') as Instance);
    expect(region?.props.accessibilityLiveRegion).toBe('polite');
    expect(getByTestId('suspended-contact')).toBeTruthy();
    // The row is NOT inside the region that is announced: no live region wraps it.
    expect(liveRegionAround(getByTestId('suspended-contact') as Instance)).toBeNull();
  });

  it('stops listening when the notice goes away', async () => {
    const stop = jest.fn();
    (subscribeToChurchSettings as jest.Mock).mockImplementation(() => stop);
    const { unmount } = await renderNotice(PERMANENT);
    expect(stop).not.toHaveBeenCalled();
    await unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('Sign out', () => {
  it('is the one action, and it signs the member out', async () => {
    const { getByTestId } = await renderNotice(PERMANENT);
    const button = getByTestId('suspended-sign-out');
    expect(button.props.accessibilityRole).toBe('button');
    await fireEvent.press(button);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('sits at the foot of the screen, apart from the words, under a hairline', async () => {
    const { getByTestId } = await renderNotice(PERMANENT);
    // The nearest ancestor that draws the line above the button.
    let foot: Instance | null = getByTestId('suspended-sign-out') as Instance;
    while (foot && flat(foot as { props: { style?: unknown } }).borderTopWidth !== 1) {
      foot = foot.parent;
    }
    expect(foot).not.toBeNull();
    expect(flat(foot as { props: { style?: unknown } }).borderTopColor).toBe(
      lightTokens.border
    );
    // The words are not in it: it holds the button and nothing else of the notice.
    let words: Instance | null = getByTestId('suspended-title') as Instance;
    while (words) {
      expect(words).not.toBe(foot);
      words = words.parent;
    }
  });
});
