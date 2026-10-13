import { BAND } from '../engine/chapter';
import { BAND_COMPACT_HEIGHT, MAX_STAGE_WIDTH, bandHeight, stageMapping } from '../stage';

/**
 * Where the onboarding scene sits on a real screen: one uniform scale,
 * anchored to the band, held to a phone-sized column on a tablet.
 */
describe('stageMapping', () => {
  it('is the identity on the reference phone with the band where the design puts it', () => {
    const m = stageMapping(390, 844, BAND.y0);
    expect(m.scale).toBe(1);
    // (toBeCloseTo, not toBe: the view's origin may be -0, which draws the same)
    expect(m.viewX).toBeCloseTo(0, 10);
    expect(m.viewY).toBeCloseTo(0, 10);
    expect(m.viewW).toBe(390);
    expect(m.viewH).toBe(844);
  });

  it("scales the whole scene by the screen's width over 390", () => {
    const m = stageMapping(360, 800, 100);
    expect(m.scale).toBeCloseTo(360 / 390, 10);
    expect(m.viewW * m.scale).toBeCloseTo(360, 8);
    expect(m.viewH * m.scale).toBeCloseTo(800, 8);
  });

  it("puts the school's band exactly where the layout puts it, whatever the safe area", () => {
    for (const bandTop of [69, 96, 121, 160]) {
      const m = stageMapping(375, 812, bandTop);
      // A point at the band's top edge (y = 96) lands at `bandTop` on the screen.
      const screenY = (BAND.y0 - m.viewY) * m.scale;
      expect(screenY).toBeCloseTo(bandTop, 8);
    }
  });

  it('keeps the scene to a phone-sized column on a tablet, centred', () => {
    const m = stageMapping(1024, 1366, 120);
    expect(m.scale).toBeCloseTo(MAX_STAGE_WIDTH / 390, 10);
    // The reference x = 0 (the scene's left edge) lands at the column's left edge.
    const left = (0 - m.viewX) * m.scale;
    expect(left).toBeCloseTo((1024 - MAX_STAGE_WIDTH) / 2, 6);
    // and the full screen is still covered by the layer
    expect(m.viewW * m.scale).toBeCloseTo(1024, 6);
  });
});

describe('bandHeight', () => {
  it('is 150 reference points settled and a 44-point strip with the keyboard up', () => {
    expect(bandHeight(1, 0)).toBe(150);
    expect(bandHeight(1, 1)).toBe(BAND_COMPACT_HEIGHT);
    expect(BAND_COMPACT_HEIGHT).toBe(44);
  });

  it('scales with the screen and glides between the two', () => {
    expect(bandHeight(0.5, 0)).toBe(75);
    const mid = bandHeight(1, 0.5);
    expect(mid).toBeLessThan(150);
    expect(mid).toBeGreaterThan(44);
  });
});
