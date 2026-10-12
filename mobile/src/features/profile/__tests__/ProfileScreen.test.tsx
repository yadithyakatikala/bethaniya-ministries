import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('../../../services/firebase/app');

const TEST_USER = {
  uid: 'user-1',
  displayName: 'Jane Doe',
  email: null,
  phoneNumber: null,
};

function mockSignedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(TEST_USER);
    return jest.fn();
  });
}

/** Signs in with extra/overridden User fields -- used by the email
 * verification tests, since TEST_USER deliberately has no email address
 * (which keeps the verification block absent for every other test). */
function mockSignedInAs(overrides: Record<string, unknown>) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ ...TEST_USER, ...overrides });
    return jest.fn();
  });
}

function mockProfileSnapshot(data: Record<string, unknown> | null) {
  (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
    if (data === null) {
      next({ exists: () => false });
    } else {
      next({ exists: () => true, id: 'user-1', data: () => data });
    }
    return jest.fn();
  });
}

/** The Profile view is a tab of You, so it needs no navigator of its own. */
async function renderScreen() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <ProfileScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

const MEMBER = { role: 'member', displayName: 'Jane Doe' };

describe('ProfileScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('states', () => {
    it('shows a loading state before the profile subscription resolves', async () => {
      mockSignedIn();
      (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
      const { getByTestId } = await renderScreen();
      expect(getByTestId('profile-loading')).toBeTruthy();
    });

    it('shows an error state when the profile subscription fails, and listens again on Try again', async () => {
      mockSignedIn();
      (onSnapshot as jest.Mock)
        .mockImplementationOnce((_ref, _next, err) => {
          err({ code: 'unavailable' });
          return jest.fn();
        })
        .mockImplementation((_ref, next) => {
          next({ exists: () => true, id: 'user-1', data: () => MEMBER });
          return jest.fn();
        });
      const { getByTestId, getByText, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-load-error')).toBeTruthy());

      await fireEvent.press(getByText('Try again'));

      await waitFor(() =>
        expect(getByTestId('profile-name')).toHaveTextContent('Jane Doe')
      );
      expect(queryByTestId('profile-load-error')).toBeNull();
    });
  });

  describe('the rows', () => {
    it('shows name, email, phone, gender and age, each with an Edit (the email has none)', async () => {
      mockSignedIn();
      mockProfileSnapshot({
        ...MEMBER,
        email: 'jane@example.com',
        phoneNumber: '+15551234567',
        gender: 'female',
        age: 34,
      });
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-name')).toBeTruthy());

      expect(getByTestId('profile-name')).toHaveTextContent('Jane Doe');
      expect(getByTestId('profile-email')).toHaveTextContent('jane@example.com');
      expect(getByTestId('profile-phone')).toHaveTextContent('+15551234567');
      expect(getByTestId('profile-gender')).toHaveTextContent('Female');
      expect(getByTestId('profile-age')).toHaveTextContent('34');
      for (const field of ['name', 'phone', 'gender', 'age']) {
        expect(getByTestId(`profile-edit-${field}`)).toBeTruthy();
      }
      // Firebase Auth owns the address: there is no control to change it.
      expect(queryByTestId('profile-edit-email')).toBeNull();
    });

    it('names each Edit for its row, for a screen reader', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByRole } = await renderScreen();
      await waitFor(() =>
        expect(getByRole('button', { name: 'Edit: Name' })).toBeTruthy()
      );
      expect(getByRole('button', { name: 'Edit: Age' })).toBeTruthy();
      expect(getByRole('button', { name: 'Edit: Phone Number' })).toBeTruthy();
      expect(getByRole('button', { name: 'Edit: Gender' })).toBeTruthy();
    });

    it('says "Not set" for a row with no value, and still offers Edit', async () => {
      // Phone, gender and age are all optional answers a member may not have
      // given; the approved design shows the gap in words, with the way to fill it.
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-phone')).toBeTruthy());
      for (const field of ['phone', 'gender', 'age']) {
        expect(getByTestId(`profile-${field}`)).toHaveTextContent('Not set');
        expect(getByTestId(`profile-edit-${field}`)).toBeTruthy();
      }
    });

    it('has no photo to change: the member is their initial (decision H6)', async () => {
      mockSignedIn();
      mockProfileSnapshot({ ...MEMBER, photoURL: 'https://example.com/p.png' });
      const { queryByTestId, queryByText } = await renderScreen();
      await waitFor(() => expect(queryByTestId('profile-name')).toBeTruthy());
      expect(queryByTestId('profile-photo')).toBeNull();
      expect(queryByTestId('change-photo-button')).toBeNull();
      expect(queryByText('Change photo')).toBeNull();
    });

    it('keeps taps alive so the first tap on Save applies the edit', async () => {
      // A ScrollView defaults to keyboardShouldPersistTaps="never": while a
      // TextInput inside it has focus the FIRST touch is consumed dismissing
      // the keyboard and never reaches the control under the finger. The native
      // scroll view implements that, so this pins only that the screen never
      // silently reverts to the broken default.
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-scroll')).toBeTruthy());
      expect(getByTestId('profile-scroll').props.keyboardShouldPersistTaps).toBe(
        'handled'
      );
    });
  });

  describe('editing the name', () => {
    it('swaps the row for its field, seeded with the name, and saves it', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId, queryByTestId, getByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-name')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-name'));
      expect(queryByTestId('profile-row-name')).toBeNull();
      expect(getByTestId('profile-name-input').props.value).toBe('Jane Doe');

      await fireEvent.changeText(getByTestId('profile-name-input'), 'Jane Smith');
      await fireEvent.press(getByTestId('profile-save'));

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        displayName: 'Jane Smith',
      });
      // The field closes and the row is back; a toast says it was saved.
      await waitFor(() => expect(queryByTestId('profile-name-input')).toBeNull());
      expect(getByTestId('profile-row-name')).toBeTruthy();
      expect(getByText('Saved.')).toBeTruthy();
    });

    it('rejects an empty name without calling Firestore, and says so under the field', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-name')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-name'));
      await fireEvent.changeText(getByTestId('profile-name-input'), '   ');
      await fireEvent.press(getByTestId('profile-save'));

      expect(getByTestId('profile-name-input-error')).toHaveTextContent(
        'Your name cannot be empty.'
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('keeps the field open with what was typed, and says so, when saving fails', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
      const { getByTestId, queryByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-name')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-name'));
      await fireEvent.changeText(getByTestId('profile-name-input'), 'New Name');
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() => expect(getByTestId('profile-name-input-error')).toBeTruthy());
      expect(getByTestId('profile-name-input').props.value).toBe('New Name');
      expect(queryByText('Saved.')).toBeNull();
    });

    it('puts the row back as it was on Cancel, writing nothing', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-name')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-name'));
      await fireEvent.changeText(getByTestId('profile-name-input'), 'Someone Else');
      await fireEvent.press(getByTestId('profile-cancel'));

      expect(queryByTestId('profile-name-input')).toBeNull();
      expect(getByTestId('profile-name')).toHaveTextContent('Jane Doe');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('edits one row at a time: starting another puts the first back, unsaved', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-name')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-name'));
      await fireEvent.changeText(getByTestId('profile-name-input'), 'Half typed');
      await fireEvent.press(getByTestId('profile-edit-age'));

      expect(queryByTestId('profile-name-input')).toBeNull();
      expect(getByTestId('profile-name')).toHaveTextContent('Jane Doe');
      expect(getByTestId('profile-age-input')).toBeTruthy();
      // And a stale error from the first does not follow the member to the second.
      expect(queryByTestId('profile-age-input-error')).toBeNull();
    });
  });

  describe('editing the phone number', () => {
    it('saves a changed number, normalized', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-phone')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-phone'));
      expect(getByTestId('profile-phone-input').props.value).toBe('');
      await fireEvent.changeText(getByTestId('profile-phone-input'), '98765 43210');
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() =>
        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
          phoneNumber: '9876543210',
        })
      );
    });

    it('refuses a number that is not one, and says so', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-phone')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-phone'));
      await fireEvent.changeText(getByTestId('profile-phone-input'), '123');
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() => expect(getByTestId('profile-phone-input-error')).toBeTruthy());
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('lets a member withdraw a number they gave', async () => {
      mockSignedIn();
      mockProfileSnapshot({ ...MEMBER, phoneNumber: '9876543210' });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-phone')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-phone'));
      expect(getByTestId('profile-phone-input').props.value).toBe('9876543210');
      await fireEvent.changeText(getByTestId('profile-phone-input'), '');
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() =>
        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { phoneNumber: null })
      );
    });

    it('shows a failed save rather than pretending it worked', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      (updateDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
      const { getByTestId, queryByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-phone')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-phone'));
      await fireEvent.changeText(getByTestId('profile-phone-input'), '9876543210');
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() => expect(getByTestId('profile-phone-input-error')).toBeTruthy());
      expect(getByTestId('profile-phone-input-error')).toHaveTextContent(
        'Couldn’t save your changes. Please try again.'
      );
      expect(queryByText('Saved.')).toBeNull();
    });
  });

  describe('editing the gender', () => {
    it('opens on the member’s answer and saves the other one', async () => {
      mockSignedIn();
      mockProfileSnapshot({ ...MEMBER, gender: 'female' });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-gender')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-gender'));
      expect(
        getByTestId('profile-gender-choice-female').props.accessibilityState.selected
      ).toBe(true);
      await fireEvent.press(getByTestId('profile-gender-choice-male'));
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() =>
        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { gender: 'male' })
      );
    });

    it('opens with neither chosen for a member who has not answered, and writes nothing until one is', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-gender')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-gender'));
      expect(
        getByTestId('profile-gender-choice-male').props.accessibilityState.selected
      ).toBe(false);
      expect(
        getByTestId('profile-gender-choice-female').props.accessibilityState.selected
      ).toBe(false);
      await fireEvent.press(getByTestId('profile-save'));
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('editing the age', () => {
    it('saves a whole number of years', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-age')).toBeTruthy());

      await fireEvent.press(getByTestId('profile-edit-age'));
      await fireEvent.changeText(getByTestId('profile-age-input'), '34');
      await fireEvent.press(getByTestId('profile-save'));

      await waitFor(() =>
        expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { age: 34 })
      );
    });

    it('seeds the field with the age on file', async () => {
      mockSignedIn();
      mockProfileSnapshot({ ...MEMBER, age: 61 });
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-age')).toBeTruthy());
      await fireEvent.press(getByTestId('profile-edit-age'));
      expect(getByTestId('profile-age-input').props.value).toBe('61');
    });

    it('refuses anything that is not 1 to 120 years, by the rule the server enforces', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-age')).toBeTruthy());
      await fireEvent.press(getByTestId('profile-edit-age'));

      for (const bad of ['', '0', '121', '3.5', 'abc', '-4']) {
        await fireEvent.changeText(getByTestId('profile-age-input'), bad);
        await fireEvent.press(getByTestId('profile-save'));
        expect(getByTestId('profile-age-input-error')).toHaveTextContent(
          'Please enter your age as a number.'
        );
      }
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('is a number pad of three digits at most', async () => {
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-edit-age')).toBeTruthy());
      await fireEvent.press(getByTestId('profile-edit-age'));
      expect(getByTestId('profile-age-input').props.keyboardType).toBe('number-pad');
      expect(getByTestId('profile-age-input').props.maxLength).toBe(3);
    });
  });

  // --- Email verification status (V1 email/password sign-in) -----------

  describe('the email address', () => {
    it('reports an unverified address in words and offers to resend', async () => {
      mockSignedInAs({ email: 'member@example.com', emailVerified: false });
      mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
      const { getByTestId } = await renderScreen();

      await waitFor(() =>
        expect(getByTestId('profile-email-verified-status')).toHaveTextContent(
          'Not verified'
        )
      );
      expect(getByTestId('profile-resend-verification-button')).toBeTruthy();
    });

    it('reports a verified address and offers no resend action', async () => {
      mockSignedInAs({ email: 'member@example.com', emailVerified: true });
      mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
      const { getByTestId, queryByTestId } = await renderScreen();

      await waitFor(() =>
        expect(getByTestId('profile-email-verified-status')).toHaveTextContent('Verified')
      );
      expect(queryByTestId('profile-resend-verification-button')).toBeNull();
    });

    it('confirms when the verification email is re-sent', async () => {
      mockSignedInAs({ email: 'member@example.com', emailVerified: false });
      mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
      (sendEmailVerification as jest.Mock).mockResolvedValue(undefined);
      const { getByTestId } = await renderScreen();
      await waitFor(() =>
        expect(getByTestId('profile-resend-verification-button')).toBeTruthy()
      );

      await fireEvent.press(getByTestId('profile-resend-verification-button'));

      await waitFor(() =>
        expect(getByTestId('profile-verification-notice')).toHaveTextContent(
          'Verification email sent. Check your inbox.'
        )
      );
      expect(sendEmailVerification).toHaveBeenCalled();
    });

    it('shows a mapped, non-generic error when resending is rate-limited', async () => {
      mockSignedInAs({ email: 'member@example.com', emailVerified: false });
      mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
      (sendEmailVerification as jest.Mock).mockRejectedValue({
        code: 'auth/too-many-requests',
      });
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const { getByTestId } = await renderScreen();
        await waitFor(() =>
          expect(getByTestId('profile-resend-verification-button')).toBeTruthy()
        );

        await fireEvent.press(getByTestId('profile-resend-verification-button'));

        await waitFor(() =>
          expect(getByTestId('profile-verification-error')).toHaveTextContent(
            'Too many attempts. Please wait a moment and try again.'
          )
        );
      } finally {
        warn.mockRestore();
      }
    });

    it('shows no verification status at all for an account with no email address', async () => {
      // TEST_USER has email: null. There is no sensible "verified" state to
      // report without an address.
      mockSignedIn();
      mockProfileSnapshot(MEMBER);
      const { queryByTestId, getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('profile-email')).toBeTruthy());
      expect(queryByTestId('profile-email-verified-status')).toBeNull();
    });

    it('colours the verified badge as success and the unverified one as a warning, never alone', async () => {
      // Both say it in words; the colour is a second signal.
      mockSignedInAs({ email: 'member@example.com', emailVerified: true });
      mockProfileSnapshot({ role: 'member', email: 'member@example.com' });
      const verified = await renderScreen();
      await waitFor(() =>
        expect(verified.getByTestId('profile-email-verified-status')).toBeTruthy()
      );
      const style = (node: { props: { style?: unknown } }) =>
        StyleSheet.flatten(node.props.style) as { backgroundColor?: string };
      const verifiedFill = style(
        verified.getByTestId('profile-email-verified-status')
      ).backgroundColor;
      await verified.unmount();

      mockSignedInAs({ email: 'member@example.com', emailVerified: false });
      const unverified = await renderScreen();
      await waitFor(() =>
        expect(unverified.getByTestId('profile-email-verified-status')).toBeTruthy()
      );
      const unverifiedFill = style(
        unverified.getByTestId('profile-email-verified-status')
      ).backgroundColor;
      expect(verifiedFill).not.toBe(unverifiedFill);
    });
  });
});
