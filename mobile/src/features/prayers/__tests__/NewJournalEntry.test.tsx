import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { lightTokens } from '../../../theme/tokens';
import { NewJournalEntry, PRAYER_TEXT_MAX_LENGTH } from '../NewJournalEntry';

jest.mock('../../../services/firebase/app');

// "Reduce motion" is the phone's own setting; a test sets it through this.
let mockReducedMotion = false;
jest.mock('../../../theme/motion', () => ({
  ...jest.requireActual('../../../theme/motion'),
  useReducedMotion: () => mockReducedMotion,
}));

/**
 * The page "New entry" opens: a Close, "Only you can see this", an open space
 * to write in, and one "Add Prayer" button at the foot. A task, not a place --
 * and what was typed is never lost to a failure.
 */
afterEach(async () => {
  await cleanup();
  await AsyncStorage.clear();
  mockReducedMotion = false;
});

function ui(props: Partial<React.ComponentProps<typeof NewJournalEntry>> = {}) {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <NewJournalEntry
          visible
          onClose={jest.fn()}
          onAdd={jest.fn().mockResolvedValue(undefined)}
          {...props}
        />
      </PreferencesProvider>
    </AuthProvider>
  );
}

function flat(node: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, number | string>;
}

describe('NewJournalEntry', () => {
  it('is a Close, a title, the privacy line, the writing space and Add Prayer', async () => {
    const { getByTestId, getByText } = await render(ui());
    expect(getByText('New entry')).toBeTruthy();
    expect(getByText('Only you can see this')).toBeTruthy();
    expect(getByTestId('prayer-input').props.placeholder).toBe('What’s on your heart?');
    expect(getByText('Add Prayer')).toBeTruthy();
  });

  it('says "Close", not "Back": it is a task, not a place', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-entry-back').props.accessibilityLabel).toBe('Close');
  });

  it('opens the keyboard at once: the only reason to be here is to write', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-input').props.autoFocus).toBe(true);
  });

  it('holds a long entry, but not an unbounded one', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-input').props.maxLength).toBe(PRAYER_TEXT_MAX_LENGTH);
    expect(PRAYER_TEXT_MAX_LENGTH).toBe(2000);
  });

  it('writes at 18/28 in the interface face, in ink, with no box round it', async () => {
    const { getByTestId } = await render(ui());
    const style = flat(getByTestId('prayer-input'));
    expect(style).toMatchObject({
      fontSize: 18,
      lineHeight: 28,
      color: lightTokens.ink,
      flex: 1,
    });
    expect(style.borderWidth).toBeUndefined();
  });

  it('gives Telugu the 33-point line its marks need', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await render(ui());
    await waitFor(() => expect(flat(getByTestId('prayer-input')).lineHeight).toBe(33));
  });

  it('waits to be written in: Add Prayer is disabled until there is something to add', async () => {
    const { getByTestId } = await render(ui());
    expect(getByTestId('prayer-submit').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('prayer-input'), '   ');
    expect(getByTestId('prayer-submit').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(getByTestId('prayer-input'), 'Lord, hear me');
    expect(getByTestId('prayer-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('adds the trimmed words, then closes', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByTestId } = await render(ui({ onAdd, onClose }));
    await fireEvent.changeText(getByTestId('prayer-input'), '  Give me patience.  ');
    await fireEvent.press(getByTestId('prayer-submit'));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Give me patience.'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps every word, and says it did not work, when saving fails', async () => {
    const onAdd = jest.fn().mockRejectedValue(new Error('offline'));
    const onClose = jest.fn();
    const { getByTestId, getByText } = await render(ui({ onAdd, onClose }));
    await fireEvent.changeText(getByTestId('prayer-input'), 'A long prayer I wrote');
    await fireEvent.press(getByTestId('prayer-submit'));

    await waitFor(() => expect(getByTestId('prayer-entry-error')).toBeTruthy());
    expect(getByText('That did not work. Please try again.')).toBeTruthy();
    // Nothing is lost, and the page stays open to try again.
    expect(getByTestId('prayer-input').props.value).toBe('A long prayer I wrote');
    expect(onClose).not.toHaveBeenCalled();
    expect(getByTestId('prayer-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('clears the notice when the next attempt starts', async () => {
    const onAdd = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const { getByTestId, queryByTestId } = await render(ui({ onAdd }));
    await fireEvent.changeText(getByTestId('prayer-input'), 'Hear me');
    await fireEvent.press(getByTestId('prayer-submit'));
    await waitFor(() => expect(getByTestId('prayer-entry-error')).toBeTruthy());

    await fireEvent.press(getByTestId('prayer-submit'));
    await waitFor(() => expect(queryByTestId('prayer-entry-error')).toBeNull());
  });

  it('does not add twice while it is saving', async () => {
    let resolve: () => void = () => undefined;
    const onAdd = jest.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        })
    );
    const { getByTestId } = await render(ui({ onAdd }));
    await fireEvent.changeText(getByTestId('prayer-input'), 'Once only');
    await fireEvent.press(getByTestId('prayer-submit'));
    await fireEvent.press(getByTestId('prayer-submit'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('discards the draft and closes when Close is pressed on purpose', async () => {
    const onClose = jest.fn();
    const onAdd = jest.fn();
    const { getByTestId } = await render(ui({ onClose, onAdd }));
    await fireEvent.changeText(getByTestId('prayer-input'), 'Never mind');
    await fireEvent.press(getByTestId('prayer-entry-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
    expect(getByTestId('prayer-input').props.value).toBe('');
  });

  it('slides up like a sheet, and just appears when the phone asks for no animations', async () => {
    // The Modal is the screen's own ancestor: read how it was asked to animate.
    const animationOf = (root: { getByTestId: (id: string) => { parent: unknown } }) => {
      let node = root.getByTestId('prayer-entry-screen').parent as {
        props: { animationType?: string };
        parent: unknown;
      } | null;
      while (node && node.props.animationType === undefined) {
        node = node.parent as typeof node;
      }
      return node?.props.animationType;
    };
    const normal = await render(ui());
    expect(animationOf(normal)).toBe('slide');
    await normal.unmount();

    mockReducedMotion = true;
    const reduced = await render(ui());
    expect(animationOf(reduced)).toBe('none');
  });

  it('draws nothing at all while it is not visible', async () => {
    const { queryByTestId } = await render(ui({ visible: false }));
    expect(queryByTestId('prayer-input')).toBeNull();
  });
});
