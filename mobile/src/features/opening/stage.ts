/**
 * Where the onboarding scene sits on a real screen.
 *
 * The chapter is drawn in the reference phone's pixels (390 x 844, see
 * ./engine/chapter.ts). A real device is not that size, so ONE uniform
 * scale -- the screen's width over 390 -- maps the scene onto it, and the
 * scene is anchored to the school's band rather than to the screen's
 * centre: wherever the band lands in the layout (under the status bar, the
 * header and a safe-area inset of any height), the school is exactly in
 * it, and the portrait and the word sit where they sit relative to it.
 *
 * On a tablet the scene would otherwise be blown up to fill the width, so
 * it is held to a phone-sized column and centred.
 */
import { BAND, STAGE } from './engine/chapter';

/** The widest the scene is ever drawn. Beyond it the screen's paper shows at the sides. */
export const MAX_STAGE_WIDTH = 480;

export interface StageMapping {
  /** Screen points per reference pixel. */
  scale: number;
  /** The viewBox of a full-screen layer, in reference pixels. */
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
}

/**
 * @param width   the screen's width, in points
 * @param height  the screen's height, in points
 * @param bandTop where the school's band begins on the screen, in points
 */
export function stageMapping(
  width: number,
  height: number,
  bandTop: number
): StageMapping {
  const stageWidth = Math.min(width, MAX_STAGE_WIDTH);
  const scale = stageWidth / STAGE.w;
  const left = (width - stageWidth) / 2;
  return {
    scale,
    viewX: -left / scale,
    viewY: BAND.y0 - bandTop / scale,
    viewW: width / scale,
    viewH: height / scale,
  };
}

/** The band itself: how tall it is on this screen, settled and with the keyboard up. */
export const BAND_COMPACT_HEIGHT = 44;

export function bandHeight(scale: number, compact: number): number {
  const settled = BAND.h * scale;
  return settled + (BAND_COMPACT_HEIGHT - settled) * compact;
}
