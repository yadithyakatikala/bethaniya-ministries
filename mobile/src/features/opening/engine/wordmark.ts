/**
 * The MARANATHA wordmark as nine paths in scene coordinates.
 *
 * Each letter is its glyph outline (./wordmarkGlyphs.ts, generated from
 * the bundled Noto Serif SemiBold) moved so its advance box is centred on
 * the position the approved film measured for it, with the baseline on
 * WORD.y.
 *
 * They are baked into scene coordinates, not positioned with a transform,
 * so the sheen gradient -- which is in scene space and has to run
 * continuously across all nine letters -- lines up with every one of them.
 */
import { LETTER_X, WORD, WORD_TEXT } from './constants';
import { WORDMARK_GLYPHS } from './wordmarkGlyphs';

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function fmt(v: number): string {
  const s = v.toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}

/**
 * Moves an ABSOLUTE path (M L H V Q C Z) by (dx, dy). Glyph outlines from
 * the generator use only those commands; anything else throws, so a
 * regenerated font cannot silently produce a mis-placed letter.
 */
export function translatePath(d: string, dx: number, dy: number): string {
  if (/[^MLHVQCZ0-9eE.,\s-]/.test(d)) {
    throw new Error('translatePath: only absolute M L H V Q C Z paths are supported');
  }
  let out = '';
  const commands = /([MLHVQCZ])([^MLHVQCZ]*)/g;
  let match: RegExpExecArray | null;
  while ((match = commands.exec(d)) !== null) {
    const cmd = match[1];
    const nums = (match[2].match(NUMBER) ?? []).map(Number);
    switch (cmd) {
      case 'H':
        out += `H${nums.map((n) => fmt(n + dx)).join(' ')}`;
        break;
      case 'V':
        out += `V${nums.map((n) => fmt(n + dy)).join(' ')}`;
        break;
      case 'Z':
        out += 'Z';
        break;
      default: {
        // M, L, Q, C: every number alternates x, y.
        const moved = nums.map((n, i) => fmt(n + (i % 2 === 0 ? dx : dy)));
        out += `${cmd}${moved.join(' ')}`;
      }
    }
  }
  return out;
}

export const LETTER_PATHS: readonly string[] = WORD_TEXT.split('').map((ch, k) => {
  const glyph = WORDMARK_GLYPHS[ch];
  return translatePath(glyph.d, LETTER_X[k] - glyph.advance / 2, WORD.y);
});
