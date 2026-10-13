import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
import { AuthProvider } from '../../../context/AuthContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import { BrandFish } from '../BrandFish';
import { FISH_A_D, FISH_B_D } from '../engine/constants';

jest.mock('../../../services/firebase/app');

async function renderFish(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </AuthProvider>
  );
}

afterEach(async () => {
  await cleanup();
});

/** The mark is the fish the opening draws, so what matters is that it IS that fish. */
describe('BrandFish', () => {
  it('draws the same two arcs as the opening and the school', async () => {
    const { toJSON } = await renderFish(<BrandFish size={36} />);
    const json = JSON.stringify(toJSON());
    // The path strings are the engine's own (there is no separate fish file).
    expect(json).toContain(`"d":${JSON.stringify(FISH_A_D)}`);
    expect(json).toContain(`"d":${JSON.stringify(FISH_B_D)}`);
  });

  it('is decorative: a picture of a fish carries no words', async () => {
    const { getByTestId } = await renderFish(<BrandFish testID="fish" />);
    expect(
      getByTestId('fish', { includeHiddenElements: true }).props
        .accessibilityElementsHidden
    ).toBe(true);
  });

  it('keeps its proportions: the width is the size and the height follows', async () => {
    const { getByTestId } = await renderFish(<BrandFish size={44} testID="fish" />);
    const props = getByTestId('fish', { includeHiddenElements: true }).props;
    expect(props.width).toBe(44);
    expect(props.height).toBeCloseTo((44 * 36) / 88, 5);
  });

  it('paints the metallic gradient only at 24 points and up; a small fish is flat gold ink', async () => {
    const big = await renderFish(<BrandFish size={36} />);
    const bigJson = JSON.stringify(big.toJSON());
    await big.unmount();
    const small = await renderFish(<BrandFish size={20} />);
    const smallJson = JSON.stringify(small.toJSON());
    expect(bigJson).toContain('RNSVGLinearGradient');
    expect(smallJson).not.toContain('RNSVGLinearGradient');
  });
});
