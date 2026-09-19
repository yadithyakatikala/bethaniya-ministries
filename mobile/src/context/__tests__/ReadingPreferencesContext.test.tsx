import React from 'react';
import { Button, Text, View } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { AuthProvider } from '../AuthContext';
import {
  ReadingPreferencesProvider,
  useReadingPreferences,
} from '../ReadingPreferencesContext';
import { DEFAULT_READING_PREFS } from '../../services/firebase/readingPrefs';

jest.mock('../../services/firebase/app');

const READING_PREFS_KEY = 'reading_prefs';

function Probe() {
  const prefs = useReadingPreferences();
  return (
    <View>
      <Text testID="font">{prefs.font}</Text>
      <Text testID="size">{prefs.size}</Text>
      <Text testID="lineHeight">{prefs.lineHeight}</Text>
      <Text testID="width">{prefs.width}</Text>
      <Text testID="layout">{prefs.layout}</Text>
      <Text testID="isLoaded">{String(prefs.isLoaded)}</Text>
      <Button
        title="bigger"
        testID="set-size-xl"
        onPress={() => void prefs.setReadingPrefs({ size: 'xl' })}
      />
      <Button
        title="sans"
        testID="set-font-sans"
        onPress={() => void prefs.setReadingPrefs({ font: 'sans' })}
      />
    </View>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <ReadingPreferencesProvider>
        <Probe />
      </ReadingPreferencesProvider>
    </AuthProvider>
  );
}

function mockSignedOut() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(null);
    return jest.fn();
  });
}

function mockSignedIn(uid: string, stored?: Record<string, unknown>) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext({ uid, displayName: null, email: null, phoneNumber: null });
    return jest.fn();
  });
  (onSnapshot as jest.Mock).mockImplementation((_ref, next) => {
    next(stored ? { exists: () => true, data: () => stored } : { exists: () => false });
    return jest.fn();
  });
}

describe('reading preferences', () => {
  beforeEach(() => {
    mockSignedOut();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (onSnapshot as jest.Mock).mockImplementation(() => jest.fn());
  });

  it('starts at the token defaults, so the first frame is already readable', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    expect(getByTestId('font').props.children).toBe(DEFAULT_READING_PREFS.font);
    expect(getByTestId('size').props.children).toBe(DEFAULT_READING_PREFS.size);
    expect(getByTestId('lineHeight').props.children).toBe(
      DEFAULT_READING_PREFS.lineHeight
    );
    expect(getByTestId('width').props.children).toBe(DEFAULT_READING_PREFS.width);
    expect(getByTestId('layout').props.children).toBe(DEFAULT_READING_PREFS.layout);
  });

  it('restores what was stored locally, so a restart keeps the settings', async () => {
    await AsyncStorage.setItem(
      READING_PREFS_KEY,
      JSON.stringify({ font: 'sans', size: 'xxl', width: 'wide' })
    );
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('size').props.children).toBe('xxl'));
    expect(getByTestId('font').props.children).toBe('sans');
    expect(getByTestId('width').props.children).toBe('wide');
    // A field the stored blob did not carry keeps its default.
    expect(getByTestId('lineHeight').props.children).toBe(
      DEFAULT_READING_PREFS.lineHeight
    );
  });

  it('survives a corrupt stored blob instead of refusing to open', async () => {
    await AsyncStorage.setItem(READING_PREFS_KEY, 'not json at all');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    expect(getByTestId('size').props.children).toBe(DEFAULT_READING_PREFS.size);
  });

  it('persists a change locally and does not touch Firestore while signed out', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    fireEvent.press(getByTestId('set-size-xl'));
    await waitFor(() => expect(getByTestId('size').props.children).toBe('xl'));
    expect(await AsyncStorage.getItem(READING_PREFS_KEY)).toContain('"size":"xl"');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('merges successive changes rather than dropping the earlier one', async () => {
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    fireEvent.press(getByTestId('set-size-xl'));
    await waitFor(() => expect(getByTestId('size').props.children).toBe('xl'));
    fireEvent.press(getByTestId('set-font-sans'));
    await waitFor(() => expect(getByTestId('font').props.children).toBe('sans'));

    // Both, not just the last one -- the setter merges onto the current
    // value rather than onto a pre-render snapshot.
    expect(getByTestId('size').props.children).toBe('xl');
    const stored = await AsyncStorage.getItem(READING_PREFS_KEY);
    expect(stored).toContain('"size":"xl"');
    expect(stored).toContain('"font":"sans"');
  });

  it('syncs a change to Firestore when signed in', async () => {
    mockSignedIn('member-1');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));

    fireEvent.press(getByTestId('set-font-sans'));
    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [, data] = (setDoc as jest.Mock).mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(data.font).toBe('sans');
  });

  it('lets the synced document win, and writes it through to local storage', async () => {
    // A member who set a larger size on their phone should find it on
    // their tablet.
    await AsyncStorage.setItem(READING_PREFS_KEY, JSON.stringify({ size: 'xs' }));
    mockSignedIn('member-1', { size: 'xl', font: 'sans' });
    const { getByTestId } = await renderProbe();

    await waitFor(() => expect(getByTestId('size').props.children).toBe('xl'));
    expect(getByTestId('font').props.children).toBe('sans');
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(READING_PREFS_KEY)).toContain('"size":"xl"')
    );
  });

  it('keeps the local value when the Firestore write fails', async () => {
    mockSignedIn('member-1');
    (setDoc as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('isLoaded').props.children).toBe('true'));
    fireEvent.press(getByTestId('set-size-xl'));

    // The member can still see their change, and it is still stored.
    await waitFor(() => expect(getByTestId('size').props.children).toBe('xl'));
    expect(await AsyncStorage.getItem(READING_PREFS_KEY)).toContain('"size":"xl"');
    warn.mockRestore();
  });
});
