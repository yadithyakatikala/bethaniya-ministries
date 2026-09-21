import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { PrayerWallScreen } from '../PrayerWallScreen';
import {
  createPrayerRequest,
  fetchOwnPrayerRequestIds,
  fetchPrayerRequestPage,
  type PrayerRequest,
} from '../../../services/firebase/prayerRequests';
import { fetchReportedItemKeys } from '../../../services/firebase/reports';

jest.mock('../../../services/firebase/app');
jest.mock('../../../services/firebase/prayerRequests');
jest.mock('../../../services/firebase/reports');

/**
 * Prayers -- the screen Home's "Prayers" tile now opens.
 *
 * A tester found two Home buttons ("Prayers" and "Prayer requests") that
 * led to the same kind of thing. This screen is the one that survived:
 * the shared feed, with "Ask for prayer" on it. What these tests defend
 * is the flow the brief asks for -- see the feed, tap Ask for prayer,
 * fill the form in, submit, land back on the feed -- and the anonymity
 * behaviour that must survive it.
 */
function request(overrides: Partial<PrayerRequest> = {}): PrayerRequest {
  return {
    id: 'p1',
    title: 'Please pray',
    body: 'For my family this week.',
    category: 'family',
    anonymous: false,
    authorName: 'Asha Kumar',
    status: 'open',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    updatedAt: null,
    removed: false,
    ...overrides,
  };
}

function renderWall() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <PrayerWallScreen />
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid: 'member-1', displayName: 'Asha', email: null, phoneNumber: null });
    return jest.fn();
  });
  (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
    requests: [request()],
    cursor: null,
  });
  (fetchOwnPrayerRequestIds as jest.Mock).mockResolvedValue(new Set<string>());
  (fetchReportedItemKeys as jest.Mock).mockResolvedValue(new Set<string>());
  (createPrayerRequest as jest.Mock).mockResolvedValue('new-id');
});

describe('the feed', () => {
  it('shows the church’s prayer requests', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeTruthy());
    expect(screen.getByText('Please pray')).toBeTruthy();
    expect(screen.getByText('For my family this week.')).toBeTruthy();
  });

  it('offers "Ask for prayer" right at the top', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    expect(screen.getByText('Ask for prayer')).toBeTruthy();
  });

  it('says so when nobody has asked for anything yet', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-empty')).toBeTruthy());
    // And the way to add one is still there.
    expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy();
  });
});

describe('asking for prayer', () => {
  it('opens the complete form', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));

    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());
    // Every M7 field, on one form.
    expect(screen.getByTestId('prayer-form-body')).toBeTruthy();
    expect(screen.getByTestId('prayer-form-category')).toBeTruthy();
    expect(screen.getByTestId('prayer-form-anonymous')).toBeTruthy();
    expect(screen.getByTestId('prayer-form-submit')).toBeTruthy();
  });

  it('submits what was typed and returns to the feed', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-title')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('prayer-form-title'), 'Travelling');
    await fireEvent.changeText(
      screen.getByTestId('prayer-form-body'),
      'Please pray for safety on the road.'
    );
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));

    await waitFor(() => expect(createPrayerRequest).toHaveBeenCalled());
    const input = (createPrayerRequest as jest.Mock).mock.calls[0][0];
    expect(input.title).toBe('Travelling');
    expect(input.body).toBe('Please pray for safety on the road.');

    // Back on the feed: the form is gone.
    await waitFor(() => expect(screen.queryByTestId('prayer-form-title')).toBeNull());
    expect(screen.getByTestId('prayer-wall-list')).toBeTruthy();
  });

  it('refuses an empty request rather than posting a blank one', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-submit')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('prayer-form-submit'));
    expect(createPrayerRequest).not.toHaveBeenCalled();
    expect(screen.getByText('Please write a subject.')).toBeTruthy();
  });

  it('carries the anonymous choice through to the write', async () => {
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-compose')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('prayer-wall-compose'));
    await waitFor(() => expect(screen.getByTestId('prayer-form-anonymous')).toBeTruthy());

    await fireEvent(screen.getByTestId('prayer-form-anonymous'), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('prayer-form-title'), 'Something hard');
    await fireEvent.changeText(
      screen.getByTestId('prayer-form-body'),
      'I would rather not say who this is.'
    );
    await fireEvent.press(screen.getByTestId('prayer-form-submit'));

    await waitFor(() => expect(createPrayerRequest).toHaveBeenCalled());
    // The service is what strips the identity (and firestore.rules
    // refuses the write if it does not) -- what matters here is that the
    // member's choice actually reaches it.
    expect((createPrayerRequest as jest.Mock).mock.calls[0][0].anonymous).toBe(true);
  });
});

describe('anonymity on the feed', () => {
  it('shows "Anonymous" and no name for an anonymous request', async () => {
    (fetchPrayerRequestPage as jest.Mock).mockResolvedValue({
      requests: [request({ anonymous: true, authorName: null })],
      cursor: null,
    });
    const screen = await renderWall();
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeTruthy());

    expect(screen.getByText('Anonymous')).toBeTruthy();
    // Queried rather than serialised: a whole screen's tree carries
    // React context providers, which are circular. The card-level test
    // in ./PrayerRequestCard.test.tsx does the full-tree sweep, where
    // the subtree is small enough to serialise.
    expect(screen.queryByText('Asha Kumar')).toBeNull();
    expect(screen.queryByTestId('prayer-request-author-p1')?.props.children).toBe(
      'Anonymous'
    );
  });
});
