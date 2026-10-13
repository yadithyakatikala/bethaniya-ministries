/**
 * Which typeface a piece of church-written or member-typed text takes.
 *
 * A name, a prayer request, a post: none of them has a language the app
 * knows in advance, and the bundled faces do not all cover all scripts
 * (see fontFamilies in ./tokens.ts):
 *
 *   Noto Serif          Latin only
 *   Noto Serif Telugu   Telugu only -- no Latin letters at all
 *   Hind Guntur         Telugu AND Latin
 *
 * The rule (the approved design's S5): text in ONE script takes the serif
 * of that script, which is what a printed page would use; text that MIXES
 * scripts takes Hind Guntur, because React Native cannot fall back between
 * fonts inside one Text node, and a serif that lacks half the glyphs would
 * drop them to the system face mid-word.
 *
 * Digits, spaces and punctuation belong to no script and never decide it.
 * Text with no letters at all takes the serif of the interface language.
 * A script none of the faces covers goes to Hind Guntur too -- the system
 * falls back for those glyphs either way, and the interface face is the
 * one that does it least jarringly.
 */
import type { TextStyle } from 'react-native';
import {
  TELUGU_LINE_HEIGHT_BOOST,
  fontFamilies,
  serifFor,
  type ScriptLanguage,
} from './tokens';

export type TextScript = 'latin' | 'telugu' | 'mixed' | 'none';

const TELUGU = /[ఀ-౿]/u;
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/u;
/** Any letter or mark that is neither Latin nor Telugu (Devanagari, Arabic, CJK...). */
const OTHER_LETTER = /[\p{L}\p{M}]/u;

export function scriptOf(text: string): TextScript {
  let latin = false;
  let telugu = false;
  let other = false;
  for (const ch of text) {
    if (TELUGU.test(ch)) telugu = true;
    else if (LATIN.test(ch)) latin = true;
    else if (OTHER_LETTER.test(ch)) other = true;
  }
  if (other) return 'mixed';
  if (latin && telugu) return 'mixed';
  if (telugu) return 'telugu';
  if (latin) return 'latin';
  return 'none';
}

export function contentFontFamily(
  text: string,
  options: {
    weight?: 'regular' | 'semiBold';
    /** Used when the text has no letters yet (an empty field, a number). */
    fallback?: ScriptLanguage;
  } = {}
): string {
  const { weight = 'regular', fallback = 'en' } = options;
  switch (scriptOf(text)) {
    case 'latin':
      return serifFor('en', weight);
    case 'telugu':
      return serifFor('te', weight);
    case 'none':
      // Telugu has no Latin glyphs in its serif, so an empty field in a
      // Telugu interface still opens in the face that covers both.
      return fallback === 'te'
        ? weight === 'semiBold'
          ? fontFamilies.interfaceSemiBold
          : fontFamilies.interfaceRegular
        : serifFor('en', weight);
    case 'mixed':
      return weight === 'semiBold'
        ? fontFamilies.interfaceSemiBold
        : fontFamilies.interfaceRegular;
  }
}

/**
 * The whole text style for church-written or member-typed text of a given
 * role: the face the rule above picks, at the role's size, with the leading
 * its script needs.
 *
 *   one script, Latin    the English serif at `size`/`line`
 *   one script, Telugu   the Telugu serif at `teSize` (default `size`) and
 *                        `teLine` (default `line` plus Telugu's 12%)
 *   mixed, or no letters Hind Guntur at `size`, with Telugu's leading
 *                        whenever any Telugu is present -- the marks that
 *                        stack above and below a letter need it, and a
 *                        Latin-sized line would clip them
 *
 * A row title (17/24), an article's heading (26/33) and its paragraphs
 * (17/28) are three calls with three specs; no screen picks a face itself.
 */
export function contentTextStyle(
  text: string,
  spec: {
    size: number;
    line: number;
    teSize?: number;
    teLine?: number;
    weight?: 'regular' | 'semiBold';
    fallback?: ScriptLanguage;
  }
): TextStyle {
  const { size, line, teSize = size, weight = 'regular', fallback = 'en' } = spec;
  const script = scriptOf(text);
  const teluguLine = spec.teLine ?? Math.round(line * (1 + TELUGU_LINE_HEIGHT_BOOST));
  const hasTelugu = script === 'telugu' || script === 'mixed';
  return {
    fontFamily: contentFontFamily(text, { weight, fallback }),
    fontSize: script === 'telugu' ? teSize : size,
    fontWeight: weight === 'semiBold' ? '600' : '400',
    lineHeight: hasTelugu || (script === 'none' && fallback === 'te') ? teluguLine : line,
  };
}
