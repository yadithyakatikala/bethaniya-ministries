import {
  fontFamilies,
  readingLineHeight,
  readingScale,
  scriptureStyle,
  serifFor,
  spacing,
  typographyFor,
  MIN_TOUCH_TARGET,
  TELUGU_LINE_HEIGHT_BOOST,
  type ScriptLanguage,
  type TypeScale,
} from '../tokens';
import { BUNDLED_FONT_FAMILIES } from '../fonts';
import type { BibleLanguage } from '../../features/bible/types';

/**
 * The type system's contract.
 *
 * The rules asserted here are not stylistic preferences -- each one
 * corresponds to a way the app can render text that a reader cannot
 * read, and two of them were discovered by measuring the real fonts
 * against the real content rather than by looking at a screen:
 *
 *   1. Noto Serif Telugu contains NO Latin letters, and the Telugu UI
 *      catalogue contains 27 of them. A Telugu heading in the serif
 *      would drop 'Maranatha', 'YouTube' and 'you@example.com' to a
 *      fallback face mid-sentence. So the serif is English-only for
 *      interface roles.
 *   2. Telugu stacks vowel signs above and below the base consonant, so
 *      a line height tuned on Latin clips them.
 *
 * A regression in either is invisible in English, which is exactly why
 * it needs a test rather than a review.
 */

const ROLES: (keyof TypeScale)[] = [
  'display',
  'headline',
  'title',
  'bodyLarge',
  'body',
  'bodySmall',
  'label',
  'caption',
  'overline',
  'scripture',
  'scriptureReference',
];

const INTERFACE_FAMILIES: string[] = [
  fontFamilies.interfaceRegular,
  fontFamilies.interfaceMedium,
  fontFamilies.interfaceSemiBold,
  fontFamilies.interfaceBold,
];

describe('the type scale', () => {
  it('defines every semantic role in both languages', () => {
    for (const language of ['en', 'te'] as const) {
      const scale = typographyFor(language);
      for (const role of ROLES) {
        expect(scale[role]).toBeDefined();
        expect(typeof scale[role].fontSize).toBe('number');
        expect(scale[role].fontFamily).toBeTruthy();
      }
    }
  });

  it('only ever names a font that is actually bundled', () => {
    // A typo in a family name does not fail to build -- React Native
    // silently falls back to the system font, so the app just quietly
    // stops being branded.
    for (const language of ['en', 'te'] as const) {
      const scale = typographyFor(language);
      for (const role of ROLES) {
        expect(BUNDLED_FONT_FAMILIES).toContain(scale[role].fontFamily);
      }
    }
    expect(BUNDLED_FONT_FAMILIES).toHaveLength(8);
  });

  it('never sets a Telugu interface role in a face with no Latin letters', () => {
    // THE RULE THAT MATTERS. Every non-scripture role in Telugu must be
    // the dual-script interface family, because Telugu UI strings embed
    // Latin words.
    const scale = typographyFor('te');
    for (const role of ROLES) {
      if (role === 'scripture') continue;
      expect(INTERFACE_FAMILIES).toContain(scale[role].fontFamily);
    }
  });

  it('gives English its editorial serif for the heading roles', () => {
    const scale = typographyFor('en');
    for (const role of ['display', 'headline', 'title'] as const) {
      expect(scale[role].fontFamily).toBe(fontFamilies.serifEnSemiBold);
    }
    // ...and Telugu the interface family one weight up, for the reason
    // in this file's header.
    const telugu = typographyFor('te');
    for (const role of ['display', 'headline', 'title'] as const) {
      expect(telugu[role].fontFamily).toBe(fontFamilies.interfaceSemiBold);
    }
  });

  it('sets running text in the interface family in both languages', () => {
    for (const language of ['en', 'te'] as const) {
      const scale = typographyFor(language);
      for (const role of [
        'bodyLarge',
        'body',
        'bodySmall',
        'label',
        'caption',
      ] as const) {
        expect(INTERFACE_FAMILIES).toContain(scale[role].fontFamily);
      }
    }
  });

  it('gives Telugu more leading than English at the same size', () => {
    const en = typographyFor('en');
    const te = typographyFor('te');
    for (const role of ROLES) {
      expect(te[role].fontSize).toBe(en[role].fontSize);
      const enLine = en[role].lineHeight;
      const teLine = te[role].lineHeight;
      if (typeof enLine === 'number') {
        expect(typeof teLine).toBe('number');
        expect(teLine as number).toBeGreaterThan(enLine);
      }
    }
  });

  it('is a monotonic ramp, not an accidental set of sizes', () => {
    // 22 distinct hardcoded sizes between 10.5 and 28 is what M3
    // replaced. The ramp has to actually descend.
    const scale = typographyFor('en');
    const ladder: (keyof TypeScale)[] = [
      'display',
      'headline',
      'title',
      'bodyLarge',
      'body',
      'bodySmall',
      'caption',
    ];
    const sizes = ladder.map((role) => scale[role].fontSize as number);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it('keeps every role at a legible size', () => {
    for (const language of ['en', 'te'] as const) {
      const scale = typographyFor(language);
      for (const role of ROLES) {
        // The brief's rule: layout problems are not solved by shrinking
        // text, and Telugu in particular must not be made unreadable.
        expect(scale[role].fontSize as number).toBeGreaterThanOrEqual(11);
      }
    }
  });
});

describe('serifFor', () => {
  it('returns the matching script sibling, in both weights', () => {
    expect(serifFor('en', 'regular')).toBe(fontFamilies.serifEnRegular);
    expect(serifFor('en', 'semiBold')).toBe(fontFamilies.serifEnSemiBold);
    expect(serifFor('te', 'regular')).toBe(fontFamilies.serifTeRegular);
    expect(serifFor('te', 'semiBold')).toBe(fontFamilies.serifTeSemiBold);
  });

  it('defaults to the regular weight', () => {
    expect(serifFor('en')).toBe(fontFamilies.serifEnRegular);
  });
});

describe('ScriptLanguage', () => {
  it("stays in step with the Bible module's BibleLanguage", () => {
    // tokens.ts declares its own copy so the theme layer does not depend
    // on a feature module. These two assignments stop the copies from
    // drifting: either direction failing is a compile error.
    const fromBible: ScriptLanguage = 'te' as BibleLanguage;
    const toBible: BibleLanguage = 'en' as ScriptLanguage;
    expect(fromBible).toBe('te');
    expect(toBible).toBe('en');
  });
});

describe('the Bible reading tokens M4 will consume', () => {
  it('offers an ascending, bounded set of size steps', () => {
    const steps = Object.values(readingScale.size);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    // No step may be too small to read or so large that a verse becomes
    // three words per line.
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...steps)).toBeLessThanOrEqual(30);
  });

  it('names a default that exists', () => {
    expect(readingScale.size).toHaveProperty(readingScale.defaultSize);
    expect(readingScale.lineHeight).toHaveProperty(readingScale.defaultLineHeight);
    expect(readingScale.measure).toHaveProperty(readingScale.defaultMeasure);
  });

  it('keeps every line-height density inside a readable band', () => {
    for (const multiplier of Object.values(readingScale.lineHeight)) {
      expect(multiplier).toBeGreaterThanOrEqual(1.3);
      expect(multiplier).toBeLessThanOrEqual(2);
    }
  });

  it('caps the text column so a line does not run the width of a tablet', () => {
    const widths = Object.values(readingScale.measure);
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(400);
      expect(width).toBeLessThanOrEqual(900);
    }
    expect(readingScale.measure.narrow).toBeLessThan(readingScale.measure.normal);
    expect(readingScale.measure.normal).toBeLessThan(readingScale.measure.wide);
  });

  it('reserves enough room for a merged verse range like "39-40"', () => {
    // The M1 Telugu import preserves merged ranges, so the verse-number
    // column has to fit two numbers and a hyphen without pushing the
    // text out of alignment with its neighbours.
    expect(readingScale.verseNumberColumn).toBeGreaterThanOrEqual(30);
  });

  it('computes a Telugu line height above the English one, at every step', () => {
    for (const size of Object.keys(
      readingScale.size
    ) as (keyof typeof readingScale.size)[]) {
      for (const density of Object.keys(
        readingScale.lineHeight
      ) as (keyof typeof readingScale.lineHeight)[]) {
        const en = readingLineHeight(size, density, 'en');
        const te = readingLineHeight(size, density, 'te');
        expect(te).toBeGreaterThan(en);
        // And by roughly the documented amount, not an arbitrary jump.
        expect(te / en).toBeCloseTo(1 + TELUGU_LINE_HEIGHT_BOOST, 1);
      }
    }
  });

  it('scales line height with size, so a density choice survives a size change', () => {
    expect(readingLineHeight('xxl', 'normal', 'en')).toBeGreaterThan(
      readingLineHeight('xs', 'normal', 'en')
    );
    expect(readingLineHeight('md', 'relaxed', 'en')).toBeGreaterThan(
      readingLineHeight('md', 'compact', 'en')
    );
  });
});

describe('scriptureStyle', () => {
  it('sets a verse in the serif that covers its own script', () => {
    expect(scriptureStyle('en').fontFamily).toBe(fontFamilies.serifEnRegular);
    expect(scriptureStyle('te').fontFamily).toBe(fontFamilies.serifTeRegular);
  });

  it('defaults to the default size and density', () => {
    const style = scriptureStyle('en');
    expect(style.fontSize).toBe(readingScale.size[readingScale.defaultSize]);
    expect(style.lineHeight).toBe(
      readingLineHeight(readingScale.defaultSize, readingScale.defaultLineHeight, 'en')
    );
  });

  it('honours an explicit size and density', () => {
    const style = scriptureStyle('te', 'xxl', 'relaxed');
    expect(style.fontSize).toBe(readingScale.size.xxl);
    expect(style.lineHeight).toBe(readingLineHeight('xxl', 'relaxed', 'te'));
  });
});

describe('spacing and touch targets', () => {
  it('has a semantic name for every value a screen reaches for', () => {
    for (const key of ['screen', 'card', 'section', 'row', 'field'] as const) {
      expect(typeof spacing[key]).toBe('number');
      expect(spacing[key]).toBeGreaterThan(0);
    }
  });

  it('states the 44dp minimum once', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });
});
