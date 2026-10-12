import { contentFontFamily, scriptOf } from '../scriptFace';
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
