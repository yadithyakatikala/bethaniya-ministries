/**
 * Shared geometry for the hand-drawn icon set.
 *
 * WHY THE ICONS ARE DRAWN FROM VIEWS AT ALL. Checked, as required: this
 * project has no icon or SVG dependency -- not `@expo/vector-icons`, not
 * `react-native-svg`, not even transitively. Adding one for a dozen
 * 22dp glyphs would ship a native asset and a new release-build surface
 * for something the app can draw itself. Deliberately not emoji either:
 * emoji are the platform's own multicolour artwork, cannot take a theme
 * colour, and differ across Android versions.
 *
 * WHY THIS FILE EXISTS. The two icon modules had drifted: TabIcons used
 * a stroke ratio of 0.08 in three glyphs and 0.09 in two, FeatureIcons
 * used 0.085 in three and 0.09 in two, and the default sizes were 22 and
 * 20. Side by side -- and they do sit side by side, on Home, where the
 * feature tiles are directly above the tab bar -- the weights visibly
 * disagreed. One ratio, one minimum, one default.
 */

/** Nominal glyph box, in dp. */
export const ICON_SIZE = 22;

/**
 * Stroke as a fraction of the glyph box. 0.085 at 22dp is 1.87dp, which
 * renders as a crisp 2px line on a 1x screen and stays optically even
 * against the bundled type's stem weights.
 */
export const ICON_STROKE_RATIO = 0.085;

/**
 * A hairline under ~1.5dp disappears on a 1x screen, so every glyph
 * clamps to this no matter how small it is asked to draw.
 */
export const ICON_MIN_STROKE = 1.5;

export function strokeFor(size: number): number {
  return Math.max(ICON_MIN_STROKE, size * ICON_STROKE_RATIO);
}

export interface IconProps {
  color: string;
  size?: number;
  /** True for the active/selected state -- filled rather than outlined. */
  filled?: boolean;
}
