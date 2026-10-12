import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { SongCover } from '../SongCover';

jest.mock('../../../services/firebase/app');

const hidden = { includeHiddenElements: true };

async function renderCover(uri: string | null) {
  const ui = (u: string | null) => (
    <AuthProvider>
      <PreferencesProvider>
        <SongCover testID="cover" uri={u} size={56} radius={12} glyphSize={22} />
      </PreferencesProvider>
    </AuthProvider>
  );
  const utils = await render(ui(uri));
  return { ...utils, rerenderWith: (u: string | null) => utils.rerender(ui(u)) };
}

describe('SongCover', () => {
  it('is a square of the size and radius it is given', async () => {
    const { getByTestId } = await renderCover(null);
    const style = StyleSheet.flatten(getByTestId('cover', hidden).props.style);
    expect(style).toMatchObject({ width: 56, height: 56, borderRadius: 12 });
  });

  it('shows the picture when there is a link, and the note tile when there is none', async () => {
    const withLink = await renderCover('https://example.com/c.jpg');
    expect(withLink.getByTestId('cover-image', hidden)).toBeTruthy();
    await withLink.unmount();

    const without = await renderCover(null);
    expect(without.queryByTestId('cover-image', hidden)).toBeNull();
  });

  it('falls back to the tile when the picture does not load, and tries a new link afresh', async () => {
    const { getByTestId, queryByTestId, rerenderWith } = await renderCover(
      'https://example.com/dead.jpg'
    );
    await fireEvent(getByTestId('cover-image', hidden), 'error');
    expect(queryByTestId('cover-image', hidden)).toBeNull();

    // The same dead link stays on the tile; a different link gets its own try.
    await rerenderWith('https://example.com/dead.jpg');
    expect(queryByTestId('cover-image', hidden)).toBeNull();
    await rerenderWith('https://example.com/new.jpg');
    expect(getByTestId('cover-image', hidden)).toBeTruthy();
  });

  it('is decoration: hidden from a screen reader', async () => {
    const { getByTestId } = await renderCover('https://example.com/c.jpg');
    expect(getByTestId('cover', hidden).props.accessibilityElementsHidden).toBe(true);
  });
});
