import React from 'react';
import { Text } from 'react-native';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SuspensionGate } from '../SuspensionGate';

jest.mock('../../../services/firebase/app');

/**
 * THE GATE -- the half of a suspension a member can actually see.
 *
 * firestore.rules is what refuses their writes; it does that whatever
 * this component does. What this component is for is the difference
 * between "you are suspended until Friday" and an app that silently
 * throws away everything you type -- which is what a suspension looked
 * like before it existed.
 *
 * The claim worth testing hardest is the one in the brief: A MEMBER MUST
 * NOT BE ABLE TO CLOSE AND REOPEN THE APP TO GET PAST IT. The gate makes
 * that true by having nothing to remember -- the decision is taken from
 * the profile snapshot every time it mounts, so "reopening the app" is
 * just another mount, and there is no local flag a restart could
 * preserve.
 */
function profileDoc(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

/** Delivers one profile document to PreferencesContext's listener. */
function deliverProfile(data: Record<string, unknown>) {
  (onSnapshot as jest.Mock).mockImplementation((_ref, onNext) => {
    onNext(profileDoc(data));
    return jest.fn();
  });
}

function renderGate() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <SuspensionGate>
          <Text testID="the-app">The app</Text>
        </SuspensionGate>
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'member-1', displayName: 'Asha', email: null, phoneNumber: null });
    return jest.fn();
  });
});

describe('an active member', () => {
  it('gets the app', async () => {
    deliverProfile({ accountStatus: 'active' });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(screen.queryByTestId('suspended-screen')).toBeNull();
  });

  it('gets the app when the document says nothing about suspension', async () => {
    // Every account created before any of this existed.
    deliverProfile({});
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
  });
});

describe('a suspended member', () => {
  it('gets the notice instead of the app', async () => {
    deliverProfile({
      accountStatus: 'suspended',
      suspension: { kind: 'permanent', startedAt: null, expiresAt: null },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('suspended-screen')).toBeTruthy());
    // Not "the app, with a banner". The app is not mounted at all.
    expect(screen.queryByTestId('the-app')).toBeNull();
  });

  it('is told when a temporary suspension ends', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    deliverProfile({
      accountStatus: 'suspended',
      suspension: { kind: 'temporary', startedAt: null, expiresAt },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('suspended-until')).toBeTruthy());
  });

  it('is given no date at all when the suspension is permanent', async () => {
    // Inventing one would be the worst mistake this screen could make.
    deliverProfile({
      accountStatus: 'suspended',
      suspension: { kind: 'permanent', startedAt: null, expiresAt: null },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('suspended-screen')).toBeTruthy());
    expect(screen.queryByTestId('suspended-until')).toBeNull();
  });

  it('is NOT told the reason an administrator recorded', async () => {
    // It is a note written for the next administrator, not a message.
    deliverProfile({
      accountStatus: 'suspended',
      suspension: {
        kind: 'permanent',
        startedAt: null,
        expiresAt: null,
        reason: 'Third warning about the chat',
      },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('suspended-screen')).toBeTruthy());
    expect(screen.queryByText(/Third warning/)).toBeNull();
  });

  it('can still sign out, for the sake of a shared phone', async () => {
    deliverProfile({
      accountStatus: 'suspended',
      suspension: { kind: 'permanent', startedAt: null, expiresAt: null },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('suspended-sign-out')).toBeTruthy());
  });
});

describe('closing and reopening the app', () => {
  it('does not get anybody past it', async () => {
    // A fresh mount IS a restart, as far as this gate is concerned:
    // there is no cached decision to survive one, only the profile
    // snapshot, which is read again every time.
    //
    // cleanup() between the two renders is what makes the second one a
    // genuinely fresh tree rather than a second tree beside the first --
    // RNTL keeps every rendered tree until the test ends otherwise.
    const suspended = {
      accountStatus: 'suspended',
      suspension: { kind: 'permanent', startedAt: null, expiresAt: null },
    };

    deliverProfile(suspended);
    const first = await renderGate();
    await waitFor(() => expect(first.getByTestId('suspended-screen')).toBeTruthy());
    await cleanup();

    deliverProfile(suspended);
    const second = await renderGate();
    await waitFor(() => expect(second.getByTestId('suspended-screen')).toBeTruthy());
    expect(second.queryByTestId('the-app')).toBeNull();
  });
});

describe('a temporary suspension that has already run out', () => {
  it('lets the member back in, with nothing rewritten on the document', async () => {
    // THE POINT OF PUTTING THE COMPARISON IN THE READ PATH. No job
    // flipped anything; accountStatus still says 'suspended'.
    deliverProfile({
      accountStatus: 'suspended',
      suspension: {
        kind: 'temporary',
        startedAt: null,
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
    expect(screen.queryByTestId('suspended-screen')).toBeNull();
  });

  it('releases on its own while the member is watching', async () => {
    // Two seconds out, then the clock is pushed past it. Without the
    // timer in the gate the member would sit on the notice until they
    // thought to force-quit -- which is exactly the "it still says I am
    // blocked" that makes software feel punitive.
    const expiresAt = new Date(Date.now() + 2_000);
    deliverProfile({
      accountStatus: 'suspended',
      suspension: { kind: 'temporary', startedAt: null, expiresAt },
    });
    const screen = await renderGate();
    await waitFor(() => expect(screen.getByTestId('suspended-screen')).toBeTruthy());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_200));
    });

    await waitFor(() => expect(screen.getByTestId('the-app')).toBeTruthy());
  }, 10_000);
});
