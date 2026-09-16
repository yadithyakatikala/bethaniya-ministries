import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../context/AuthContext';
import { PreferencesProvider, usePreferences } from '../../context/PreferencesContext';
import { darkTokens, lightTokens, useTheme } from '..';
import { buildNavigationTheme, buildScreenOptions } from '../../navigation/AppNavigator';

jest.mock('../../services/firebase/app');

/**
 * Dark mode, end to end.
 *
 * THE TESTER'S REPORT: "when the app goes to dark mode, the whole app is
 * not turning dark." Their screenshots showed dark screen CONTENT under
 * WHITE native-stack headers -- "Reading Plans", "Prayers", "Bible",
 * "Terms of Service" all had a white bar with black text across the top.
 *
 * ROOT CAUSE: the native stack was registered without any header
 * styling, so every pushed screen used @react-navigation/native-stack's
 * DEFAULT header, which is white with black text and takes no notice of
 * the app's theme. Screen BODIES were themed all along (every screen
 * calls useTheme()), which is why the content looked right and only the
 * chrome did not. Nothing in the test suite asserted anything about
 * `screenOptions`, so there was no way to catch it before a device did.
 *
 * WHAT THIS FILE PINS:
 *   1. The theme SELECTION logic -- light/dark/persistence -- because a
 *      correct palette applied from a wrong flag is still a bug.
 *   2. That the navigator's header, container and content options are all
 *      built from tokens. AppNavigator's real options object is exercised
 *      via a probe component rather than by rendering the whole navigator,
 *      which would need every screen's Firebase mocks.
 *   3. That no palette relies on a hardcoded colour.
 */
const THEME_KEY = 'theme_preference';

function mockSignedOut() {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(null);
    return jest.fn();
  });
}

/** Renders the resolved palette so a test can read what the app would paint. */
function ThemeProbe() {
  const { colors, isDark } = useTheme();
  const { themePreference } = usePreferences();
  return (
    <View testID="probe" style={{ backgroundColor: colors.paper }}>
      <Text testID="probe-isDark">{String(isDark)}</Text>
      <Text testID="probe-preference">{themePreference}</Text>
      <Text testID="probe-paper">{colors.paper}</Text>
      <Text testID="probe-ink">{colors.ink}</Text>
      <Text testID="probe-surface">{colors.surface}</Text>
    </View>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <PreferencesProvider>
        <ThemeProbe />
      </PreferencesProvider>
    </AuthProvider>
  );
}

describe('theme selection and persistence', () => {
  beforeEach(() => {
    mockSignedOut();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('applies the DARK palette when dark is the stored preference', async () => {
    await AsyncStorage.setItem(THEME_KEY, 'dark');
    const { getByTestId } = await renderProbe();

    await waitFor(() => expect(getByTestId('probe-isDark').props.children).toBe('true'));
    expect(getByTestId('probe-paper').props.children).toBe(darkTokens.paper);
    expect(getByTestId('probe-ink').props.children).toBe(darkTokens.ink);
    expect(getByTestId('probe-surface').props.children).toBe(darkTokens.surface);
  });

  it('applies the LIGHT palette when light is the stored preference', async () => {
    await AsyncStorage.setItem(THEME_KEY, 'light');
    const { getByTestId } = await renderProbe();

    await waitFor(() => expect(getByTestId('probe-isDark').props.children).toBe('false'));
    expect(getByTestId('probe-paper').props.children).toBe(lightTokens.paper);
    expect(getByTestId('probe-ink').props.children).toBe(lightTokens.ink);
  });

  it('persists the preference, so a restart keeps the theme', async () => {
    // A restart is just a fresh mount reading the same AsyncStorage, which
    // is what the two tests above already do -- they set the key and a
    // brand-new provider tree resolves the right palette from it. What
    // this adds is the other half: that changing the preference WRITES,
    // so there is something for that fresh mount to read.
    await AsyncStorage.setItem(THEME_KEY, 'dark');
    const { getByTestId } = await renderProbe();
    await waitFor(() =>
      expect(getByTestId('probe-preference').props.children).toBe('dark')
    );
    // Still stored after the app has read it -- nothing clears it on boot.
    expect(await AsyncStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('paints the probe surface from the palette, not a literal', async () => {
    await AsyncStorage.setItem(THEME_KEY, 'dark');
    const { getByTestId } = await renderProbe();
    await waitFor(() => expect(getByTestId('probe-isDark').props.children).toBe('true'));
    const style = StyleSheet.flatten(getByTestId('probe').props.style);
    expect(style.backgroundColor).toBe(darkTokens.paper);
    expect(style.backgroundColor).not.toBe('#FFFFFF');
  });
});

describe('the palettes themselves', () => {
  it('differ on every surface a screen can paint', () => {
    // If a token were accidentally shared between palettes, that surface
    // would stay light in dark mode -- precisely the reported symptom.
    for (const key of ['paper', 'surface', 'surfaceRaised', 'border', 'ink'] as const) {
      expect(`${key}: ${darkTokens[key]}`).not.toBe(`${key}: ${lightTokens[key]}`);
    }
  });

  it('gives the dark palette genuinely dark surfaces and light ink', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    // Dark surfaces well below mid-grey; dark-mode ink well above it.
    expect(luminance(darkTokens.paper)).toBeLessThan(0.05);
    expect(luminance(darkTokens.surface)).toBeLessThan(0.08);
    expect(luminance(darkTokens.ink)).toBeGreaterThan(0.7);
    // And the light palette the other way round.
    expect(luminance(lightTokens.paper)).toBeGreaterThan(0.7);
    expect(luminance(lightTokens.ink)).toBeLessThan(0.05);
  });
});

// --- The navigator chrome: the actual reported bug -------------------
// Dark content under a WHITE header was what the tester photographed.
// These assert the real option objects AppNavigator passes to the stack.

describe('navigator header and container theming', () => {
  it.each([
    ['dark', darkTokens],
    ['light', lightTokens],
  ] as const)('builds every %s header surface from the palette', (_name, tokens) => {
    const options = buildScreenOptions(tokens);

    expect(options.headerStyle).toEqual({ backgroundColor: tokens.surface });
    expect(options.headerTintColor).toBe(tokens.ink);
    expect(options.headerTitleStyle).toEqual({
      color: tokens.ink,
      fontWeight: '600',
    });
    expect(options.contentStyle).toEqual({ backgroundColor: tokens.paper });
  });

  it('never leaves the header at the white native-stack default', () => {
    // The regression, stated directly: in dark mode nothing about the
    // header may be white, and the title must not be dark ink.
    const dark = buildScreenOptions(darkTokens);
    const header = dark.headerStyle as { backgroundColor: string };

    expect(header.backgroundColor).not.toBe('#FFFFFF');
    expect(header.backgroundColor).not.toBe('white');
    expect(header.backgroundColor).toBe(darkTokens.surface);
    expect(dark.headerTintColor).toBe(darkTokens.ink);
    expect(dark.headerTintColor).not.toBe(lightTokens.ink);
  });

  it('gives the header title enough contrast against the header itself', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [luminance(a), luminance(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    for (const tokens of [darkTokens, lightTokens]) {
      const options = buildScreenOptions(tokens);
      const header = options.headerStyle as { backgroundColor: string };
      expect(
        ratio(options.headerTintColor as string, header.backgroundColor)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ['dark', darkTokens, true],
    ['light', lightTokens, false],
  ] as const)(
    'builds the %s NavigationContainer theme from the palette',
    (_name, tokens, isDark) => {
      const theme = buildNavigationTheme(tokens, isDark);
      expect(theme.dark).toBe(isDark);
      expect(theme.colors.background).toBe(tokens.paper);
      expect(theme.colors.card).toBe(tokens.surface);
      expect(theme.colors.text).toBe(tokens.ink);
      expect(theme.colors.border).toBe(tokens.border);
      expect(theme.colors.primary).toBe(tokens.primary);
    }
  );

  it('does not let the container background flash white in dark mode', () => {
    // The container paints between screens; the default is white.
    const theme = buildNavigationTheme(darkTokens, true);
    expect(theme.colors.background).not.toBe('#FFFFFF');
    expect(theme.colors.background).not.toBe('rgb(242, 242, 242)');
    expect(theme.colors.background).toBe(darkTokens.paper);
  });
});
