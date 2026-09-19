import React from 'react';
import { Button, View } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { AuthProvider } from '../../../../context/AuthContext';
import { POSITION_WRITE_DELAY_MS, useReadingPosition } from '../useReadingPosition';

jest.mock('../../../../services/firebase/app');

/**
 * The reading position is the one thing in the reader that writes to
 * Firestore on a GESTURE rather than on a decision, so the throttle is
 * what is worth pinning: this project is on the Spark plan, and a write
 * per scroll frame would be thousands per chapter.
 *
 * TWO RENDERS IN THE WHOLE FILE, the assertions grouped accordingly,
 * and the one that UNMOUNTS goes last. RNTL 14 in this repo leaves every
 * render after an explicit unmount() unable to find its own tree -- the
 * same failure diagnosed in
 * ../../../../context/__tests__/PreferencesContext.test.tsx -- so a
 * scenario per `it` would pass, then fail for reasons that have nothing
 * to do with the code under test.
 */
function Harness() {
  const { reportVisibleVerse } = useReadingPosition({
    translationId: 'te',
    bookId: 'genesis',
    chapter: 1,
  });
  return (
    <View>
      {[1, 2, 3].map((verse) => (
        <Button
          key={verse}
          title={`v${verse}`}
          testID={`report-${verse}`}
          onPress={() => reportVisibleVerse(verse)}
        />
      ))}
    </View>
  );
}

function mockAuth(uid: string | null) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(uid ? { uid, displayName: null, email: null, phoneNumber: null } : null);
    return jest.fn();
  });
}

describe('throttled reading-position writes', () => {
  afterEach(async () => {
    await cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('writes nothing at all while signed out -- there is no document to own', async () => {
    mockAuth(null);
    const { getByTestId } = await render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );
    jest.useFakeTimers();

    fireEvent.press(getByTestId('report-2'));
    act(() => {
      jest.advanceTimersByTime(POSITION_WRITE_DELAY_MS * 2);
    });
    expect(setDoc).not.toHaveBeenCalled();
  });
  it('collapses a scroll burst into one write, skips a repeat, and flushes on leaving', async () => {
    mockAuth('member-1');
    const { getByTestId, unmount } = await render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );
    // Fake timers go in AFTER the tree has mounted: React's scheduler
    // needs real ones to commit the first render.
    jest.useFakeTimers();

    // --- a burst of scroll reports costs ONE write, for the last verse.
    for (const verse of [1, 2, 3]) fireEvent.press(getByTestId(`report-${verse}`));
    act(() => {
      jest.advanceTimersByTime(POSITION_WRITE_DELAY_MS - 1);
    });
    expect(setDoc).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, first] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(first).toMatchObject({ bookId: 'genesis', chapter: 1, verse: 3 });
    // The translation is the document id, not a field.
    expect(first.translationId).toBeUndefined();

    // --- reporting the SAME position again writes nothing.
    fireEvent.press(getByTestId('report-3'));
    act(() => {
      jest.advanceTimersByTime(POSITION_WRITE_DELAY_MS);
    });
    expect(setDoc).toHaveBeenCalledTimes(1);

    // --- a pending position is flushed when the reader leaves, so
    // --- walking away mid-scroll still saves the place.
    fireEvent.press(getByTestId('report-1'));
    expect(setDoc).toHaveBeenCalledTimes(1);
    act(() => {
      unmount();
    });
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));
    const [, second] = (setDoc as jest.Mock).mock.calls[1] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(second).toMatchObject({ verse: 1 });
  });
});
