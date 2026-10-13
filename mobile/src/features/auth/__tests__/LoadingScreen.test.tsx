import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { translate } from '../../../i18n';
import { darkTokens, lightTokens } from '../../../theme';
import { LoadingScreen } from '../LoadingScreen';

jest.mock('../../../services/firebase/app');

/**
 * LoadingScreen is the FIRST frame of the app -- it renders while
 * AuthContext waits for Firebase's initial auth state, before any other
 * screen has painted. It shipped with no `backgroundColor` at all, so in
 * dark mode every cold start flashed the default white surface before
 * Home or Sign In painted `colors.paper` over it, and its 14px label was
 * a hardcoded '#666' that is unreadable on the dark palette.
 */
describe('LoadingScreen', () => {
  // render() is async in this version of @testing-library/react-native --
  // every other suite in this repo awaits it too.
  async function renderWithTheme() {
    // PreferencesProvider reads useAuth() to know whose preferences to
    // sync, so it needs AuthProvider above it -- same as App.tsx.
    return render(
      <AuthProvider>
        <PreferencesProvider>
          <LoadingScreen />
        </PreferencesProvider>
      </AuthProvider>
    );
  }

  it('paints an explicit themed background rather than leaving it transparent', async () => {
    const { getByTestId } = await renderWithTheme();
    const flattened = StyleSheet.flatten(getByTestId('auth-loading-screen').props.style);
    // PreferencesContext resolves to one palette or the other; which one
    // is not this test's business, an ABSENT colour is.
    expect([lightTokens.background, darkTokens.background]).toContain(
      flattened.backgroundColor
    );
  });

  it('renders no hardcoded colour', async () => {
    const { getByTestId } = await renderWithTheme();
    expect(JSON.stringify(getByTestId('auth-loading-screen'))).not.toContain('#666');
  });

  // --- The look: the portrait, a gold thread, and "Loading…" --------------

  it('stands the round portrait over a short gold thread over "Loading…", in the middle of the screen', async () => {
    const { getByTestId, getByText } = await renderWithTheme();
    const hidden = { includeHiddenElements: true };
    expect(
      StyleSheet.flatten(getByTestId('auth-loading-portrait', hidden).props.style)
    ).toMatchObject({
      width: 96,
      height: 96,
      borderRadius: 48,
    });
    expect(
      StyleSheet.flatten(getByTestId('auth-loading-thread', hidden).props.style)
    ).toMatchObject({
      width: 132,
      height: 2,
    });
    expect(getByText('Loading…')).toBeTruthy();
    expect(
      StyleSheet.flatten(getByTestId('auth-loading-screen').props.style)
    ).toMatchObject({
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
    });
  });

  it('is ONE announcement for a screen reader -- a busy progress indicator named "Loading…" -- not three things to swipe past', async () => {
    const { getByTestId } = await renderWithTheme();
    const screen = getByTestId('auth-loading-screen');
    expect(screen.props.accessible).toBe(true);
    expect(screen.props.accessibilityRole).toBe('progressbar');
    expect(screen.props.accessibilityLabel).toBe('Loading…');
    expect(screen.props.accessibilityState).toMatchObject({ busy: true });
  });

  it('says it in Telugu under a Telugu interface', async () => {
    await AsyncStorage.setItem('app_language_preference', 'te');
    const { getByTestId } = await renderWithTheme();
    await waitFor(() =>
      expect(getByTestId('auth-loading-screen').props.accessibilityLabel).toBe(
        translate('te', 'common.loading')
      )
    );
    await AsyncStorage.removeItem('app_language_preference');
  });
});
