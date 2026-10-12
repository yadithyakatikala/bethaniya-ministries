import { contentFontFamily, contentTextStyle, scriptOf } from '../scriptFace';
import { fontFamilies } from '../tokens';

/**
 * The face a piece of unknown-language text takes (design rule S5).
 * Single script -> that script's serif. Mixed -> the one face that covers
 * both. This is the thing that stops a Telugu name with a Latin initial
 * from losing half its letters.
 */
describe('scriptOf', () => {
  it('recognises a single script', () => {
    expect(scriptOf('Daniel Samuel')).toBe('latin');
    expect(scriptOf('రూతు శామ్యూల్')).toBe('telugu');
  });

  it('calls Latin and Telugu together mixed', () => {
    expect(scriptOf('Ruth రూతు')).toBe('mixed');
    expect(scriptOf('రూతు S.')).toBe('mixed');
  });

  it('ignores digits, spaces and punctuation: they belong to no script', () => {
    expect(scriptOf('34')).toBe('none');
    expect(scriptOf('  -- 12 ')).toBe('none');
    expect(scriptOf('')).toBe('none');
    expect(scriptOf('Room 4, Block B')).toBe('latin');
    expect(scriptOf('రూతు 34.')).toBe('telugu');
  });

  it('counts accented Latin as Latin', () => {
    expect(scriptOf('José Núñez')).toBe('latin');
  });

  it('treats a script no bundled face covers as mixed, so it gets the interface face', () => {
    expect(scriptOf('नमस्ते')).toBe('mixed');
    expect(scriptOf('Hello नमस्ते')).toBe('mixed');
  });
});

describe('contentFontFamily', () => {
  it('sets Latin text in the English serif and Telugu text in the Telugu serif', () => {
    expect(contentFontFamily('Daniel')).toBe(fontFamilies.serifEnRegular);
    expect(contentFontFamily('Daniel', { weight: 'semiBold' })).toBe(
      fontFamilies.serifEnSemiBold
    );
    expect(contentFontFamily('రూతు')).toBe(fontFamilies.serifTeRegular);
    expect(contentFontFamily('రూతు', { weight: 'semiBold' })).toBe(
      fontFamilies.serifTeSemiBold
    );
  });

  it('sets mixed text in Hind Guntur, which has both scripts', () => {
    expect(contentFontFamily('Ruth రూతు')).toBe(fontFamilies.interfaceRegular);
    expect(contentFontFamily('Ruth రూతు', { weight: 'semiBold' })).toBe(
      fontFamilies.interfaceSemiBold
    );
  });

  it('never picks a serif that cannot draw the text', () => {
    // The whole point: the Telugu serif has NO Latin letters, the English
    // serif has NO Telugu.
    for (const text of ['Ruth', 'రూతు', 'Ruth రూతు', '34', '']) {
      const family = contentFontFamily(text, { fallback: 'te' });
      const script = scriptOf(text);
      if (script === 'latin') expect(family).not.toBe(fontFamilies.serifTeRegular);
      if (script === 'telugu') expect(family).not.toBe(fontFamilies.serifEnRegular);
      if (script === 'mixed') {
        expect(family).not.toBe(fontFamilies.serifEnRegular);
        expect(family).not.toBe(fontFamilies.serifTeRegular);
      }
    }
  });

  it('opens an empty field in the serif of the interface language -- or Hind Guntur in Telugu', () => {
    expect(contentFontFamily('', { fallback: 'en' })).toBe(fontFamilies.serifEnRegular);
    // An empty Telugu-interface field must be able to take either script.
    expect(contentFontFamily('', { fallback: 'te' })).toBe(fontFamilies.interfaceRegular);
    expect(contentFontFamily('34', { fallback: 'te', weight: 'semiBold' })).toBe(
      fontFamilies.interfaceSemiBold
    );
  });
});

describe('contentTextStyle', () => {
  const ROW_TITLE = {
    size: 17,
    line: 24,
    teSize: 16.5,
    teLine: 30,
    weight: 'semiBold',
  } as const;

  it("sets Latin text in the English serif at the role's size and leading", () => {
    expect(contentTextStyle('Youth fellowship', ROW_TITLE)).toEqual({
      fontFamily: fontFamilies.serifEnSemiBold,
      fontSize: 17,
      fontWeight: '600',
      lineHeight: 24,
    });
  });

  it('sets Telugu text in the Telugu serif at its own size and leading', () => {
    expect(contentTextStyle('యువజన సహవాసం', ROW_TITLE)).toEqual({
      fontFamily: fontFamilies.serifTeSemiBold,
      fontSize: 16.5,
      fontWeight: '600',
      lineHeight: 30,
    });
  });

  it("sets mixed text in the face that has both, at the English size with Telugu's leading", () => {
    // A Latin-sized line would clip the marks that stack above and below a
    // Telugu letter; the size stays the English one, the leading does not.
    const style = contentTextStyle('యువజన Youth', ROW_TITLE);
    expect(style.fontFamily).toBe(fontFamilies.interfaceSemiBold);
    expect(style.fontSize).toBe(17);
    expect(style.lineHeight).toBe(30);
  });

  it('gives Telugu 12% more leading when the role does not say what it should be', () => {
    const style = contentTextStyle('రూతు', { size: 17, line: 28 });
    expect(style.lineHeight).toBe(Math.round(28 * 1.12));
    expect(style.fontSize).toBe(17);
  });

  it('uses the regular weight by default', () => {
    expect(contentTextStyle('Hello', { size: 17, line: 28 })).toMatchObject({
      fontFamily: fontFamilies.serifEnRegular,
      fontWeight: '400',
    });
  });

  it('falls back to the interface language for text with no letters yet', () => {
    expect(contentTextStyle('', { size: 17, line: 28 }).fontFamily).toBe(
      fontFamilies.serifEnRegular
    );
    const te = contentTextStyle('', { size: 17, line: 28, fallback: 'te' });
    expect(te.fontFamily).toBe(fontFamilies.interfaceRegular);
    expect(te.lineHeight).toBe(Math.round(28 * 1.12));
  });
});
