import React from 'react';
import { Text } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDoc, getDocs } from 'firebase/firestore';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n/strings';
import { SavedMediaScreen } from '../SavedMediaScreen';

jest.mock('../../../services/firebase/app');

/**
 * The bookmarks list. What matters here is the read cost -- one query,
 * not one read per save -- and that opening a saved post re-reads the
 * REAL post rather than trusting the small copy the save carries.
 */
const Stack = createNativeStackNavigator();

function DetailStub() {
  return <Text testID="media-detail-stub">detail</Text>;
}

function savedDoc(id: string, partial: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      type: 'image',
      mediaUrl: `https://example.org/${id}.jpg`,
      caption: `Saved ${id}`,
      ...partial,
    }),
  };
}

function mockSignedIn(uid: string | null) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(uid ? { uid, displayName: 'Ruth', email: null, phoneNumber: null } : null);
    return jest.fn();
  });
}

async function renderSaved() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="SavedMedia" component={SavedMediaScreen} />
            <Stack.Screen name="MediaDetail" component={DetailStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockImplementation((_db, ...segments: string[]) => ({
    path: segments.join('/'),
  }));
  mockSignedIn('member-1');
});

afterEach(async () => {
  await cleanup();
});

describe('saved media', () => {
  it('lists what the member saved, from ONE query', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [savedDoc('a'), savedDoc('b')] });
    const screen = await renderSaved();

    await waitFor(() => expect(screen.getByTestId('saved-media-a')).toBeTruthy());
    expect(screen.getByTestId('saved-media-b')).toBeTruthy();
    // Two saves, one read: the small copy on each save is what makes
    // that possible. See services/firebase/media.ts.
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('says so when nothing is saved', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    const screen = await renderSaved();
    await waitFor(() => expect(screen.getByTestId('saved-media-empty')).toBeTruthy());
  });

  it('explains itself to someone without an account', async () => {
    mockSignedIn(null);
    const screen = await renderSaved();
    await waitFor(() =>
      expect(screen.getByTestId('saved-media-signed-out')).toBeTruthy()
    );
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('offers a retry when the list could not be read', async () => {
    (getDocs as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const screen = await renderSaved();
    await waitFor(() => expect(screen.getByTestId('saved-media-error')).toBeTruthy());
  });

  it('re-reads the REAL post before opening it, not the saved copy', async () => {
    // A caption edited since the save must not be what the member reads.
    (getDocs as jest.Mock).mockResolvedValue({ docs: [savedDoc('a')] });
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: 'a',
      data: () => ({
        type: 'image',
        mediaUrl: 'https://example.org/a.jpg',
        caption: 'The edited caption',
        published: true,
        publishAt: new Date('2026-04-01T00:00:00Z'),
        authorName: 'Pastor',
      }),
    });
    const screen = await renderSaved();
    await waitFor(() => expect(screen.getByTestId('saved-media-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('saved-media-a'));

    await waitFor(() => expect(getDoc).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('media-detail-stub')).toBeTruthy());
  });

  it('says so when a saved post has since been deleted or unpublished', async () => {
    // Rather than opening an empty screen.
    (getDocs as jest.Mock).mockResolvedValue({ docs: [savedDoc('gone')] });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    const screen = await renderSaved();
    await waitFor(() => expect(screen.getByTestId('saved-media-gone')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('saved-media-gone'));

    await waitFor(() =>
      expect(screen.getByTestId('saved-media-open-failed')).toBeTruthy()
    );
    expect(screen.queryByTestId('media-detail-stub')).toBeNull();
    // It says the post is gone -- not that something "could not load".
    expect(screen.getByTestId('saved-media-open-failed')).toHaveTextContent(
      translate('en', 'media.unavailable')
    );
  });

  it('says it could not be read, and not that it is gone, when the read itself fails', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [savedDoc('a')] });
    (getDoc as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const screen = await renderSaved();
    await waitFor(() => expect(screen.getByTestId('saved-media-a')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('saved-media-a'));

    await waitFor(() =>
      expect(screen.getByTestId('saved-media-open-failed')).toBeTruthy()
    );
    expect(screen.getByTestId('saved-media-open-failed')).toHaveTextContent(
      translate('en', 'media.loadError')
    );
    expect(screen.getByTestId('saved-media-open-failed')).not.toHaveTextContent(
      translate('en', 'media.unavailable')
    );
    warn.mockRestore();
  });

  it('puts a play marker on a saved video and none on a saved picture', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [savedDoc('pic'), savedDoc('vid', { type: 'video' })],
    });
    const screen = await renderSaved();
    await waitFor(() => expect(screen.getByTestId('saved-media-vid')).toBeTruthy());
    expect(screen.getByTestId('saved-media-play-vid')).toBeTruthy();
    expect(screen.queryByTestId('saved-media-play-pic')).toBeNull();
  });

  it('keeps its own top bar -- titled Saved media, with Back -- through every state', async () => {
    (getDocs as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    const waiting = await renderSaved();
    await waitFor(() => expect(waiting.getByTestId('saved-media-loading')).toBeTruthy());
    expect(
      waiting.getAllByText(translate('en', 'media.savedTitle')).length
    ).toBeGreaterThan(0);
    expect(waiting.getByTestId('top-bar-back')).toBeTruthy();
    await waiting.unmount();

    (getDocs as jest.Mock).mockResolvedValue({ docs: [savedDoc('a')] });
    const ready = await renderSaved();
    await waitFor(() => expect(ready.getByTestId('saved-media-a')).toBeTruthy());
    expect(ready.getByTestId('top-bar-back')).toBeTruthy();
  });
});
