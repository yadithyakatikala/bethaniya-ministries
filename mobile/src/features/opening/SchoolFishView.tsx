import { G, Path } from 'react-native-svg';
import { FISH_A_D, FISH_B_D, FISH_STROKE } from './engine/constants';
import type { SchoolFish } from './engine/chapter';

/** The gradient ids one canvas defines for the school (see ChapterDefs). */
export interface SchoolPaint {
  /** Ink body of a fish. */
  fish: string;
  /** The small ribbons that trail each fish. */
  ribbon: string;
  /** The lit gold rim along its upper edge. */
  rim: string;
}

/**
 * One fish of the school.
 *
 * Drawn as the approved fish outline -- the same two arcs the opening
 * flies -- in ink, with two tiny gold ribbons trailing it and a thin gold
 * rim offset up and to the left, which is what a lit edge passing through
 * the school brightens. Everything about its placement arrives in `fish`;
 * this decides nothing.
 */
export function SchoolFishView({
  fish,
  paint,
}: {
  fish: SchoolFish;
  paint: SchoolPaint;
}) {
  if (fish.opacity <= 0.001) return null;
  return (
    <G
      x={fish.x}
      y={fish.y}
      rotation={fish.angle}
      scale={fish.scale}
      opacity={fish.opacity}
    >
      {fish.ribbons.map((ribbon, k) =>
        ribbon.d ? (
          <Path
            key={k}
            d={ribbon.d}
            fill={`url(#${paint.ribbon})`}
            opacity={ribbon.opacity}
          />
        ) : null
      )}
      <Path
        d={FISH_A_D}
        fill="none"
        stroke={`url(#${paint.fish})`}
        strokeLinecap="round"
        strokeWidth={FISH_STROKE}
      />
      <Path
        d={FISH_B_D}
        fill="none"
        stroke={`url(#${paint.fish})`}
        strokeLinecap="round"
        strokeWidth={FISH_STROKE}
      />
      <G opacity={fish.rimOpacity} x={-1.5} y={-2}>
        <Path
          d={FISH_A_D}
          fill="none"
          stroke={`url(#${paint.rim})`}
          strokeLinecap="round"
          strokeWidth={2.3}
        />
        <Path
          d={FISH_B_D}
          fill="none"
          stroke={`url(#${paint.rim})`}
          strokeLinecap="round"
          strokeWidth={2.3}
        />
      </G>
    </G>
  );
}
