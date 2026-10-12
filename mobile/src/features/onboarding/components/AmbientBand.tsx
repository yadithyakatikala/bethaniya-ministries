import { useMemo } from 'react';
import {
  CHAPTER_T,
  getChapterScene,
  renderBandFrame,
} from '../../opening/engine/chapter';
import type { ScenePalette } from '../../opening/palette';
import { SchoolBand } from '../../opening/SchoolBand';
import { useAmbientClock } from '../../opening/useAmbientClock';

/**
 * The settled school, swaying gently above every question.
 *
 * Owns its own slow clock for the same reason the chapter does: ninety
 * shapes redrawing a few times a second must not drag the form beneath
 * them along. The clock carries on from where the chapter ended, so the
 * hand-over from one to the other is not a jump.
 *
 * With reduced motion the school does not sway: it is a still.
 */
export function AmbientBand({
  palette,
  width,
  compact,
  still,
}: {
  palette: ScenePalette;
  width: number;
  compact: number;
  still: boolean;
}) {
  const scene = useMemo(() => getChapterScene(), []);
  const t = useAmbientClock({ active: !still, start: CHAPTER_T.total });
  const school = useMemo(
    () => renderBandFrame(scene, CHAPTER_T.total, { ambientT: still ? 0 : t, compact }),
    [scene, still, t, compact]
  );
  return <SchoolBand school={school} palette={palette} width={width} compact={compact} />;
}
