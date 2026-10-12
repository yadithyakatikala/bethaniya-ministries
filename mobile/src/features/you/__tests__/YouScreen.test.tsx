import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { useMemberIdentity } from '../../../context/useMemberIdentity';
import { translate } from '../../../i18n';
import { lightTokens, serifFor } from '../../../theme';
import { YouScreen } from '../YouScreen';

jest.mock('../../../services/firebase/app');
jest.mock('../../../context/useMemberIdentity');
jest.mock('../../../context/AuthContext', () => {
  const actual = jest.requireActual('../../../context/AuthContext');
  return { ...actual, useAuth: jest.fn() };
});
// The two tabs are tested on their own; here they only have to be the right one.
jest.mock('../SavedScreen', () => {
  const { Text } = jest.requireActual('react-native');
  return { SavedScreen: () => <Text testID="saved-tab-stub">Saved tab</Text> };
});
jest.mock('../../profile/ProfileScreen', () => {
  const { Text } = jest.requireActual('react-native');
  return { ProfileScreen: () => <Text testID="profile-tab-stub">Profile tab</Text> };
});

/**
 * You: who the member is at the top (a monogram, a name, an email and
 * whether it is verified), the bell and the sliders at the right, and under
 * it two tabs -- Saved and Profile.
 */
function member(overrides: Record<string, unknown> = {}) {
  (useAuth as jest.Mock).mockReturnValue({
    status: 'authenticated',
    user: {
      uid: 'u1',
      email: 'grace@example.org',
      emailVerified: true,
      phoneNumber: null,
      ...overrides,
    },
  });
}

function named(displayName: string) {
  (useMemberIdentity as jest.Mock).mockReturnValue({
    uid: 'u1',
    displayName,
    canPost: true,
    suspended: false,
  });
}

function ui(tab?: 'saved' | 'profile', navigate = jest.fn()) {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <YouScreen
          navigation={{ navigate } as never}
          route={{ key: 'You', name: 'You', params: tab ? { tab } : undefined } as never}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

async function renderYou(tab?: 'saved' | 'profile') {
  const navigate = jest.fn();
  const utils = await render(ui(tab, navigate));
  return { ...utils, navigate };
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

const HIDDEN = { includeHiddenElements: true } as const;

beforeEach(() => {
  jest.clearAllMocks();
  member();
  named('Grace Rao');
});

afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
});

describe('who the member is', () => {
  it('shows a 72-point monogram of their initial, and no photo', async () => {
    const { getByTestId, queryByRole } = await renderYou();
    const avatar = getByTestId('you-avatar', HIDDEN);
    expect(within(avatar).getByText('G', HIDDEN)).toBeTruthy();
    expect(flat(avatar)).toMatchObject({ width: 72, height: 72, borderRadius: 36 });
    // A letter in a disc: the only child is the initial, and no picture is anywhere.
    expect(avatar.children).toHaveLength(1);
    expect(queryByRole('image', HIDDEN)).toBeNull();
  });

  it('shows their name as the screen’s heading, in the serif at 26/32', async () => {
    const { getByTestId } = await renderYou();
    const name = getByTestId('you-name');
    expect(name).toHaveTextContent('Grace Rao');
    expect(name.props.accessibilityRole).toBe('header');
    expect(flat(name)).toMatchObject({
      fontFamily: serifFor('en', 'semiBold'),
      fontSize: 26,
      lineHeight: 32,
      color: lightTokens.ink,
    });
  });

  it('sets a Telugu name in the Telugu serif, with room for its marks', async () => {
    named('కృపా రావు');
    const { getByTestId } = await renderYou();
    expect(flat(getByTestId('you-name'))).toMatchObject({
      fontFamily: serifFor('te', 'semiBold'),
      fontSize: 24,
      lineHeight: 38,
    });
    // ...and the monogram keeps the vowel sign.
    expect(
      within(getByTestId('you-avatar', HIDDEN)).getByText('కృ', HIDDEN)
    ).toBeTruthy();
  });

  it('keeps a long name to two lines rather than pushing the layout out', async () => {
    named('Elizabeth Alexandra Mary Windsor-Mountbatten the Third of Somewhere');
    const { getByTestId } = await renderYou();
    expect(getByTestId('you-name').props.numberOfLines).toBe(2);
  });

  it('shows the email, and says it is verified when it is', async () => {
    const { getByTestId } = await renderYou();
    expect(getByTestId('you-contact')).toHaveTextContent('grace@example.org');
    expect(getByTestId('you-verified')).toBeTruthy();
    expect(getByTestId('you-verified')).toHaveTextContent(
      translate('en', 'profile.emailVerified')
    );
  });

  it('shows no verified badge for an email that has not been verified: it would be a lie', async () => {
    member({ emailVerified: false });
    const { getByTestId, queryByTestId } = await renderYou();
    expect(getByTestId('you-contact')).toHaveTextContent('grace@example.org');
    expect(queryByTestId('you-verified')).toBeNull();
  });

  it('shows the phone number for a member who signed in by phone, with no verified badge', async () => {
    member({ email: null, emailVerified: false, phoneNumber: '+911234567890' });
    const { getByTestId, queryByTestId } = await renderYou();
    expect(getByTestId('you-contact')).toHaveTextContent('+911234567890');
    expect(queryByTestId('you-verified')).toBeNull();
  });

  it('is shown by their number, then by the word "Member", when they have no name', async () => {
    named('');
    member({ email: null, emailVerified: false, phoneNumber: '+911234567890' });
    const withPhone = await renderYou();
    expect(withPhone.getByTestId('you-name')).toHaveTextContent('+911234567890');
    await withPhone.unmount();

    member({ email: null, emailVerified: false, phoneNumber: null });
    const nothing = await renderYou();
    expect(nothing.getByTestId('you-name')).toHaveTextContent('Member');
    // No contact line at all, rather than an empty one.
    expect(nothing.queryByTestId('you-contact')).toBeNull();
  });
});

describe('the bell and the sliders', () => {
  it('opens Notifications from the bell, as a button with a spoken name', async () => {
    const { getByTestId, navigate } = await renderYou();
    const bell = getByTestId('you-notifications-button');
    expect(bell.props.accessibilityRole).toBe('button');
    expect(bell.props.accessibilityLabel).toBe('Notifications');
    await fireEvent.press(bell);
    expect(navigate).toHaveBeenCalledWith('NotificationCenter');
  });

  it('opens Settings from the sliders', async () => {
    const { getByTestId, navigate } = await renderYou();
    const sliders = getByTestId('you-settings-button');
    expect(sliders.props.accessibilityLabel).toBe('Settings');
    await fireEvent.press(sliders);
    expect(navigate).toHaveBeenCalledWith('Settings');
  });

  it('makes both 44-point round targets', async () => {
    const { getByTestId } = await renderYou();
    for (const id of ['you-notifications-button', 'you-settings-button']) {
      expect(flat(getByTestId(id))).toMatchObject({ width: 44, height: 44 });
    }
  });
});

describe('the two tabs', () => {
  it('is a tablist of Saved and Profile, Saved chosen', async () => {
    const { getByTestId } = await renderYou();
    const tabs = getByTestId('you-tabs');
    expect(tabs.props.accessibilityRole).toBe('tablist');
    expect(getByTestId('you-tabs-saved').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('you-tabs-profile').props.accessibilityState.selected).toBe(false);
  });

  it('shows Saved first, and only Saved', async () => {
    const { getByTestId, queryByTestId } = await renderYou();
    expect(getByTestId('saved-tab-stub')).toBeTruthy();
    expect(queryByTestId('profile-tab-stub')).toBeNull();
  });

  it('opens on Profile when the route asks for it', async () => {
    const { getByTestId, queryByTestId } = await renderYou('profile');
    expect(getByTestId('profile-tab-stub')).toBeTruthy();
    expect(queryByTestId('saved-tab-stub')).toBeNull();
    expect(getByTestId('you-tabs-profile').props.accessibilityState.selected).toBe(true);
  });

  it('switches between them on a tap, and mounts only the one in view', async () => {
    const { getByTestId, queryByTestId } = await renderYou();
    await fireEvent.press(getByTestId('you-tabs-profile'));
    expect(getByTestId('profile-tab-stub')).toBeTruthy();
    expect(queryByTestId('saved-tab-stub')).toBeNull();

    await fireEvent.press(getByTestId('you-tabs-saved'));
    expect(getByTestId('saved-tab-stub')).toBeTruthy();
    expect(queryByTestId('profile-tab-stub')).toBeNull();
  });

  it('moves to Profile when it is navigated to again asking for it (a notification)', async () => {
    const { getByTestId, rerender } = await renderYou();
    await rerender(ui('profile'));
    await waitFor(() => expect(getByTestId('profile-tab-stub')).toBeTruthy());
  });

  it('keeps the header while the tab changes: it is the member, not the tab', async () => {
    const { getByTestId } = await renderYou();
    await fireEvent.press(getByTestId('you-tabs-profile'));
    expect(getByTestId('you-name')).toHaveTextContent('Grace Rao');
    expect(getByTestId('you-notifications-button')).toBeTruthy();
  });

  it('names the Profile tab in Telugu in a Telugu interface', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderYou();
    await waitFor(() =>
      expect(getByTestId('you-tabs-profile').props.accessibilityLabel).toMatch(/[ఀ-౿]/u)
    );
  });
});
