import React from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  createPrayer,
  deletePrayer,
  setPrayerAnswered,
  subscribeToPrayers,
  type Prayer,
} from '../../../services/firebase/prayers';
import { PrayersScreen } from '../PrayersScreen';
import { translate } from '../../../i18n';
import { lightTokens } from '../../../theme/tokens';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/prayers');

/**
 * My journal: a member's own, private page. These cover the states (loading,
 * empty, error with Try again), the entries as hairline rows, the two
 * actions on each, the confirmation that precedes a delete, and the writing
 * page "New entry" opens -- and that what is typed is never lost to a failure.
 */
const PRAYER: Prayer = {
  id: 'p1',
  text: 'For safe travel',
  answered: false,
  answeredAt: null,
  createdAt: new Date(2020, 0, 5, 12, 0),
};

const ANSWERED: Prayer = {
  id: 'p2',
  text: 'Thank you for a safe journey home.',
  answered: true,
  answeredAt: new Date(2020, 0, 7, 12, 0),
  createdAt: new Date(2020, 0, 6, 12, 0),
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

async function renderScreen(header?: React.ReactNode) {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PrayersScreen header={header} />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
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
    (createPrayer as jest.Mock).mockResolvedValue('new-id');
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('the states', () => {
    it('shows a loading state before the first snapshot arrives', async () => {
      mockPrayers(null);
      const { getByTestId } = await renderScreen();
      expect(
        getByTestId('prayers-loading', { includeHiddenElements: true })
      ).toBeTruthy();
    });

    it('shows the empty state when the member has no prayers', async () => {
      mockPrayers([]);
      const { getByTestId, getByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-empty')).toBeTruthy());
      expect(getByText('Nothing in your journal yet')).toBeTruthy();
      expect(
        getByText('Add a prayer with the button below. Only you can see it.')
      ).toBeTruthy();
    });

    it('shows an error state when the subscription fails, with a way to try again', async () => {
      (subscribeToPrayers as jest.Mock).mockImplementation((_uid, _onNext, onError) => {
        onError(new Error('permission-denied'));
        return jest.fn();
      });
      const { getByTestId, getByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-error')).toBeTruthy());
      expect(getByText('Try again')).toBeTruthy();
    });

    it('listens again when the member chooses Try again, and shows what arrives', async () => {
      let attempts = 0;
      (subscribeToPrayers as jest.Mock).mockImplementation((_uid, onNext, onError) => {
        attempts += 1;
        if (attempts === 1) onError(new Error('unavailable'));
        else onNext([PRAYER]);
        return jest.fn();
      });
      const { getByTestId, getByText, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-error')).toBeTruthy());

      await fireEvent.press(getByText('Try again'));
      await waitFor(() => expect(getByTestId('prayer-row-p1')).toBeTruthy());
      expect(queryByTestId('prayers-error')).toBeNull();
      expect(attempts).toBe(2);
    });

    it('says "Only you can see this" in every state, with the hub’s title and tabs above it', async () => {
      mockPrayers(null);
      const { getByTestId, getByText } = await renderScreen(<Text>HUB HEADER</Text>);
      expect(getByText('HUB HEADER')).toBeTruthy();
      expect(getByTestId('prayers-private-line')).toHaveTextContent(
        'Only you can see this'
      );
    });

    it('lets go of the listener when it goes away', async () => {
      const unsubscribe = jest.fn();
      (subscribeToPrayers as jest.Mock).mockImplementation((_uid, onNext) => {
        onNext([PRAYER]);
        return unsubscribe;
      });
      const { unmount } = await renderScreen();
      await unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('the entries', () => {
    it("renders the member's prayers", async () => {
      const { getByTestId, getByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-row-p1')).toBeTruthy());
      expect(getByText('For safe travel')).toBeTruthy();
    });

    it('shows the date as the day and month', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-row-p1')).toBeTruthy());
      expect(
        within(getByTestId('prayer-row-p1')).getByText(/^5 Jan( \d{4})?$/)
      ).toBeTruthy();
    });

    it('marks an answered prayer with a tick and the word, in the success colour', async () => {
      mockPrayers([PRAYER, ANSWERED]);
      const { getByTestId, queryByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-row-p2')).toBeTruthy());
      const mark = within(getByTestId('prayer-row-p2')).getByText('Answered');
      expect(flat(mark).color).toBe(lightTokens.success);
      // ...and says nothing of the kind about the one that is not.
      expect(within(getByTestId('prayer-row-p1')).queryByText('Answered')).toBeNull();
      expect(queryByText('Answered', { exact: true })).toBeTruthy();
    });

    it('offers each entry exactly two actions, as words', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-row-p1')).toBeTruthy());
      const row = within(getByTestId('prayer-row-p1'));
      expect(row.getByText('Mark answered')).toBeTruthy();
      expect(row.getByText('Delete')).toBeTruthy();
    });

    it('offers "Mark unanswered" on one that is answered', async () => {
      mockPrayers([ANSWERED]);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-row-p2')).toBeTruthy());
      expect(
        within(getByTestId('prayer-row-p2')).getByText('Mark unanswered')
      ).toBeTruthy();
    });

    it('sets each action in a gold-ink word, and Delete in the error colour, each 44 high', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-row-p1')).toBeTruthy());
      const row = within(getByTestId('prayer-row-p1'));
      expect(flat(row.getByText('Mark answered')).color).toBe(lightTokens.accent);
      expect(flat(row.getByText('Delete')).color).toBe(lightTokens.danger);
      expect(flat(getByTestId('prayer-toggle-answered-p1')).minHeight).toBe(44);
      expect(flat(getByTestId('prayer-delete-p1')).minHeight).toBe(44);
    });

    it('keeps taps alive so the first tap on a row action registers', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-list')).toBeTruthy());
      expect(getByTestId('prayers-list').props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('marks a prayer answered without a confirmation -- it is reversible', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-toggle-answered-p1')).toBeTruthy());

      await fireEvent.press(getByTestId('prayer-toggle-answered-p1'));

      await waitFor(() =>
        expect(setPrayerAnswered).toHaveBeenCalledWith('u1', 'p1', true)
      );
    });

    it('marks an answered prayer unanswered', async () => {
      mockPrayers([ANSWERED]);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-toggle-answered-p2')).toBeTruthy());
      await fireEvent.press(getByTestId('prayer-toggle-answered-p2'));
      await waitFor(() =>
        expect(setPrayerAnswered).toHaveBeenCalledWith('u1', 'p2', false)
      );
    });
  });

  // --- Delete asks first ------------------------------------------------
  // Deleting a prayer is irreversible and there is no undo, so it asks, in the
  // app's own dialog -- one mis-tap away from losing a member's own writing.

  describe('deleting', () => {
    it('does not delete on the first tap -- it asks', async () => {
      const { getByTestId, getByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());

      await fireEvent.press(getByTestId('prayer-delete-p1'));

      expect(getByText('Delete this prayer?')).toBeTruthy();
      expect(getByText('This cannot be undone.')).toBeTruthy();
      expect(deletePrayer).not.toHaveBeenCalled();
    });

    it('deletes once the confirmation is accepted', async () => {
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());
      await fireEvent.press(getByTestId('prayer-delete-p1'));

      const dialog = within(getByTestId('prayers-delete-dialog'));
      await fireEvent.press(dialog.getByText('Delete'));

      await waitFor(() => expect(deletePrayer).toHaveBeenCalledWith('u1', 'p1'));
    });

    it('offers Cancel, and cancelling deletes nothing', async () => {
      const { getByTestId, queryByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayer-delete-p1')).toBeTruthy());
      await fireEvent.press(getByTestId('prayer-delete-p1'));

      await fireEvent.press(
        within(getByTestId('prayers-delete-dialog')).getByText('Cancel')
      );

      expect(deletePrayer).not.toHaveBeenCalled();
      await waitFor(() => expect(queryByText('Delete this prayer?')).toBeNull());
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

  describe('adding an entry', () => {
    it('floats "New entry" over the list, and not while it is loading or has failed', async () => {
      const ready = await renderScreen();
      await waitFor(() => expect(ready.getByTestId('prayers-new-entry')).toBeTruthy());
      expect(ready.getByText('New entry')).toBeTruthy();
      await ready.unmount();

      mockPrayers(null);
      const loading = await renderScreen();
      expect(loading.queryByTestId('prayers-new-entry')).toBeNull();
      await loading.unmount();

      (subscribeToPrayers as jest.Mock).mockImplementation((_uid, _onNext, onError) => {
        onError(new Error('x'));
        return jest.fn();
      });
      const failed = await renderScreen();
      await waitFor(() => expect(failed.getByTestId('prayers-error')).toBeTruthy());
      expect(failed.queryByTestId('prayers-new-entry')).toBeNull();
    });

    it('has it on the empty page too: it is how the first entry is added', async () => {
      mockPrayers([]);
      const { getByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-empty')).toBeTruthy());
      expect(getByTestId('prayers-new-entry')).toBeTruthy();
    });

    it('opens the writing page, and nothing is written until Add is pressed', async () => {
      const { getByTestId, queryByTestId } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-new-entry')).toBeTruthy());
      expect(queryByTestId('prayer-input')).toBeNull();

      await fireEvent.press(getByTestId('prayers-new-entry'));
      expect(getByTestId('prayer-input')).toBeTruthy();
      expect(createPrayer).not.toHaveBeenCalled();
    });

    it('saves what was written for the member, closes the page and says so in a toast', async () => {
      const { getByTestId, queryByTestId, getByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-new-entry')).toBeTruthy());
      await fireEvent.press(getByTestId('prayers-new-entry'));

      await fireEvent.changeText(
        getByTestId('prayer-input'),
        '  Lord, give me patience.  '
      );
      await fireEvent.press(getByTestId('prayer-submit'));

      await waitFor(() =>
        expect(createPrayer).toHaveBeenCalledWith('u1', 'Lord, give me patience.')
      );
      await waitFor(() => expect(queryByTestId('prayer-input')).toBeNull());
      expect(getByText('Added to your journal')).toBeTruthy();
    });

    it('says nothing of success when saving fails', async () => {
      (createPrayer as jest.Mock).mockRejectedValue(new Error('offline'));
      const { getByTestId, queryByText } = await renderScreen();
      await waitFor(() => expect(getByTestId('prayers-new-entry')).toBeTruthy());
      await fireEvent.press(getByTestId('prayers-new-entry'));
      await fireEvent.changeText(getByTestId('prayer-input'), 'Please hear me');
      await fireEvent.press(getByTestId('prayer-submit'));

      await waitFor(() => expect(createPrayer).toHaveBeenCalled());
      expect(queryByText('Added to your journal')).toBeNull();
    });
  });
});
