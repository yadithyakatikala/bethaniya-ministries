import type { BrandGold, ThemeColors } from '../../theme';

/**
 * Everything the scene paints with, resolved for the active theme.
 *
 * The ground is the app's own paper and the fish is the app's own ink --
 * the film is drawn IN the product's palette, not on a stage of its own --
 * so the hand-off to the first screen is a cross-fade between two
 * surfaces that are already the same colour.
 */
export interface ScenePalette {
  ground: string;
  ink: string;
  gold: BrandGold;
}

export function scenePalette(colors: ThemeColors, gold: BrandGold): ScenePalette {
  return { ground: colors.paper, ink: colors.ink, gold };
}
