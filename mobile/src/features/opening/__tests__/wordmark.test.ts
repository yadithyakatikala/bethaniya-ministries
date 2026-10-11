import { LETTER_X, WORD, WORD_TEXT } from '../engine/constants';
import { LETTER_PATHS, translatePath } from '../engine/wordmark';
import { WORDMARK_GLYPHS } from '../engine/wordmarkGlyphs';

/** Bounding box of an absolute path's on-curve and control points. */
function bounds(d: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const m of d.matchAll(/([MLHVQCZ])([^MLHVQCZ]*)/g)) {
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (m[1] === 'H') xs.push(...nums);
    else if (m[1] === 'V') ys.push(...nums);
    else
      for (let i = 0; i < nums.length; i += 2) {
        xs.push(nums[i]);
        ys.push(nums[i + 1]);
      }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe('translatePath', () => {
  it('moves every absolute command, including H and V', () => {
    expect(translatePath('M1 2L3 4H5V6Q7 8 9 10Z', 10, 100)).toBe(
      'M11 102L13 104H15V106Q17 108 19 110Z'
    );
  });

  it('keeps cubic control points together', () => {
    expect(translatePath('M0 0C1 1 2 2 3 3', 1, 1)).toBe('M1 1C2 2 3 3 4 4');
  });

  it('refuses relative commands rather than mis-placing a letter', () => {
    expect(() => translatePath('M0 0l1 1', 1, 1)).toThrow(/absolute/);
    expect(() => translatePath('M0 0 A1 1 0 0 1 2 2', 1, 1)).toThrow(/absolute/);
  });
});

describe('the wordmark', () => {
  it('has one outline per letter of MARANATHA, from the bundled font', () => {
    expect(WORD_TEXT).toBe('MARANATHA');
    expect(LETTER_PATHS).toHaveLength(9);
    expect(Object.keys(WORDMARK_GLYPHS).sort()).toEqual(['A', 'H', 'M', 'N', 'R', 'T']);
  });

  it('sits each letter on the baseline, at cap height, centred on its measured position', () => {
    LETTER_PATHS.forEach((d, k) => {
      const b = bounds(d);
      // Flat-bottomed serif capitals all rest on the baseline.
      expect(Math.abs(b.maxY - WORD.y)).toBeLessThan(0.3);
      // Noto Serif's cap height is 0.714 em: 11.4 units at 16.
      expect(WORD.y - b.minY).toBeGreaterThan(11);
      expect(WORD.y - b.minY).toBeLessThan(12);
      // The glyph's ink is centred on its advance box to within a unit and a half.
      expect(Math.abs((b.minX + b.maxX) / 2 - LETTER_X[k])).toBeLessThan(1.5);
    });
  });

  it('runs left to right as one word, centred on the scene', () => {
    const first = bounds(LETTER_PATHS[0]);
    const last = bounds(LETTER_PATHS[8]);
    for (let k = 1; k < 9; k++) {
      expect(bounds(LETTER_PATHS[k]).minX).toBeGreaterThan(
        bounds(LETTER_PATHS[k - 1]).minX
      );
    }
    const mid = (first.minX + last.maxX) / 2;
    expect(Math.abs(mid - WORD.x)).toBeLessThan(2);
  });

  it('draws the same letter the same way each time it appears', () => {
    // A, at positions 1, 3 and 5, is the same outline moved sideways.
    const shape = (k: number) => {
      const b = bounds(LETTER_PATHS[k]);
      return [b.maxX - b.minX, b.maxY - b.minY].map((v) => Number(v.toFixed(2)));
    };
    expect(shape(1)).toEqual(shape(3));
    expect(shape(3)).toEqual(shape(5));
    expect(shape(5)).toEqual(shape(8));
  });
});
