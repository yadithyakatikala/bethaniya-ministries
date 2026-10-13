import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { BrandPortrait } from '../BrandPortrait';

/**
 * The round portrait, as a mark. It is the same bundled picture the opening
 * ends on; what is worth pinning is that it is a CIRCLE at whatever size it
 * is given, and that it is decoration -- hidden from a screen reader, since
 * the word MARANATHA or the screen's title is what names the app.
 */
const hidden = { includeHiddenElements: true } as const;

describe('BrandPortrait', () => {
  it.each([96, 72, 44])('is a circle %i across', async (size) => {
    const { getByTestId } = await render(<BrandPortrait size={size} testID="p" />);
    expect(StyleSheet.flatten(getByTestId('p', hidden).props.style)).toMatchObject({
      width: size,
      height: size,
      borderRadius: size / 2,
    });
  });

  it('is the bundled portrait, cover-fitted', async () => {
    const { getByTestId } = await render(<BrandPortrait size={72} testID="p" />);
    const image = getByTestId('p', hidden);
    expect(image.props.resizeMode).toBe('cover');
    // A picture of a person is exempt from colour inversion.
    expect(image.props.accessibilityIgnoresInvertColors).toBe(true);
    expect(image.props.source).toBeTruthy();
  });

  it('is decoration: hidden from a screen reader, and not focusable', async () => {
    const { getByTestId } = await render(<BrandPortrait size={72} testID="p" />);
    const image = getByTestId('p', hidden);
    expect(image.props.accessible).toBe(false);
    expect(image.props.accessibilityElementsHidden).toBe(true);
    expect(image.props.importantForAccessibility).toBe('no');
  });

  it('keeps its shape when a caller adds a style of its own', async () => {
    const { getByTestId } = await render(
      <BrandPortrait size={44} testID="p" style={{ opacity: 0.5 }} />
    );
    expect(StyleSheet.flatten(getByTestId('p', hidden).props.style)).toMatchObject({
      width: 44,
      borderRadius: 22,
      opacity: 0.5,
    });
  });
});
