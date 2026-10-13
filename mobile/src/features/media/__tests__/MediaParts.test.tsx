import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { fontFamilies, lightTokens } from '../../../theme/tokens';
import { PlayMarker, PostVerse } from '../MediaParts';

jest.mock('../../../services/firebase/app');

/**
 * The two small pieces the feed card and the detail share: the marker over a
 * video's poster, and the verse a post quotes.
 */
function renderIn(ui: React.ReactElement) {
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, onNext) => {
    onNext(null);
    return jest.fn();
  });
  return render(
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
}

const fontOf = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as never) as { fontFamily?: string }).fontFamily;

describe('PlayMarker', () => {
  it('is a round disc in the primary ink with the play triangle in the on-primary colour', async () => {
    const screen = await renderIn(<PlayMarker testID="marker" size={56} />);
    const style = StyleSheet.flatten(screen.getByTestId('marker').props.style) as {
      width: number;
      height: number;
      borderRadius: number;
      backgroundColor: string;
    };
    expect(style.width).toBe(56);
    expect(style.height).toBe(56);
    expect(style.borderRadius).toBe(28);
    expect(style.backgroundColor).toBe(lightTokens.primary);
    expect(JSON.stringify(screen.getByTestId('marker'))).toContain(lightTokens.onPrimary);
  });
});

describe('PostVerse', () => {
  it('sets the words and, beneath them, the reference', async () => {
    const screen = await renderIn(
      <PostVerse testID="verse" text="For God so loved the world" reference="John 3:16" />
    );
    expect(screen.getByText('For God so loved the world')).toBeTruthy();
    expect(screen.getByText('John 3:16')).toBeTruthy();
  });

  it('sets English words in the English serif and Telugu words in the Telugu serif', async () => {
    const english = await renderIn(
      <PostVerse text="The Lord is my shepherd" reference="Psalm 23:1" />
    );
    expect(fontOf(english.getByText('The Lord is my shepherd'))).toBe(
      fontFamilies.serifEnRegular
    );
    await english.unmount();

    const telugu = await renderIn(
      <PostVerse text="యెహోవా నా కాపరి" reference="కీర్తన 23:1" />
    );
    expect(fontOf(telugu.getByText('యెహోవా నా కాపరి'))).toBe(fontFamilies.serifTeRegular);
  });

  it('sets words that mix the two in the interface family, which covers both', async () => {
    const screen = await renderIn(
      <PostVerse text="యెహోవా is my shepherd" reference="Psalm 23:1" />
    );
    expect(fontOf(screen.getByText('యెహోవా is my shepherd'))).toBe(
      fontFamilies.interfaceRegular
    );
  });

  it('draws the reference in the gold ink', async () => {
    const screen = await renderIn(<PostVerse text="x" reference="John 3:16" />);
    const color = (
      StyleSheet.flatten(screen.getByText('John 3:16').props.style) as { color?: string }
    ).color;
    expect(color).toBe(lightTokens.accent);
  });

  it('can carry the words without a reference, or a reference without the words', async () => {
    const words = await renderIn(<PostVerse text="Only words" reference={null} />);
    expect(words.getByText('Only words')).toBeTruthy();
    await words.unmount();

    const ref = await renderIn(<PostVerse text={null} reference="John 3:16" />);
    expect(ref.getByText('John 3:16')).toBeTruthy();
  });
});
