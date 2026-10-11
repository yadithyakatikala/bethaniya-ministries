import { brandGold, darkTokens, lightTokens } from '../tokens';

/**
 * The brand's metallic gold.
 *
 * The opening and onboarding animations paint with these stops. They are
 * checked because gold fails quietly: a "gold" a few steps off reads as
 * mustard on paper or as beige on black, and nothing throws.
 */
function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const palettes = [
  { name: 'light', gold: brandGold.light, tokens: lightTokens },
  { name: 'dark', gold: brandGold.dark, tokens: darkTokens },
] as const;

describe.each(palettes)('the $name gold', ({ gold, tokens }) => {
  it("has `base` equal to the palette's accent -- the one gold that carries text", () => {
    expect(gold.base).toBe(tokens.accent);
  });

  it('reads as metal: a dark rim up to a near-white glint, in order', () => {
    const order = [gold.deep, gold.rim, gold.base, gold.high, gold.spec].map(luminance);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    // "Metal reads as metal because of the RANGE" -- a wide one.
    expect(order[4] / order[0]).toBeGreaterThan(10);
  });

  it('draws motes in four tiers that brighten', () => {
    const tiers = gold.dust.map(luminance);
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBeGreaterThan(tiers[i - 1]);
  });

  it('keeps the wordmark sheen dimmer than a mote glint, so a letter never washes out', () => {
    expect(luminance(gold.textPeak)).toBeLessThan(luminance(gold.spec));
    expect(luminance(gold.textPeak)).toBeLessThan(luminance(gold.high) + 0.001);
  });
});

describe('gold against the paper it is drawn on', () => {
  it('keeps the base gold readable as text in both themes (the accent rule, AA)', () => {
    expect(contrast(brandGold.light.base, lightTokens.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandGold.dark.base, darkTokens.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the wordmark's brightest point visible on the paper", () => {
    // The wordmark is a logotype, so WCAG's text threshold does not apply to
    // it; 3:1 is the floor for a meaningful graphic.
    expect(contrast(brandGold.light.textPeak, lightTokens.paper)).toBeGreaterThanOrEqual(
      3
    );
    expect(contrast(brandGold.dark.textPeak, darkTokens.paper)).toBeGreaterThanOrEqual(3);
  });

  it('lifts the fish ink off its own body without leaving the ink family', () => {
    // inkSoft is the faint lift through the middle of the fish.
    expect(contrast(brandGold.light.inkSoft, lightTokens.paper)).toBeGreaterThan(8);
    expect(contrast(brandGold.dark.inkSoft, darkTokens.paper)).toBeGreaterThan(8);
  });
});
