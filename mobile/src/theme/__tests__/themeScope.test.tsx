import React from 'react';
import { Text, View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider } from '../../context/PreferencesContext';
import {
  ThemeScope,
  brandGold,
  darkTokens,
  lightTokens,
  sepiaTokens,
  useTheme,
} from '..';
import { highlightTints } from '../tokens';

jest.mock('../../services/firebase/app');

/**
 * The sepia reading page is a scope, not a theme.
 *
 * `useTheme()` is what every component reads its colours from, so a scope that
 * changes what it returns changes a whole subtree -- the reader's page and its
 * chrome -- without any component knowing. The two properties worth pinning
 * are that it DOES reach the subtree, and that `palette={null}` puts a subtree
 * BACK in the app's own palette: the reader's sheets are rendered inside
 * a Modal, which keeps the context of where it was written, so without that
 * reset every sheet over a sepia page would be sepia too.
 */
function Probe({ id }: { id: string }) {
  const { colors, isDark, highlights, gold } = useTheme();
  return (
    <View>
      <Text testID={`${id}-paper`}>{colors.paper}</Text>
      <Text testID={`${id}-isDark`}>{String(isDark)}</Text>
      <Text testID={`${id}-highlight`}>{highlights.yellow}</Text>
      <Text testID={`${id}-gold`}>{gold.base}</Text>
    </View>
  );
}

function renderIn(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(null);
    return jest.fn();
  });
});

afterEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('ThemeScope', () => {
  it('is the app palette where there is no scope', async () => {
    const { getByTestId } = await renderIn(<Probe id="a" />);
    await waitFor(() =>
      expect(getByTestId('a-paper')).toHaveTextContent(lightTokens.paper)
    );
    expect(getByTestId('a-isDark')).toHaveTextContent('false');
  });

  it('sets its subtree in the sepia palette -- paper, highlights and gold -- and calls it light', async () => {
    const { getByTestId } = await renderIn(
      <ThemeScope palette="sepia">
        <Probe id="s" />
      </ThemeScope>
    );
    await waitFor(() =>
      expect(getByTestId('s-paper')).toHaveTextContent(sepiaTokens.paper)
    );
    expect(getByTestId('s-highlight')).toHaveTextContent(highlightTints.sepia.yellow);
    expect(getByTestId('s-gold')).toHaveTextContent(brandGold.sepia.base);
    // Sepia is a warm LIGHT page: nothing that branches on isDark (an image
    // tint, a status bar) should treat it as dark.
    expect(getByTestId('s-isDark')).toHaveTextContent('false');
  });

  it('leaves a sibling outside the scope in the app palette', async () => {
    const { getByTestId } = await renderIn(
      <View>
        <ThemeScope palette="sepia">
          <Probe id="in" />
        </ThemeScope>
        <Probe id="out" />
      </View>
    );
    await waitFor(() =>
      expect(getByTestId('in-paper')).toHaveTextContent(sepiaTokens.paper)
    );
    expect(getByTestId('out-paper')).toHaveTextContent(lightTokens.paper);
  });

  it('puts a nested subtree back in the app palette with palette={null}', async () => {
    const { getByTestId } = await renderIn(
      <ThemeScope palette="sepia">
        <Probe id="page" />
        <ThemeScope palette={null}>
          <Probe id="sheet" />
        </ThemeScope>
      </ThemeScope>
    );
    await waitFor(() =>
      expect(getByTestId('page-paper')).toHaveTextContent(sepiaTokens.paper)
    );
    expect(getByTestId('sheet-paper')).toHaveTextContent(lightTokens.paper);
  });

  it('leaves the app in DARK outside the scope, when the app is dark', async () => {
    await AsyncStorage.setItem('theme_preference', 'dark');
    const { getByTestId } = await renderIn(
      <View>
        <ThemeScope palette="sepia">
          <Probe id="page" />
          <ThemeScope palette={null}>
            <Probe id="sheet" />
          </ThemeScope>
        </ThemeScope>
        <Probe id="app" />
      </View>
    );
    await waitFor(() =>
      expect(getByTestId('app-paper')).toHaveTextContent(darkTokens.paper)
    );
    expect(getByTestId('app-isDark')).toHaveTextContent('true');
    // The page is sepia whatever the app is; the sheet is the app's dark.
    expect(getByTestId('page-paper')).toHaveTextContent(sepiaTokens.paper);
    expect(getByTestId('page-isDark')).toHaveTextContent('false');
    expect(getByTestId('sheet-paper')).toHaveTextContent(darkTokens.paper);
  });
});
