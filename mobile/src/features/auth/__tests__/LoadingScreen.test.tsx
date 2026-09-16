import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
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
});
