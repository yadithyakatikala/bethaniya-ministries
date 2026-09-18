import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  deletePrayer,
  setPrayerAnswered,
  subscribeToPrayers,
  type Prayer,
} from '../../../services/firebase/prayers';
import { PrayersScreen } from '../PrayersScreen';
import { translate } from '../../../i18n';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/prayers');

/**
 * PrayersScreen had no screen-level test at all. These cover the UX
 * behaviours the final UI/UX pass changed, plus the loading/empty/error
 * states that were already there and now have a regression guard.
 */
const PRAYER: Prayer = {
  id: 'p1',
  text: 'For safe travel',
  answered: false,
  answeredAt: null,
  createdAt: new Date('2026-01-05T00:00:00Z'),
};

function mockSignedIn() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'u1', displayName: 'Jane Doe', email: 'jane@example.com' });
    return jest.fn();
  });
}

/** Emits `prayers` on the subscription; pass null to never emit. */
function mockPrayers(prayers: Prayer[] | null) {
  (subscribeToPrayers as jest.Mock).mockImplementation((_uid, onNext) => {
    if (prayers) onNext(prayers);
    return jest.fn();
  });
}

async function renderScreen() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PrayersScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('PrayersScreen', () => {
  beforeEach(() => {
    // Clears recorded calls between tests. It deliberately runs BEFORE the
    // mock setup below, because clearAllMocks() leaves mockReturnValue /
    // mockImplementation in place but the "cancelling deletes nothing"
    // assertion is about call COUNT, which does leak across tests.
    jest.clearAllMocks();
    mockSignedIn();
    mockPrayers([PRAYER]);
    (setPrayerAnswered as jest.Mock).mockResolvedValue(undefined);
    (deletePrayer as jest.Mock).mockResolvedValue(undefined);
  });

  it('shows a loading state before the first snapshot arrives', async () => {
    mockPrayers(null);
    const { getByTestId } = await renderScreen();
    expect(getByTestId('prayers-loading')).toBeTruthy();
  });

  it('shows the empty state when the member has no prayers', async () => {
    mockPrayers([]);
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayers-empty')).toBeTruthy());
  });

  it('shows an error state when the subscription fails', async () => {
    (subscribeToPrayers as jest.Mock).mockImplementation((_uid, _onNext, onError) => {
      onError(new Error('permission-denied'));
      return jest.fn();
    });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayers-error')).toBeTruthy());
  });

  it("renders the member's prayers", async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayer-row-p1')).toBeTruthy());
  });

  /**
   * The composer sits above the list and keeps focus, so without
   * keyboardShouldPersistTaps the first tap on a row action was consumed
   * dismissing the keyboard -- see ../PrayersScreen.tsx.
   */
  it('keeps taps alive so the first tap on a row action registers', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayers-list')).toBeTruthy());
    expect(getByTestId('prayers-list').props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('marks a prayer answered without a confirmation -- it is reversible', async () => {
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayer-toggle-answered-p1')).toBeTruthy());

    await fireEvent.press(getByTestId('prayer-toggle-answered-p1'));

    await waitFor(() => expect(setPrayerAnswered).toHaveBeenCalledWith('u1', 'p1', true));
  });

  // --- Delete asks first ------------------------------------------------
  // Deleting a prayer is irreversible and there is no undo. It used to
  // delete on a single tap, which is one mis-tap away from losing a
  // member's own writing.

  it('does not delete on the first tap -- it asks', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());

    await fireEvent.press(getByTestId('prayer-delete-p1'));

    expect(alertSpy).toHaveBeenCalled();
    expect(deletePrayer).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('deletes once the confirmation is accepted', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        // Press the destructive button the screen passed in.
        const confirm = buttons?.find((button) => button.style === 'destructive');
        confirm?.onPress?.();
      });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());

    await fireEvent.press(getByTestId('prayer-delete-p1'));

    await waitFor(() => expect(deletePrayer).toHaveBeenCalledWith('u1', 'p1'));
    alertSpy.mockRestore();
  });

  it('offers Cancel, and cancelling deletes nothing', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const cancel = buttons?.find((button) => button.style === 'cancel');
        expect(cancel).toBeTruthy();
        cancel?.onPress?.();
      });
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());

    await fireEvent.press(getByTestId('prayer-delete-p1'));

    expect(deletePrayer).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('names what is being deleted for a screen reader', async () => {
    // "Delete" on its own tells a TalkBack user nothing about what it acts on.
    const { getByTestId } = await renderScreen();
    await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());
    expect(getByTestId('prayer-delete-p1').props.accessibilityLabel).toBe(
      translate('en', 'prayers.deleteLabel')
    );
  });
});
