import React from 'react';
import { render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import {
  LegalScreen,
  PRIVACY_POLICY_BODY,
  PRIVACY_POLICY_TITLE,
  TERMS_BODY,
  TERMS_TITLE,
} from '../LegalScreen';

// LegalScreen uses useTheme(), which reads PreferencesContext, which reads
// AuthContext and transitively imports services/firebase/app.ts -- mock it
// away and wrap both providers, same pattern as every other screen test
// that touches useTheme() (e.g. SettingsScreen.test.tsx).
jest.mock('../../../services/firebase/app');

describe('LegalScreen', () => {
  it('renders the given title and body', async () => {
    const { getByTestId } = await render(
      <AuthProvider>
        <PreferencesProvider>
          <LegalScreen title="Example Title" body="Example body text." />
        </PreferencesProvider>
      </AuthProvider>
    );
    expect(getByTestId('legal-screen-title').props.children).toBe('Example Title');
    expect(getByTestId('legal-screen-body').props.children).toBe('Example body text.');
  });

  it('has non-empty, distinct Privacy Policy and Terms content ready for AppNavigator to render', () => {
    expect(PRIVACY_POLICY_TITLE.length).toBeGreaterThan(0);
    expect(TERMS_TITLE.length).toBeGreaterThan(0);
    expect(PRIVACY_POLICY_BODY.length).toBeGreaterThan(0);
    expect(TERMS_BODY.length).toBeGreaterThan(0);
    expect(PRIVACY_POLICY_BODY).not.toBe(TERMS_BODY);
  });
});
